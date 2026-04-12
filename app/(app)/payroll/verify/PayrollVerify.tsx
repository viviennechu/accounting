'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { calcMonthlySalary, getMonthlyStandard } from '@/lib/payroll'

interface Employee {
  id: string
  name: string
  title?: string | null
  base_salary: number
  license_fee: number
  labor_insurance: number
  health_insurance: number
}

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
  monthly_standard_hours: number
  total_work_hours: number
  overtime_hours: number
  overtime_pay: number
  gross_salary: number
  absence_deduction: number
  calculated_net: number
  actual_paid: number
  notes?: string | null
}

interface Props {
  year: number
  month: number
  branchId: string
  branches: { id: string; name: string }[]
  isAdmin: boolean
  employees: Employee[]
  schedules: Schedule[]
}

const emptyShifts = () => ({
  days_d: 0, days_e: 0, days_n: 0, days_a: 0, days_p: 0,
  days_off: 0, days_sick: 0, days_absent: 0, extra_hours: 0,
})

export default function PayrollVerify({
  year, month, branchId, branches, isAdmin, employees, schedules,
}: Props) {
  const router = useRouter()
  const [selectedYear, setSelectedYear] = useState(year)
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [selectedBranch, setSelectedBranch] = useState(branchId)

  // 班次輸入 modal
  const [modalEmp, setModalEmp] = useState<Employee | null>(null)
  const [modalExisting, setModalExisting] = useState<Schedule | null>(null)
  const [shifts, setShifts] = useState(emptyShifts())
  const [notes, setNotes] = useState('')
  const [savingModal, setSavingModal] = useState(false)
  const [modalError, setModalError] = useState('')

  // 實發輸入
  const [actualPaid, setActualPaid] = useState<Record<string, string>>(
    Object.fromEntries(schedules.map(s => [s.id, s.actual_paid ? String(s.actual_paid) : '']))
  )
  const [savingActual, setSavingActual] = useState(false)
  const [savedActual, setSavedActual] = useState(false)

  // scheduleMap: employee_id → schedule
  const scheduleMap = Object.fromEntries(schedules.map(s => [s.employee_id, s]))

  function navigate() {
    const params = new URLSearchParams({
      year: String(selectedYear),
      month: String(selectedMonth),
      branch: selectedBranch,
    })
    router.push(`/payroll/verify?${params}`)
  }

  function openModal(emp: Employee) {
    const existing = scheduleMap[emp.id] ?? null
    setModalEmp(emp)
    setModalExisting(existing)
    setModalError('')
    if (existing) {
      setShifts({
        days_d: existing.days_d,
        days_e: existing.days_e,
        days_n: existing.days_n,
        days_a: existing.days_a,
        days_p: existing.days_p,
        days_off: existing.days_off,
        days_sick: existing.days_sick,
        days_absent: existing.days_absent,
        extra_hours: existing.extra_hours,
      })
      setNotes(existing.notes ?? '')
    } else {
      setShifts(emptyShifts())
      setNotes('')
    }
  }

  function closeModal() {
    setModalEmp(null)
    setModalExisting(null)
  }

  // 即時試算（供 modal 顯示）
  const previewResult = modalEmp
    ? calcMonthlySalary(
        {
          base_salary: modalEmp.base_salary,
          license_fee: modalEmp.license_fee,
          labor_insurance: modalEmp.labor_insurance,
          health_insurance: modalEmp.health_insurance,
        },
        { year: selectedYear, month: selectedMonth, ...shifts }
      )
    : null

  async function handleSaveSchedule() {
    if (!modalEmp) return
    setSavingModal(true)
    setModalError('')
    const supabase = createClient()

    const result = calcMonthlySalary(
      {
        base_salary: modalEmp.base_salary,
        license_fee: modalEmp.license_fee,
        labor_insurance: modalEmp.labor_insurance,
        health_insurance: modalEmp.health_insurance,
      },
      { year: selectedYear, month: selectedMonth, ...shifts }
    )

    const payload = {
      branch_id: selectedBranch,
      employee_id: modalEmp.id,
      year: selectedYear,
      month: selectedMonth,
      ...shifts,
      monthly_standard_hours: result.monthly_standard_hours,
      total_work_hours: result.actual_hours,
      overtime_hours: result.overtime_hours,
      overtime_pay: result.overtime_pay,
      gross_salary: result.gross_salary,
      absence_deduction: result.absence_deduction,
      calculated_net: result.calculated_net,
      notes: notes || null,
    }

    const { error: err } = modalExisting
      ? await supabase.from('employee_monthly_schedules').update(payload).eq('id', modalExisting.id)
      : await supabase.from('employee_monthly_schedules').insert(payload)

    setSavingModal(false)
    if (err) { setModalError('儲存失敗：' + err.message); return }
    closeModal()
    router.refresh()
  }

  async function handleSaveActual() {
    setSavingActual(true)
    const supabase = createClient()
    for (const s of schedules) {
      const val = Number(actualPaid[s.id]) || 0
      if (val !== s.actual_paid) {
        await supabase.from('employee_monthly_schedules').update({ actual_paid: val }).eq('id', s.id)
      }
    }
    setSavingActual(false)
    setSavedActual(true)
    setTimeout(() => setSavedActual(false), 3000)
    router.refresh()
  }

  const hasSchedule = employees.some(e => scheduleMap[e.id])
  const totalCalculated = schedules.reduce((s, r) => s + r.calculated_net, 0)
  const totalActual = schedules.reduce((s, r) => s + (Number(actualPaid[r.id]) || r.actual_paid || 0), 0)
  const totalDiff = totalActual - totalCalculated

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
      </div>

      {employees.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-900">
          此分公司尚無員工，請先至「員工管理」新增員工
        </div>
      ) : (
        <>
          {/* 摘要卡（有班表資料才顯示） */}
          {hasSchedule && (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-700 mb-1">系統計算應發合計</div>
                <div className="text-xl font-bold text-blue-700 font-mono">{formatCurrency(totalCalculated)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-700 mb-1">實際發放合計</div>
                <div className="text-xl font-bold text-gray-800 font-mono">{formatCurrency(totalActual)}</div>
              </div>
              <div className={`border rounded-xl p-4 ${Math.abs(totalDiff) < 10 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-xs text-gray-700 mb-1">差異（實發 − 應發）</div>
                <div className={`text-xl font-bold font-mono ${Math.abs(totalDiff) < 10 ? 'text-green-700' : 'text-red-600'}`}>
                  {totalDiff >= 0 ? '+' : ''}{formatCurrency(totalDiff)}
                </div>
              </div>
            </div>
          )}

          {/* 員工核對表 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="font-semibold text-gray-800">{selectedYear} 年 {selectedMonth} 月薪資核對（當月標準工時：{getMonthlyStandard(selectedYear, selectedMonth)}h）</span>
              {hasSchedule && (
                <div className="flex items-center gap-3">
                  {savedActual && <span className="text-green-600 text-sm">✓ 已儲存</span>}
                  <button onClick={handleSaveActual} disabled={savingActual}
                    className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    {savingActual ? '儲存中...' : '儲存實發金額'}
                  </button>
                </div>
              )}
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
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium">實際工時</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium">加班費</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium">扣款</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium bg-blue-50">應發</th>
                    <th className="px-3 py-2.5 text-right text-gray-700 font-medium">實發</th>
                    <th className="px-3 py-2.5 text-center text-gray-700 font-medium">差異</th>
                    <th className="px-3 py-2.5 text-center text-gray-700 font-medium">班次</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => {
                    const s = scheduleMap[emp.id]
                    if (!s) {
                      return (
                        <tr key={emp.id} className="border-b border-gray-100 bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-700">{emp.name}</td>
                          <td colSpan={12} className="px-4 py-2.5 text-gray-800 text-xs">尚未輸入班表</td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => openModal(emp)}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium">輸入班次</button>
                          </td>
                        </tr>
                      )
                    }
                    const actual = Number(actualPaid[s.id]) || s.actual_paid || 0
                    const diff = actual - s.calculated_net
                    const match = actual > 0 && Math.abs(diff) < 10
                    const mismatch = actual > 0 && Math.abs(diff) >= 10
                    return (
                      <tr key={emp.id} className={`border-b border-gray-100 ${mismatch ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{emp.name}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_d || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_e || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_n || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_a || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-gray-700">{s.days_p || '-'}</td>
                        <td className="px-2 py-2.5 text-center text-red-600">{s.days_absent || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">{s.total_work_hours}h</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                          {s.overtime_pay > 0 ? formatCurrency(s.overtime_pay) : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-red-600">
                          {s.absence_deduction > 0 ? `−${formatCurrency(s.absence_deduction)}` : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-blue-800 bg-blue-50">
                          {formatCurrency(s.calculated_net)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <input type="number"
                            value={actualPaid[s.id] ?? ''}
                            onChange={e => setActualPaid(p => ({ ...p, [s.id]: e.target.value }))}
                            placeholder="輸入實發"
                            className="w-28 border border-gray-300 rounded px-2 py-1 text-right text-sm text-gray-900 font-mono" />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {actual === 0 ? (
                            <span className="text-gray-900 text-xs">未填</span>
                          ) : match ? (
                            <span className="text-green-600 text-xs font-medium">✓ 相符</span>
                          ) : (
                            <span className="text-red-600 text-xs font-medium">
                              {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => openModal(emp)}
                            className="text-gray-800 hover:text-blue-600 text-xs">編輯</button>
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

      {/* 班次輸入 Modal */}
      {modalEmp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                {modalEmp.name} — {selectedYear}/{selectedMonth} 班次輸入
              </h2>
              <button onClick={closeModal} className="text-gray-800 hover:text-gray-700 text-lg">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 班次輸入 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { key: 'days_d', label: 'D 班（8h）' },
                  { key: 'days_e', label: 'E 班（8h）' },
                  { key: 'days_n', label: 'N 班（11h）' },
                  { key: 'days_a', label: 'A 班（12h）' },
                  { key: 'days_p', label: 'P 班（12h）' },
                  { key: 'days_off', label: '休假天數' },
                  { key: 'days_sick', label: '病假天數' },
                  { key: 'days_absent', label: '曠職天數' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                    <input
                      type="number"
                      min="0"
                      value={shifts[key as keyof typeof shifts]}
                      onChange={e => setShifts(s => ({ ...s, [key]: Number(e.target.value) || 0 }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 text-center"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">備註</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="選填"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
              </div>

              {/* 即時試算 */}
              {previewResult && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-1.5">
                  <div className="font-semibold text-blue-800 mb-2">薪資試算（即時）</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                    <span>實際工時：</span>
                    <span className="font-mono text-right">{previewResult.actual_hours}h（標準 {previewResult.monthly_standard_hours}h）</span>
                    <span>加班時數：</span>
                    <span className="font-mono text-right">{previewResult.overtime_hours}h</span>
                    <span>加班費：</span>
                    <span className="font-mono text-right">{formatCurrency(previewResult.overtime_pay)}</span>
                    <span>証照費：</span>
                    <span className="font-mono text-right">{formatCurrency(modalEmp.license_fee)}</span>
                    <span>缺勤扣款：</span>
                    <span className="font-mono text-right text-red-600">−{formatCurrency(previewResult.absence_deduction)}</span>
                    <span>勞健保扣款：</span>
                    <span className="font-mono text-right text-red-600">−{formatCurrency(modalEmp.labor_insurance + modalEmp.health_insurance)}</span>
                  </div>
                  <div className="border-t border-blue-300 pt-2 mt-1 flex justify-between font-semibold text-blue-900">
                    <span>應發薪資：</span>
                    <span className="font-mono text-lg">{formatCurrency(previewResult.calculated_net)}</span>
                  </div>
                </div>
              )}

              {modalError && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{modalError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={handleSaveSchedule} disabled={savingModal}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingModal ? '儲存中...' : '儲存班次'}
              </button>
              <button onClick={closeModal}
                className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
