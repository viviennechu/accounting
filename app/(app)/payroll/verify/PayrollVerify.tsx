'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Schedule {
  id: string
  employee_id: string
  year: number
  month: number
  days_d: number
  days_e: number
  days_n: number
  days_a: number
  days_p: number
  days_off: number
  days_sick: number
  days_absent: number
  extra_hours: number
  total_work_hours: number
  overtime_pay: number
  night_allowance: number
  gross_salary: number
  absence_deduction: number
  calculated_net: number
  actual_paid: number
  voucher_id?: string | null
  employee?: {
    id: string
    name: string
    employee_type: string
    base_salary: number
    hourly_rate: number
  }
}

interface Props {
  year: number
  month: number
  branchId: string
  branches: { id: string; name: string }[]
  isAdmin: boolean
  schedules: Schedule[]
  accounts: { id: string; code: string; name: string }[]
}

export default function PayrollVerify({ year, month, branchId, branches, isAdmin, schedules, accounts }: Props) {
  const router = useRouter()
  const [actualPaid, setActualPaid] = useState<Record<string, string>>(
    Object.fromEntries(schedules.map(s => [s.id, s.actual_paid ? String(s.actual_paid) : '']))
  )
  const [selectedYear, setSelectedYear] = useState(year)
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [selectedBranch, setSelectedBranch] = useState(branchId)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saved, setSaved] = useState(false)

  function navigate() {
    const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth), branch: selectedBranch })
    router.push(`/payroll/verify?${params}`)
  }

  async function handleSaveActual() {
    setSaving(true)
    const supabase = createClient()
    const updates = schedules.map(s => ({
      id: s.id,
      actual_paid: Number(actualPaid[s.id]) || 0,
    }))
    for (const u of updates) {
      await supabase.from('employee_monthly_schedules').update({ actual_paid: u.actual_paid }).eq('id', u.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    router.refresh()
  }

  async function handleGenerateVoucher() {
    const totalNet = schedules.reduce((s, r) => s + r.calculated_net, 0)
    if (totalNet === 0) { alert('薪資合計為零，無法產生傳票'); return }

    const debitAccount = accounts.find(a => a.code === '6010')
    const creditAccount = accounts.find(a => a.code === '2140')

    if (!debitAccount || !creditAccount) {
      alert('找不到薪資科目（6010 或 2140），請先至「科目代號」新增相關科目')
      return
    }

    setGenerating(true)
    const supabase = createClient()

    const voucherPayload = {
      branch_id: selectedBranch,
      date: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
      description: `${selectedYear}年${selectedMonth}月薪資`,
    }

    const { data: voucher, error: ve } = await supabase
      .from('vouchers')
      .insert(voucherPayload)
      .select()
      .single()

    if (ve || !voucher) { alert('產生傳票失敗：' + ve?.message); setGenerating(false); return }

    const lines = [
      { voucher_id: voucher.id, account_id: debitAccount.id, debit: totalNet, credit: 0, note: `${selectedYear}年${selectedMonth}月薪資支出`, line_order: 1 },
      { voucher_id: voucher.id, account_id: creditAccount.id, debit: 0, credit: totalNet, note: `${selectedYear}年${selectedMonth}月應付薪資`, line_order: 2 },
    ]

    const { error: le } = await supabase.from('voucher_lines').insert(lines)
    if (le) { alert('新增分錄失敗：' + le.message); setGenerating(false); return }

    // 更新所有班表記錄的 voucher_id
    for (const s of schedules) {
      await supabase.from('employee_monthly_schedules').update({ voucher_id: voucher.id }).eq('id', s.id)
    }

    setGenerating(false)
    alert(`已產生薪資傳票 — 總計 ${formatCurrency(totalNet)}`)
    router.push(`/vouchers/${voucher.id}`)
  }

  async function handleExport() {
    const xlsx = await import('xlsx')
    const data = [
      ['姓名', '類型', 'D班', 'E班', 'N班', 'A班', 'P班', '病假', '缺勤', '加班時數', '加班費', '夜班津貼', '缺勤扣款', '應發薪資', '實發薪資', '差異'],
      ...schedules.map(s => {
        const actual = Number(actualPaid[s.id]) || s.actual_paid || 0
        const diff = actual - s.calculated_net
        return [
          s.employee?.name ?? '',
          s.employee?.employee_type === 'monthly' ? '月薪' : '時薪',
          s.days_d, s.days_e, s.days_n, s.days_a, s.days_p,
          s.days_sick, s.days_absent, s.extra_hours,
          s.overtime_pay, s.night_allowance, s.absence_deduction,
          s.calculated_net, actual, diff,
        ]
      })
    ]
    const ws = xlsx.utils.aoa_to_sheet(data)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, '薪資核對')
    xlsx.writeFile(wb, `薪資核對_${selectedYear}_${selectedMonth}.xlsx`)
  }

  const totalCalculated = schedules.reduce((s, r) => s + r.calculated_net, 0)
  const totalActual = schedules.reduce((s, r) => s + (Number(actualPaid[r.id]) || r.actual_paid || 0), 0)
  const totalDiff = totalActual - totalCalculated
  const hasVoucher = schedules.some(s => s.voucher_id)

  return (
    <div className="space-y-4">
      {/* 控制列 */}
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
        <div className="flex-1" />
        <button onClick={handleExport}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          匯出 Excel
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          此月份尚無班表記錄，請先至「班表上傳」輸入班表
        </div>
      ) : (
        <>
          {/* 摘要卡 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">系統計算應發</div>
              <div className="text-xl font-bold text-blue-700 font-mono">{formatCurrency(totalCalculated)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">實際發放合計</div>
              <div className="text-xl font-bold text-gray-800 font-mono">{formatCurrency(totalActual)}</div>
            </div>
            <div className={`border rounded-xl p-4 ${Math.abs(totalDiff) < 10 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-xs text-gray-500 mb-1">差異（實發－應發）</div>
              <div className={`text-xl font-bold font-mono ${Math.abs(totalDiff) < 10 ? 'text-green-700' : 'text-red-600'}`}>
                {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
              </div>
            </div>
          </div>

          {/* 明細表 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="font-semibold text-gray-800">{selectedYear} 年 {selectedMonth} 月薪資核對</span>
              <div className="flex items-center gap-3">
                {saved && <span className="text-green-600 text-sm">✓ 已儲存</span>}
                <button onClick={handleSaveActual} disabled={saving}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                  {saving ? '儲存中...' : '儲存實發金額'}
                </button>
                {!hasVoucher && (
                  <button onClick={handleGenerateVoucher} disabled={generating}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {generating ? '產生中...' : '一鍵產生薪資傳票'}
                  </button>
                )}
                {hasVoucher && (
                  <span className="text-green-600 text-sm font-medium">✓ 已產生傳票</span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-gray-700 font-medium">員工</th>
                    <th className="px-2 py-2.5 text-center text-gray-700 font-medium">D</th>
                    <th className="px-2 py-2.5 text-center text-gray-700 font-medium">E</th>
                    <th className="px-2 py-2.5 text-center text-gray-700 font-medium">N</th>
                    <th className="px-2 py-2.5 text-center text-gray-700 font-medium">A</th>
                    <th className="px-2 py-2.5 text-center text-gray-700 font-medium">P</th>
                    <th className="px-2 py-2.5 text-center text-gray-700 font-medium">缺勤</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium">加班費</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium">夜班津貼</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium">扣款</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium bg-blue-50">應發</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium">實發</th>
                    <th className="px-3 py-2.5 text-center text-gray-700 font-medium">差異</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => {
                    const actual = Number(actualPaid[s.id]) || s.actual_paid || 0
                    const diff = actual - s.calculated_net
                    const match = actual > 0 && Math.abs(diff) < 10
                    const mismatch = actual > 0 && Math.abs(diff) >= 10
                    return (
                      <tr key={s.id} className={`border-b border-gray-100 ${mismatch ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.employee?.name}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_d || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_e || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_n || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_a || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_p || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-red-600">{s.days_absent || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">{s.overtime_pay > 0 ? formatCurrency(s.overtime_pay) : '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">{s.night_allowance > 0 ? formatCurrency(s.night_allowance) : '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-red-600">{s.absence_deduction > 0 ? `−${formatCurrency(s.absence_deduction)}` : '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-blue-800 bg-blue-50">{formatCurrency(s.calculated_net)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <input type="number"
                            value={actualPaid[s.id]}
                            onChange={e => setActualPaid(p => ({ ...p, [s.id]: e.target.value }))}
                            placeholder="輸入實發"
                            className="w-28 border border-gray-300 rounded px-2 py-1 text-right text-sm text-gray-900 font-mono" />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {actual === 0 ? (
                            <span className="text-gray-400 text-xs">未填</span>
                          ) : match ? (
                            <span className="text-green-600 text-xs font-medium">✓ 相符</span>
                          ) : (
                            <span className="text-red-600 text-xs font-medium">{diff > 0 ? '+' : ''}{formatCurrency(diff)}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
