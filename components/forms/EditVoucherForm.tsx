'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types'

interface Line {
  id: string
  account_id: string
  account: { code: string; name: string; type: string } | null
  debit: number
  credit: number
  note: string | null
  line_order: number
}

interface Props {
  voucher: {
    id: string
    date: string
    voucher_no: string | null
    description: string | null
    attachment_url: string | null
    branch_id: string
  }
  lines: Line[]
  accounts: Account[]
  isAdmin: boolean
}

export default function EditVoucherForm({ voucher, lines, accounts, isAdmin }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [date, setDate] = useState(voucher.date)
  const [voucherNo, setVoucherNo] = useState(voucher.voucher_no || '')
  const [description, setDescription] = useState(voucher.description || '')
  const [lineStates, setLineStates] = useState(
    lines.map(l => ({
      id: l.id,
      accountId: l.account_id,
      debit: l.debit,
      credit: l.credit,
      note: l.note || '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const branchAccounts = accounts.filter(a => !a.branch_id || a.branch_id === voucher.branch_id)

  function updateLine(index: number, patch: Partial<typeof lineStates[0]>) {
    setLineStates(prev => prev.map((l, i) => i === index ? { ...l, ...patch } : l))
  }

  const totalDebit = lineStates.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lineStates.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced = totalDebit === totalCredit && totalDebit > 0

  async function handleSave() {
    if (!isBalanced) { setError('借貸不平衡，請確認金額'); return }
    setSaving(true)
    setError('')

    const { error: vErr } = await supabase
      .from('vouchers')
      .update({ date, voucher_no: voucherNo || null, description: description || null })
      .eq('id', voucher.id)

    if (vErr) { setError('儲存失敗：' + vErr.message); setSaving(false); return }

    for (const l of lineStates) {
      await supabase.from('voucher_lines').update({
        account_id: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        note: l.note || null,
      }).eq('id', l.id)
    }

    router.push(`/vouchers/${voucher.id}`)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('確定要刪除這筆傳票？此動作無法還原')) return
    setDeleting(true)
    await supabase.from('voucher_lines').delete().eq('voucher_id', voucher.id)
    await supabase.from('vouchers').delete().eq('id', voucher.id)
    router.push('/vouchers')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* 基本資訊 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">基本資訊</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">日期 *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">傳票編號</label>
              <input
                type="text"
                value={voucherNo}
                onChange={e => setVoucherNo(e.target.value)}
                placeholder="選填"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">摘要</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* 分錄 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-gray-800">借貸分錄</h2>
        <div className="space-y-3">
          {lineStates.map((line, i) => (
            <div key={line.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 border-b border-gray-100 pb-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">科目</label>
                <select
                  value={line.accountId}
                  onChange={e => updateLine(i, { accountId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                >
                  {branchAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">借方</label>
                <input
                  type="number"
                  value={line.debit || ''}
                  onChange={e => updateLine(i, { debit: Number(e.target.value) || 0 })}
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 text-right"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">貸方</label>
                <input
                  type="number"
                  value={line.credit || ''}
                  onChange={e => updateLine(i, { credit: Number(e.target.value) || 0 })}
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 text-right"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-gray-700 mb-1">分錄摘要</label>
                <input
                  type="text"
                  value={line.note}
                  onChange={e => updateLine(i, { note: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
            </div>
          ))}
        </div>

        {/* 合計 */}
        <div className="flex items-center justify-between text-sm pt-1">
          <span className="text-gray-900">
            借方合計：<span className="font-mono font-semibold">{totalDebit.toLocaleString('zh-TW')}</span>
            　貸方合計：<span className="font-mono font-semibold">{totalCredit.toLocaleString('zh-TW')}</span>
          </span>
          {isBalanced
            ? <span className="text-green-600 text-sm">✅ 借貸平衡</span>
            : <span className="text-red-500 text-sm">❌ 差額 {Math.abs(totalDebit - totalCredit).toLocaleString('zh-TW')}</span>
          }
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存變更'}
          </button>
          <button
            onClick={() => router.back()}
            className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50"
          >
            取消
          </button>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-red-500 hover:text-red-700 text-sm px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          🗑 刪除這筆傳票
        </button>
      </div>
    </div>
  )
}
