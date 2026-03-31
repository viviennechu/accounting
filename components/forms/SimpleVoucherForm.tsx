'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Account, OcrResult } from '@/lib/types'

interface Props {
  accounts: Account[]
  branches: { id: string; name: string }[]
  defaultBranchId: string
  isAdmin: boolean
}

export default function SimpleVoucherForm({ accounts, branches, defaultBranchId, isAdmin }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [branchId, setBranchId] = useState(defaultBranchId)
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [voucherNo, setVoucherNo] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [mainAccountId, setMainAccountId] = useState('')
  const [cashAccountId, setCashAccountId] = useState('')

  // 預覽分錄可手動修改
  const [previewDebit0, setPreviewDebit0] = useState('')
  const [previewCredit0, setPreviewCredit0] = useState('')
  const [previewDebit1, setPreviewDebit1] = useState('')
  const [previewCredit1, setPreviewCredit1] = useState('')

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const branchAccounts = accounts.filter(a => !a.branch_id || a.branch_id === branchId)

  // 主科目：依收支類型篩選
  const mainAccounts = branchAccounts.filter(a =>
    type === 'expense'
      ? ['cost', 'expense', 'other_loss'].includes(a.type)
      : ['revenue', 'other_income'].includes(a.type)
  )

  // 付款科目：現金或銀行
  const cashAccounts = branchAccounts.filter(a => a.type === 'asset')

  const mainAccount = branchAccounts.find(a => a.id === mainAccountId)
  const cashAccount = branchAccounts.find(a => a.id === cashAccountId)

  // 自動計算預覽分錄
  const amt = Number(amount) || 0
  const line0Debit = type === 'expense' ? amt : 0
  const line0Credit = type === 'expense' ? 0 : amt
  const line1Debit = type === 'expense' ? 0 : amt
  const line1Credit = type === 'expense' ? amt : 0

  // 實際使用的金額（預覽可手動覆蓋）
  const finalDebit0 = previewDebit0 !== '' ? Number(previewDebit0) : line0Debit
  const finalCredit0 = previewCredit0 !== '' ? Number(previewCredit0) : line0Credit
  const finalDebit1 = previewDebit1 !== '' ? Number(previewDebit1) : line1Debit
  const finalCredit1 = previewCredit1 !== '' ? Number(previewCredit1) : line1Credit

  const totalDebit = finalDebit0 + finalDebit1
  const totalCredit = finalCredit0 + finalCredit1
  const isBalanced = totalDebit === totalCredit && totalDebit > 0

  function handleTypeChange(newType: 'expense' | 'income') {
    setType(newType)
    setMainAccountId('')
    setPreviewDebit0('')
    setPreviewCredit0('')
    setPreviewDebit1('')
    setPreviewCredit1('')
  }

  function handleAmountChange(val: string) {
    setAmount(val)
    // 清除手動覆蓋，讓自動計算接管
    setPreviewDebit0('')
    setPreviewCredit0('')
    setPreviewDebit1('')
    setPreviewCredit1('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachmentFile(file)
    setAttachmentPreview(URL.createObjectURL(file))
  }

  async function handleOcr() {
    if (!attachmentFile) return
    setOcrLoading(true)
    setOcrResult(null)

    try {
      const formData = new FormData()
      formData.append('file', attachmentFile)
      formData.append('branch_id', branchId)

      const res = await fetch('/api/vouchers/ocr', { method: 'POST', body: formData })
      const result: OcrResult = await res.json()
      setOcrResult(result)

      if (result.date) setDate(result.date)
      if (result.description) setDescription(result.description)
      if (result.amount) setAmount(String(result.amount))

      // 設定收支類型
      const isIncome = !result.is_debit
      setType(isIncome ? 'income' : 'expense')

      // 嘗試比對科目
      if (result.suggested_account_code) {
        const matched = branchAccounts.find(a => a.code === result.suggested_account_code)
        if (matched) setMainAccountId(matched.id)
      }

      setPreviewDebit0('')
      setPreviewCredit0('')
      setPreviewDebit1('')
      setPreviewCredit1('')
    } catch {
      setError('OCR 辨識失敗，請手動輸入')
    } finally {
      setOcrLoading(false)
    }
  }

  async function handleSave() {
    if (!mainAccountId) { setError('請選擇科目'); return }
    if (!cashAccountId) { setError('請選擇付款/收款方式'); return }
    if (!isBalanced) { setError('借貸不平衡，請確認金額'); return }

    setSaving(true)
    setError('')
    const supabase = createClient()

    let attachmentUrl: string | null = null
    if (attachmentFile) {
      const ext = attachmentFile.name.split('.').pop()
      const path = `${branchId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('voucher-attachments')
        .upload(path, attachmentFile)
      if (uploadError) { setError('附件上傳失敗：' + uploadError.message); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('voucher-attachments').getPublicUrl(path)
      attachmentUrl = urlData.publicUrl
    }

    const { data: voucher, error: voucherError } = await supabase
      .from('vouchers')
      .insert({ branch_id: branchId, voucher_no: voucherNo || null, date, description: description || null, attachment_url: attachmentUrl })
      .select()
      .single()

    if (voucherError) { setError('儲存失敗：' + voucherError.message); setSaving(false); return }

    const { error: linesError } = await supabase.from('voucher_lines').insert([
      { voucher_id: voucher.id, account_id: mainAccountId, debit: finalDebit0, credit: finalCredit0, note: description || null, line_order: 0 },
      { voucher_id: voucher.id, account_id: cashAccountId, debit: finalDebit1, credit: finalCredit1, note: null, line_order: 1 },
    ])

    if (linesError) { setError('儲存分錄失敗：' + linesError.message); setSaving(false); return }

    router.push('/vouchers')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* 照片上傳 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h2 className="font-semibold text-blue-800 mb-3">📷 拍照自動辨識</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 border-2 border-dashed border-blue-300 rounded-lg p-5 text-center cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {attachmentPreview ? (
              <img src={attachmentPreview} alt="附件預覽" className="max-h-36 mx-auto rounded object-contain" />
            ) : (
              <div>
                <div className="text-3xl mb-2">📄</div>
                <div className="text-sm text-blue-600">點擊選擇或拍攝發票/收據</div>
                <div className="text-xs text-gray-700 mt-1">支援 JPG、PNG</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
          </div>
          {attachmentFile && (
            <div className="flex flex-col gap-2 justify-start">
              <button
                type="button"
                onClick={handleOcr}
                disabled={ocrLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {ocrLoading ? '⏳ 辨識中...' : '🤖 AI 自動辨識'}
              </button>
              {ocrResult && (
                <div className={`text-xs p-2 rounded-lg ${
                  ocrResult.confidence === 'high' ? 'bg-green-50 text-green-700' :
                  ocrResult.confidence === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  信心度：{ocrResult.confidence === 'high' ? '高 ✓' : ocrResult.confidence === 'medium' ? '中 △' : '低 ✗'}
                  <br />已自動填入，請確認
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 主表單 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h2 className="font-semibold text-gray-800">記帳資料</h2>

        {/* 收入/支出 切換 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
              type === 'expense'
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            💸 支出
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
              type === 'income'
                ? 'bg-green-50 border-green-400 text-green-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            💰 收入
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 日期 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日期 *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>

          {/* 金額 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">金額 *</label>
            <input
              type="number"
              value={amount}
              onChange={e => handleAmountChange(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>

          {/* 科目 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {type === 'expense' ? '費用科目 *' : '收入科目 *'}
            </label>
            <select
              value={mainAccountId}
              onChange={e => setMainAccountId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="">請選擇科目</option>
              {mainAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>

          {/* 付款方式 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {type === 'expense' ? '付款方式 *' : '收款帳戶 *'}
            </label>
            <select
              value={cashAccountId}
              onChange={e => setCashAccountId(e.target.value)}
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
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="說明這筆費用/收入"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>

          {/* 傳票編號（選填） */}
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">傳票編號（選填）</label>
              <input
                type="text"
                value={voucherNo}
                onChange={e => setVoucherNo(e.target.value)}
                placeholder="選填"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          )}

          {/* 分公司（admin） */}
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">分公司</label>
              <select
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 分錄預覽 */}
      {amt > 0 && mainAccountId && cashAccountId && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">分錄預覽</h2>
            <span className="text-xs text-gray-700">金額有誤可直接修改</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-2 text-gray-700 font-medium">科目</th>
                <th className="text-right pb-2 text-gray-700 font-medium w-28">借方</th>
                <th className="text-right pb-2 text-gray-700 font-medium w-28">貸方</th>
              </tr>
            </thead>
            <tbody>
              {/* 主科目行 */}
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-900">{mainAccount?.code} {mainAccount?.name}</td>
                <td className="py-2">
                  <input
                    type="number"
                    value={previewDebit0 !== '' ? previewDebit0 : (line0Debit || '')}
                    onChange={e => setPreviewDebit0(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right text-gray-900"
                    min="0"
                  />
                </td>
                <td className="py-2 pl-2">
                  <input
                    type="number"
                    value={previewCredit0 !== '' ? previewCredit0 : (line0Credit || '')}
                    onChange={e => setPreviewCredit0(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right text-gray-900"
                    min="0"
                  />
                </td>
              </tr>
              {/* 現金/銀行行 */}
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-900">{cashAccount?.code} {cashAccount?.name}</td>
                <td className="py-2">
                  <input
                    type="number"
                    value={previewDebit1 !== '' ? previewDebit1 : (line1Debit || '')}
                    onChange={e => setPreviewDebit1(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right text-gray-900"
                    min="0"
                  />
                </td>
                <td className="py-2 pl-2">
                  <input
                    type="number"
                    value={previewCredit1 !== '' ? previewCredit1 : (line1Credit || '')}
                    onChange={e => setPreviewCredit1(e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right text-gray-900"
                    min="0"
                  />
                </td>
              </tr>
              {/* 合計 */}
              <tr className="font-semibold">
                <td className="pt-2 text-gray-800">合計</td>
                <td className="pt-2 text-right font-mono text-gray-900">{totalDebit.toLocaleString('zh-TW')}</td>
                <td className="pt-2 text-right font-mono text-gray-900">{totalCredit.toLocaleString('zh-TW')}</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2">
            {isBalanced ? (
              <span className="text-green-600 text-sm">✅ 借貸平衡</span>
            ) : (
              <span className="text-red-500 text-sm">❌ 差額：{Math.abs(totalDebit - totalCredit).toLocaleString('zh-TW')}</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? '儲存中...' : '儲存傳票'}
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
  )
}
