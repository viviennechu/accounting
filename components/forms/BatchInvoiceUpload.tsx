'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Account, OcrResult } from '@/lib/types'

async function compressImage(file: File, maxBytes = 4 * 1024 * 1024): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const maxDim = 2048
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

      const tryQuality = (q: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return }
          if (blob.size <= maxBytes || q <= 0.3) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
          } else {
            tryQuality(Math.round((q - 0.1) * 10) / 10)
          }
        }, 'image/jpeg', q)
      }
      tryQuality(0.85)
    }
    img.src = url
  })
}

async function cropFromBbox(
  file: File,
  bbox: { x1: number; y1: number; x2: number; y2: number }
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = img.naturalWidth
      const h = img.naturalHeight
      const pad = 0.01
      const x = Math.max(0, (bbox.x1 - pad)) * w
      const y = Math.max(0, (bbox.y1 - pad)) * h
      const cw = Math.min(1, (bbox.x2 + pad)) * w - x
      const ch = Math.min(1, (bbox.y2 + pad)) * h - y
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      canvas.getContext('2d')!.drawImage(img, x, y, cw, ch, 0, 0, cw, ch)
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return }
        resolve(new File([blob], `crop_${Date.now()}.jpg`, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

interface FieldDef {
  id: string
  label: string
  field_type: string
  options: string[]
  required: boolean
}

interface InvoiceItem {
  ocr: OcrResult
  type: 'expense' | 'income'
  date: string
  amount: string
  description: string
  mainAccountId: string
  cashAccountId: string
  skip: boolean
  croppedFile?: File
  croppedPreview?: string
  duplicate?: { id: string; date: string; description: string | null } | null
  customValues: Record<string, string>
}

interface Props {
  accounts: Account[]
  branches: { id: string; name: string }[]
  defaultBranchId: string
  isAdmin: boolean
}

export default function BatchInvoiceUpload({ accounts, branches, defaultBranchId, isAdmin }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || '')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [loadingProgress, setLoadingProgress] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [customFields, setCustomFields] = useState<FieldDef[]>([])

  const branchAccounts = accounts.filter(a => !a.branch_id || a.branch_id === branchId)
  const cashAccounts = branchAccounts.filter(a => a.type === 'asset')

  function getMainAccounts(type: 'expense' | 'income') {
    return branchAccounts.filter(a =>
      type === 'expense'
        ? ['cost', 'expense', 'other_loss'].includes(a.type)
        : ['revenue', 'other_income'].includes(a.type)
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setPhotoFiles(prev => {
      const merged = [...prev, ...files]
      setPhotoPreviews(merged.map(f => URL.createObjectURL(f)))
      return merged
    })
    setItems([])
    setSavedCount(null)
    setError('')
    e.target.value = ''
  }

  function removePhoto(index: number) {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleOcr() {
    if (photoFiles.length === 0) return
    setLoading(true)
    setError('')
    setItems([])

    try {
      // 拉取自訂欄位定義
      const supabase = createClient()
      const { data: fieldDefs } = await supabase
        .from('custom_field_definitions')
        .select('id, label, field_type, options, required')
        .eq('branch_id', branchId)
        .order('field_order')
      setCustomFields(fieldDefs || [])

      const allItems: InvoiceItem[] = []

      for (let photoIndex = 0; photoIndex < photoFiles.length; photoIndex++) {
        const photoFile = photoFiles[photoIndex]
        setLoadingProgress(`辨識第 ${photoIndex + 1} / ${photoFiles.length} 張...`)

        const compressed = await compressImage(photoFile)
        const formData = new FormData()
        formData.append('file', compressed)
        formData.append('branch_id', branchId)

        const res = await fetch('/api/vouchers/ocr-multi', { method: 'POST', body: formData })
        const data = await res.json()

        if (!data.results || data.results.length === 0) continue

        const newItems: InvoiceItem[] = await Promise.all(
          data.results.map(async (ocr: OcrResult) => {
            const type: 'expense' | 'income' = ocr.is_debit ? 'expense' : 'income'
            const mainAccs = getMainAccounts(type)
            const matched = ocr.suggested_account_code
              ? mainAccs.find(a => a.code === ocr.suggested_account_code)
              : null

            let croppedFile: File | undefined
            let croppedPreview: string | undefined
            if (ocr.bbox) {
              croppedFile = await cropFromBbox(photoFile, ocr.bbox)
              croppedPreview = URL.createObjectURL(croppedFile)
            }

            return {
              ocr,
              type,
              date: ocr.date || new Date().toISOString().split('T')[0],
              amount: ocr.amount ? String(ocr.amount) : '',
              description: ocr.description || '',
              mainAccountId: matched?.id || '',
              cashAccountId: cashAccounts[0]?.id || '',
              skip: false,
              croppedFile,
              croppedPreview,
              customValues: {},
            }
          })
        )

        allItems.push(...newItems)
      }

      if (allItems.length === 0) {
        setError('所有照片均未偵測到任何憑證，請重試')
        setLoading(false)
        return
      }

      // 重複偵測
      setLoadingProgress('檢查重複中...')
      const itemsWithDupCheck = await Promise.all(
        allItems.map(async (item) => {
          const amt = Number(item.amount)
          if (!amt || !item.date) return { ...item, duplicate: null }

          const { data: existing } = await supabase
            .from('vouchers')
            .select('id, date, description, voucher_lines(debit, credit)')
            .eq('branch_id', branchId)
            .eq('date', item.date)
            .limit(10)

          const found = existing?.find(v =>
            (v.voucher_lines as { debit: number; credit: number }[])
              ?.some(l => l.debit === amt || l.credit === amt)
          )

          return {
            ...item,
            duplicate: found
              ? { id: found.id, date: found.date, description: found.description }
              : null,
          }
        })
      )

      setItems(itemsWithDupCheck)
    } catch {
      setError('辨識失敗，請重試')
    } finally {
      setLoading(false)
      setLoadingProgress('')
    }
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  async function handleSaveAll() {
    const toSave = items.filter(item => !item.skip)
    if (toSave.length === 0) { setError('請至少勾選一筆憑證'); return }

    const invalid = toSave.findIndex(item => !item.mainAccountId || !item.cashAccountId || !item.amount || item.amount === '0')
    if (invalid !== -1) {
      setError(`憑證 ${items.indexOf(toSave[invalid]) + 1} 金額或科目未填，請先補齊再儲存`)
      return
    }

    setSaving(true)
    setError('')
    const supabase = createClient()

    let count = 0
    for (const item of toSave) {
      // 每張憑證上傳自己的裁切照片，沒有裁切才用原始
      let attachmentUrl: string | null = null
      const uploadFile = item.croppedFile || photoFile
      if (uploadFile) {
        const path = `${branchId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('voucher-attachments')
          .upload(path, uploadFile)
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('voucher-attachments').getPublicUrl(path)
          attachmentUrl = urlData.publicUrl
        }
      }
      const amt = Number(item.amount)
      const isExpense = item.type === 'expense'

      const { data: voucher, error: vErr } = await supabase
        .from('vouchers')
        .insert({
          branch_id: branchId,
          date: item.date,
          description: item.description || null,
          attachment_url: attachmentUrl,
        })
        .select()
        .single()

      if (vErr || !voucher) continue

      // 儲存自訂欄位值
      const customEntries = Object.entries(item.customValues)
        .filter(([, v]) => v.trim())
        .map(([fieldId, value]) => ({ voucher_id: voucher.id, field_id: fieldId, value }))
      if (customEntries.length > 0) {
        await supabase.from('voucher_custom_values').insert(customEntries)
      }

      await supabase.from('voucher_lines').insert([
        {
          voucher_id: voucher.id,
          account_id: item.mainAccountId,
          debit: isExpense ? amt : 0,
          credit: isExpense ? 0 : amt,
          note: item.description || null,
          line_order: 0,
        },
        {
          voucher_id: voucher.id,
          account_id: item.cashAccountId,
          debit: isExpense ? 0 : amt,
          credit: isExpense ? amt : 0,
          note: null,
          line_order: 1,
        },
      ])

      count++
    }

    setSaving(false)
    setSavedCount(count)
    setItems([])
    setPhotoFiles([])
    setPhotoPreviews([])
  }

  const activeCount = items.filter(i => !i.skip).length

  return (
    <div className="space-y-5">
      {/* 燈箱 */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="憑證放大"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 bg-white/20 text-white px-3 py-1.5 rounded-full text-sm hover:bg-white/30"
            onClick={() => setLightbox(null)}
          >
            ✕ 關閉
          </button>
        </div>
      )}

      {/* 分公司選擇（admin） */}
      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">分公司</label>
          <select
            value={branchId}
            onChange={e => { setBranchId(e.target.value); setItems([]) }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 上傳區 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h2 className="font-semibold text-blue-800 mb-1">📷 上傳憑證照片</h2>
        <p className="text-xs text-blue-600 mb-3">可一次選多張照片，每張可包含多張發票，AI 會全部辨識</p>

        {/* 選擇照片按鈕 */}
        <div
          className="border-2 border-dashed border-blue-300 rounded-lg p-4 text-center cursor-pointer hover:bg-blue-100 transition-colors mb-3"
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-2xl mb-1">📂</div>
          <div className="text-sm text-blue-600 font-medium">點擊新增照片</div>
          <div className="text-xs text-gray-600 mt-0.5">支援 JPG、PNG，可一次選多張</div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* 已選照片縮圖 */}
        {photoPreviews.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {photoPreviews.map((src, idx) => (
              <div key={idx} className="relative group aspect-square">
                <img
                  src={src}
                  alt={`照片 ${idx + 1}`}
                  className="w-full h-full object-cover rounded-lg border border-blue-200"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs text-center rounded-b-lg py-0.5">
                  {idx + 1}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 辨識按鈕 */}
        {photoFiles.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOcr}
              disabled={loading}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? `⏳ ${loadingProgress || '辨識中...'}` : `🤖 AI 辨識（${photoFiles.length} 張）`}
            </button>
            {items.length > 0 && (
              <span className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg">
                共辨識出 {items.length} 張憑證
              </span>
            )}
          </div>
        )}
      </div>

      {/* 儲存成功訊息 */}
      {savedCount !== null && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-medium">
          ✅ 成功儲存 {savedCount} 筆傳票！
          <button
            className="ml-4 text-sm underline"
            onClick={() => router.push('/vouchers')}
          >
            前往傳票清單
          </button>
        </div>
      )}

      {/* 全域錯誤訊息（辨識失敗時顯示） */}
      {error && items.length === 0 && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* 各發票編輯卡片 */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">辨識結果 — 請確認各筆資料</h2>
            <span className="text-xs text-gray-800">已選 {activeCount} / {items.length} 筆</span>
          </div>

          {items.map((item, i) => {
            const mainAccs = getMainAccounts(item.type)
            return (
              <div
                key={i}
                className={`border rounded-xl p-4 space-y-3 transition-opacity ${
                  item.skip ? 'opacity-40 bg-gray-50' : 'bg-white border-gray-200'
                }`}
              >
                {/* 裁切預覽（點擊放大） */}
                {item.croppedPreview && (
                  <div
                    className="relative cursor-zoom-in group"
                    onClick={() => setLightbox(item.croppedPreview!)}
                  >
                    <img
                      src={item.croppedPreview}
                      alt={`憑證 ${i + 1} 裁切預覽`}
                      className="w-full max-h-40 object-contain rounded-lg bg-gray-100 border border-gray-200"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-black/20">
                      <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">🔍 點擊放大</span>
                    </div>
                  </div>
                )}

                {/* 重複警告 */}
                {item.duplicate && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-800">
                    <span>⚠️ 可能重複！同日已有一筆 NT$ {Number(item.amount).toLocaleString('zh-TW')} 的傳票</span>
                    <a
                      href={`/vouchers/${item.duplicate.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-amber-700 hover:text-amber-900 shrink-0"
                    >
                      查看 →
                    </a>
                  </div>
                )}

                {/* 卡片標題列 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">憑證 {i + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.ocr.confidence === 'high' ? 'bg-green-100 text-green-700' :
                      item.ocr.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      信心度：{item.ocr.confidence === 'high' ? '高' : item.ocr.confidence === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 text-sm text-gray-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!item.skip}
                      onChange={e => updateItem(i, { skip: !e.target.checked })}
                      className="w-4 h-4"
                    />
                    納入儲存
                  </label>
                </div>

                {!item.skip && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 收/支 */}
                    <div className="sm:col-span-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateItem(i, { type: 'expense', mainAccountId: '' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${
                          item.type === 'expense'
                            ? 'bg-red-50 border-red-400 text-red-700'
                            : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        💸 支出
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(i, { type: 'income', mainAccountId: '' })}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 ${
                          item.type === 'income'
                            ? 'bg-green-50 border-green-400 text-green-700'
                            : 'border-gray-200 text-gray-700'
                        }`}
                      >
                        💰 收入
                      </button>
                    </div>

                    {/* 日期 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">日期 *</label>
                      <input
                        type="date"
                        value={item.date}
                        onChange={e => updateItem(i, { date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      />
                    </div>

                    {/* 金額 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">金額 *</label>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={e => updateItem(i, { amount: e.target.value })}
                        placeholder="0"
                        min="0"
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-900 ${
                          !item.amount || item.amount === '0'
                            ? 'border-red-400 bg-red-50'
                            : 'border-gray-300'
                        }`}
                      />
                      {(!item.amount || item.amount === '0') && (
                        <p className="text-red-500 text-xs mt-1">⚠️ 請手動填入金額</p>
                      )}
                    </div>

                    {/* 科目 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {item.type === 'expense' ? '費用科目 *' : '收入科目 *'}
                      </label>
                      <select
                        value={item.mainAccountId}
                        onChange={e => updateItem(i, { mainAccountId: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      >
                        <option value="">請選擇科目</option>
                        {mainAccs.map(a => (
                          <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 付款方式 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {item.type === 'expense' ? '付款方式 *' : '收款帳戶 *'}
                      </label>
                      <select
                        value={item.cashAccountId}
                        onChange={e => updateItem(i, { cashAccountId: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      >
                        <option value="">請選擇帳戶</option>
                        {cashAccounts.map(a => (
                          <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 摘要 */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">摘要</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(i, { description: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                      />
                    </div>

                    {/* 自訂欄位 */}
                    {customFields.map(f => (
                      <div key={f.id} className={f.field_type === 'select' ? '' : 'sm:col-span-2'}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {f.label}{f.required && ' *'}
                        </label>
                        {f.field_type === 'select' ? (
                          <select
                            value={item.customValues[f.id] || ''}
                            onChange={e => updateItem(i, { customValues: { ...item.customValues, [f.id]: e.target.value } })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                          >
                            <option value="">請選擇</option>
                            {f.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.field_type === 'number' ? 'number' : 'text'}
                            value={item.customValues[f.id] || ''}
                            onChange={e => updateItem(i, { customValues: { ...item.customValues, [f.id]: e.target.value } })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* 錯誤訊息 */}
          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* 儲存按鈕 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || activeCount === 0}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '儲存中...' : `儲存 ${activeCount} 筆傳票`}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
