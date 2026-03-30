'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Account, OcrResult } from '@/lib/types'

interface VoucherLine {
  account_id: string
  debit: string
  credit: string
  note: string
}

interface Props {
  accounts: Account[]
  branches: { id: string; name: string }[]
  defaultBranchId: string
  isAdmin: boolean
}

export default function VoucherForm({ accounts, branches, defaultBranchId, isAdmin }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [branchId, setBranchId] = useState(defaultBranchId)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [voucherNo, setVoucherNo] = useState('')
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<VoucherLine[]>([
    { account_id: '', debit: '', credit: '', note: '' },
    { account_id: '', debit: '', credit: '', note: '' },
  ])
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addLine() {
    setLines([...lines, { account_id: '', debit: '', credit: '', note: '' }])
  }

  function removeLine(idx: number) {
    if (lines.length <= 2) return
    setLines(lines.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof VoucherLine, value: string) {
    const updated = [...lines]
    updated[idx] = { ...updated[idx], [field]: value }
    setLines(updated)
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

      const res = await fetch('/api/vouchers/ocr', {
        method: 'POST',
        body: formData,
      })

      const result: OcrResult = await res.json()
      setOcrResult(result)

      // 自動填入
      if (result.date) setDate(result.date)
      if (result.description) setDescription(result.description)

      if (result.amount && result.suggested_account_code) {
        const account = accounts.find(a => a.code === result.suggested_account_code)
        const newLines = [...lines]
        if (result.is_debit) {
          newLines[0] = {
            account_id: account?.id || '',
            debit: String(result.amount),
            credit: '',
            note: result.description || '',
          }
        } else {
          newLines[0] = {
            account_id: account?.id || '',
            debit: '',
            credit: String(result.amount),
            note: result.description || '',
          }
        }
        setLines(newLines)
      }
    } catch {
      setError('OCR 辨識失敗，請手動輸入')
    } finally {
      setOcrLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')

    const supabase = createClient()

    // 上傳附件
    let attachmentUrl: string | null = null
    if (attachmentFile) {
      const ext = attachmentFile.name.split('.').pop()
      const path = `${branchId}/${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voucher-attachments')
        .upload(path, attachmentFile)

      if (uploadError) {
        setError('附件上傳失敗：' + uploadError.message)
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('voucher-attachments')
        .getPublicUrl(path)
      attachmentUrl = urlData.publicUrl
    }

    // 建立傳票
    const { data: voucher, error: voucherError } = await supabase
      .from('vouchers')
      .insert({
        branch_id: branchId,
        voucher_no: voucherNo || null,
        date,
        description: description || null,
        attachment_url: attachmentUrl,
      })
      .select()
      .single()

    if (voucherError) {
      setError('儲存傳票失敗：' + voucherError.message)
      setSaving(false)
      return
    }

    // 儲存分錄明細
    const validLines = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
    if (validLines.length > 0) {
      const { error: linesError } = await supabase.from('voucher_lines').insert(
        validLines.map((l, i) => ({
          voucher_id: voucher.id,
          account_id: l.account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          note: l.note || null,
          line_order: i,
        }))
      )

      if (linesError) {
        setError('儲存分錄失敗：' + linesError.message)
        setSaving(false)
        return
      }
    }

    router.push('/vouchers')
    router.refresh()
  }

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0)
  const isBalanced = totalDebit === totalCredit && totalDebit > 0

  return (
    <div className="space-y-6">
      {/* 照片上傳區 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h2 className="font-semibold text-blue-800 mb-3">📷 拍照自動記帳</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 border-2 border-dashed border-blue-300 rounded-lg p-6 text-center cursor-pointer hover:bg-blue-100 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {attachmentPreview ? (
              <img src={attachmentPreview} alt="附件預覽" className="max-h-40 mx-auto rounded object-contain" />
            ) : (
              <div>
                <div className="text-3xl mb-2">📄</div>
                <div className="text-sm text-blue-600">點擊選擇或拍攝發票/收據</div>
                <div className="text-xs text-gray-400 mt-1">支援 JPG、PNG</div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {attachmentFile && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleOcr}
                disabled={ocrLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {ocrLoading ? '⏳ AI 辨識中...' : '🤖 AI 自動辨識'}
              </button>
              {ocrResult && (
                <div className={`text-xs p-2 rounded-lg ${
                  ocrResult.confidence === 'high' ? 'bg-green-50 text-green-700' :
                  ocrResult.confidence === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  辨識信心：{ocrResult.confidence === 'high' ? '高 ✓' : ocrResult.confidence === 'medium' ? '中 △' : '低 ✗'}
                  <br />已自動填入，請確認後儲存
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 傳票基本資料 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h2 className="font-semibold text-gray-700">傳票資料</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">分公司</label>
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">傳票日期 *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">傳票編號</label>
            <input
              type="text"
              value={voucherNo}
              onChange={e => setVoucherNo(e.target.value)}
              placeholder="選填"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">摘要</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="傳票說明"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* 借貸分錄 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="font-semibold text-gray-700 mb-3">借貸分錄</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-2 text-gray-500 font-medium w-8">#</th>
                <th className="text-left pb-2 text-gray-500 font-medium">科目</th>
                <th className="text-left pb-2 text-gray-500 font-medium w-32">摘要</th>
                <th className="text-right pb-2 text-gray-500 font-medium w-28">借方金額</th>
                <th className="text-right pb-2 text-gray-500 font-medium w-28">貸方金額</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-2 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="py-2 pr-2">
                    <select
                      value={line.account_id}
                      onChange={e => updateLine(idx, 'account_id', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900"
                    >
                      <option value="">選擇科目</option>
                      {accounts
                        .filter(a => !a.branch_id || a.branch_id === branchId)
                        .map(a => (
                          <option key={a.id} value={a.id}>
                            {a.code} {a.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      value={line.note}
                      onChange={e => updateLine(idx, 'note', e.target.value)}
                      placeholder="摘要"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      value={line.debit}
                      onChange={e => updateLine(idx, 'debit', e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      value={line.credit}
                      onChange={e => updateLine(idx, 'credit', e.target.value)}
                      placeholder="0"
                      min="0"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-right text-gray-900"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 font-semibold">
                <td colSpan={3} className="pt-2 text-gray-700">合計</td>
                <td className="pt-2 text-right font-mono">
                  {totalDebit.toLocaleString('zh-TW')}
                </td>
                <td className="pt-2 text-right font-mono">
                  {totalCredit.toLocaleString('zh-TW')}
                </td>
                <td className="pt-2 text-center">
                  {isBalanced ? '✅' : totalDebit !== totalCredit && totalDebit > 0 ? '❌' : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!isBalanced && totalDebit > 0 && (
          <p className="text-red-500 text-xs mt-2">借貸不平衡，差額：{Math.abs(totalDebit - totalCredit).toLocaleString('zh-TW')}</p>
        )}

        <button
          type="button"
          onClick={addLine}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800"
        >
          ＋ 新增一行
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
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
          className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}
