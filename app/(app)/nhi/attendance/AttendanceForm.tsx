'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Resident {
  id: string
  name: string
  subsidy_type: string
  daily_self_pay: number
  daily_subsidy_rate: number
}

interface AttendanceRecord {
  resident_id: string
  days_present: number
  days_leave: number
  days_hospitalized: number
  subsidy_amount: number
  self_pay_amount: number
  self_pay_paid_at: string | null
}

interface Props {
  year: number
  month: number
  daysInMonth: number
  branchId: string
  branches: { id: string; name: string }[]
  isAdmin: boolean
  residents: Resident[]
  existing: any[]
}

export default function AttendanceForm({ year, month, daysInMonth, branchId, branches, isAdmin, residents, existing }: Props) {
  const router = useRouter()

  // 初始化出席記錄（有既有資料就載入，否則預設全天在院）
  const initRows = () => residents.map(r => {
    const ex = existing.find(e => e.resident_id === r.id)
    if (ex) return {
      resident_id: r.id,
      days_present: ex.days_present,
      days_leave: ex.days_leave,
      days_hospitalized: ex.days_hospitalized,
      subsidy_amount: ex.subsidy_amount,
      self_pay_amount: ex.self_pay_amount,
      self_pay_paid_at: ex.self_pay_paid_at,
    }
    return {
      resident_id: r.id,
      days_present: daysInMonth,
      days_leave: 0,
      days_hospitalized: 0,
      subsidy_amount: Math.round(r.daily_subsidy_rate * daysInMonth),
      self_pay_amount: Math.round(r.daily_self_pay * daysInMonth),
      self_pay_paid_at: null,
    }
  })

  const [rows, setRows] = useState<AttendanceRecord[]>(initRows)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [selectedYear, setSelectedYear] = useState(year)
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [selectedBranch, setSelectedBranch] = useState(branchId)

  function updateRow(idx: number, field: keyof AttendanceRecord, value: number) {
    const r = residents[idx]
    const updated = [...rows]
    updated[idx] = { ...updated[idx], [field]: value }

    // 自動重算天數
    const present = field === 'days_present' ? value : updated[idx].days_present
    const leave = field === 'days_leave' ? value : updated[idx].days_leave
    const hosp = field === 'days_hospitalized' ? value : updated[idx].days_hospitalized

    // 在院天數不可超過當月天數
    const validPresent = Math.min(present, daysInMonth - leave - hosp)
    updated[idx].days_present = Math.max(0, validPresent)
    updated[idx].subsidy_amount = Math.round(r.daily_subsidy_rate * updated[idx].days_present)
    updated[idx].self_pay_amount = Math.round(r.daily_self_pay * updated[idx].days_present)

    setRows(updated)
  }

  async function handleSave() {
    if (!selectedBranch) return
    setSaving(true)
    const supabase = createClient()

    const payload = rows.map((row, idx) => ({
      branch_id: selectedBranch,
      resident_id: row.resident_id,
      year: selectedYear,
      month: selectedMonth,
      days_in_month: daysInMonth,
      days_present: row.days_present,
      days_leave: row.days_leave,
      days_hospitalized: row.days_hospitalized,
      daily_subsidy_rate: residents[idx].daily_subsidy_rate,
      subsidy_amount: row.subsidy_amount,
      daily_self_pay: residents[idx].daily_self_pay,
      self_pay_amount: row.self_pay_amount,
      self_pay_paid_at: row.self_pay_paid_at,
    }))

    const { error } = await supabase
      .from('resident_monthly_attendance')
      .upsert(payload, { onConflict: 'resident_id,year,month' })

    setSaving(false)
    if (error) { alert('儲存失敗：' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    router.refresh()
  }

  function navigate() {
    const params = new URLSearchParams({
      year: String(selectedYear),
      month: String(selectedMonth),
      branch: selectedBranch,
    })
    router.push(`/nhi/attendance?${params}`)
  }

  const totalSubsidy = rows.reduce((s, r) => s + r.subsidy_amount, 0)
  const totalSelfPay = rows.reduce((s, r) => s + r.self_pay_amount, 0)

  return (
    <div className="space-y-4">
      {/* 月份選擇 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        {isAdmin && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">分公司</label>
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">年份</label>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">月份</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m} 月</option>
            ))}
          </select>
        </div>
        <button onClick={navigate}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors">
          載入
        </button>
      </div>

      {residents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-900">
          此分公司尚無在籍住民
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-800">{selectedYear} 年 {selectedMonth} 月出席記錄</span>
              <span className="ml-2 text-xs text-gray-700">當月 {daysInMonth} 天・{residents.length} 位住民</span>
            </div>
            <div className="flex items-center gap-3">
              {saved && <span className="text-green-600 text-sm">✓ 已儲存</span>}
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? '儲存中...' : '儲存本月記錄'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-gray-700 font-medium">住民</th>
                  <th className="px-3 py-2.5 text-center text-gray-700 font-medium w-20">在院天數</th>
                  <th className="px-3 py-2.5 text-center text-gray-700 font-medium w-20">請假天數</th>
                  <th className="px-3 py-2.5 text-center text-gray-700 font-medium w-20">住院天數</th>
                  <th className="px-3 py-2.5 text-right text-gray-700 font-medium w-28">社會局補助</th>
                  <th className="px-3 py-2.5 text-right text-gray-700 font-medium w-28">自付額</th>
                  <th className="px-3 py-2.5 text-center text-gray-700 font-medium w-28">自付收款日</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const r = residents[idx]
                  const total = row.days_present + row.days_leave + row.days_hospitalized
                  const overflow = total > daysInMonth
                  return (
                    <tr key={r.id} className={`border-b border-gray-100 ${overflow ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {r.name}
                        <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                          r.subsidy_type === 'both' ? 'bg-purple-100 text-purple-700' :
                          r.subsidy_type === 'subsidy' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-900'
                        }`}>
                          {r.subsidy_type === 'both' ? '自費＋補助' : r.subsidy_type === 'subsidy' ? '補助' : '自費'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" value={row.days_present}
                          onChange={e => updateRow(idx, 'days_present', Number(e.target.value))}
                          min="0" max={daysInMonth}
                          className={`w-16 border rounded px-2 py-1 text-center text-sm text-gray-900 ${overflow ? 'border-red-400' : 'border-gray-300'}`} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" value={row.days_leave}
                          onChange={e => updateRow(idx, 'days_leave', Number(e.target.value))}
                          min="0" max={daysInMonth}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm text-gray-900" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" value={row.days_hospitalized}
                          onChange={e => updateRow(idx, 'days_hospitalized', Number(e.target.value))}
                          min="0" max={daysInMonth}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-center text-sm text-gray-900" />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-900">
                        {r.daily_subsidy_rate > 0 ? formatCurrency(row.subsidy_amount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-900">
                        {r.daily_self_pay > 0 ? formatCurrency(row.self_pay_amount) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.daily_self_pay > 0 ? (
                          <input type="date"
                            value={row.self_pay_paid_at || ''}
                            onChange={e => {
                              const updated = [...rows]
                              updated[idx] = { ...updated[idx], self_pay_paid_at: e.target.value || null }
                              setRows(updated)
                            }}
                            className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900" />
                        ) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-gray-800" colSpan={4}>合計</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-blue-800">{formatCurrency(totalSubsidy)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-blue-800">{formatCurrency(totalSelfPay)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
