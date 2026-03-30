'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Props {
  branches: { id: string; name: string }[]
  defaultBranchId: string
  isAdmin: boolean
  pointValues: { year: number; quarter: number; point_value: number }[]
}

export default function NewClaimForm({ branches, defaultBranchId, isAdmin, pointValues }: Props) {
  const router = useRouter()
  const now = new Date()
  const [branchId, setBranchId] = useState(defaultBranchId)
  const [serviceYear, setServiceYear] = useState(String(now.getFullYear()))
  const [serviceMonth, setServiceMonth] = useState(String(now.getMonth() + 1))
  const [totalPoints, setTotalPoints] = useState('')
  const [submittedAt, setSubmittedAt] = useState(now.toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const month = Number(serviceMonth)
  const quarter = Math.ceil(month / 3)
  const pv = pointValues.find(p => p.year === Number(serviceYear) && p.quarter === quarter)
  const expectedAmount = pv && totalPoints ? Math.round(Number(totalPoints) * pv.point_value) : null

  async function handleSave() {
    if (!totalPoints || Number(totalPoints) <= 0) { setError('請填寫申報點數'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const { error: err } = await supabase.from('nhi_claims').insert({
      branch_id: branchId,
      service_year: Number(serviceYear),
      service_month: Number(serviceMonth),
      total_points: Number(totalPoints),
      submitted_at: submittedAt || null,
      expected_amount: expectedAmount,
      notes: notes || null,
    })

    if (err) { setError(err.message.includes('unique') ? '該月份已有申報記錄' : '儲存失敗：' + err.message); setSaving(false); return }
    router.push('/nhi/claims')
    router.refresh()
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      {isAdmin && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">分公司</label>
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">服務年度</label>
          <select value={serviceYear} onChange={e => setServiceYear(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">服務月份</label>
          <select value={serviceMonth} onChange={e => setServiceMonth(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">申報點數 *</label>
        <input type="number" value={totalPoints} onChange={e => setTotalPoints(e.target.value)}
          placeholder="例：12500"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
        {expectedAmount !== null && (
          <p className="text-xs text-green-700 mt-1">
            預計收款：{formatCurrency(expectedAmount)}（點值 {pv?.point_value}）
          </p>
        )}
        {!pv && totalPoints && (
          <p className="text-xs text-amber-600 mt-1">尚未設定 {serviceYear}年第{quarter}季點值，無法預估收款金額</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">申報日期</label>
        <input type="date" value={submittedAt} onChange={e => setSubmittedAt(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">備註</label>
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="選填"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '儲存中...' : '儲存申報'}
        </button>
        <button onClick={() => router.back()}
          className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50">
          取消
        </button>
      </div>
    </div>
  )
}
