'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Props {
  claimId: string
  branchId: string
  serviceYear: number
  serviceMonth: number
  expectedAmount: number
  nhiAccountId: string
  branches: { id: string; name: string }[]
}

export default function ReceivePaymentButton({ claimId, branchId, serviceYear, serviceMonth, expectedAmount, nhiAccountId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(expectedAmount || ''))
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split('T')[0])
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccounts, setBankAccounts] = useState<{ id: string; code: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadAccounts() {
    const supabase = createClient()
    const { data } = await supabase
      .from('accounts')
      .select('id, code, name')
      .eq('branch_id', branchId)
      .eq('type', 'asset')
      .order('code')
    setBankAccounts(data || [])
    setOpen(true)
  }

  async function handleConfirm() {
    if (!bankAccountId) { setError('請選擇銀行帳戶'); return }
    if (!amount || Number(amount) <= 0) { setError('請填入實際收款金額'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()
    const amt = Number(amount)

    // 建立傳票
    const { data: voucher, error: vErr } = await supabase
      .from('vouchers')
      .insert({
        branch_id: branchId,
        date: receivedAt,
        description: `健保撥款 ${serviceYear}年${serviceMonth}月`,
      })
      .select()
      .single()

    if (vErr || !voucher) { setError('建立傳票失敗'); setSaving(false); return }

    // 借：銀行；貸：健保收入
    const { error: lErr } = await supabase.from('voucher_lines').insert([
      { voucher_id: voucher.id, account_id: bankAccountId, debit: amt, credit: 0, note: null, line_order: 0 },
      { voucher_id: voucher.id, account_id: nhiAccountId, debit: 0, credit: amt, note: null, line_order: 1 },
    ])

    if (lErr) { setError('建立分錄失敗'); setSaving(false); return }

    // 更新申報記錄
    await supabase.from('nhi_claims').update({
      received_amount: amt,
      received_at: receivedAt,
      voucher_id: voucher.id,
    }).eq('id', claimId)

    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={loadAccounts}
        className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors">
        登記收款
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-xl p-5 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800 mb-4">{serviceYear}年{serviceMonth}月 健保收款</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">實際收款金額</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            {expectedAmount > 0 && (
              <p className="text-xs text-gray-500 mt-1">預計：{formatCurrency(expectedAmount)}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">收款日期</label>
            <input type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">存入帳戶</label>
            <select value={bankAccountId} onChange={e => setBankAccountId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
              <option value="">請選擇</option>
              {bankAccounts.map(a => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>

          <p className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
            系統將自動產生傳票：借 銀行 / 貸 大健保
          </p>

          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={handleConfirm} disabled={saving}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? '處理中...' : '確認收款'}
          </button>
          <button onClick={() => setOpen(false)}
            className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
