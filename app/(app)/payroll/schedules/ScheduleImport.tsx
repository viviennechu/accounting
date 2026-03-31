'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calcMonthlySalary, calcHourlySalary, SHIFT_HOURS } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

interface Employee {
  id: string
  name: string
  employee_type: 'monthly' | 'hourly'
  base_salary: number
  hourly_rate: number
  night_shift_allowance: number
  labor_insurance: number
  health_insurance: number
}

interface ScheduleRow {
  employee_id: string
  days_d: number
  days_e: number
  days_n: number
  days_a: number
  days_p: number
  days_off: number
  days_sick: number
  days_absent: number
  extra_hours: number
  // calculated
  total_work_hours: number
  overtime_pay: number
  night_allowance: number
  gross_salary: number
  absence_deduction: number
  calculated_net: number
}

interface Props {
  year: number
  month: number
  branchId: string
  branches: { id: string; name: string }[]
  isAdmin: boolean
  employees: Employee[]
  existing: any[]
}

const SHIFT_COLS = ['D', 'E', 'N', 'A', 'P', 'off', '病', '喪'] as const

export default function ScheduleImport({ year, month, branchId, branches, isAdmin, employees, existing }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const initRows = (): ScheduleRow[] => employees.map(emp => {
    const ex = existing.find(e => e.employee_id === emp.id)
    if (ex) {
      return {
        employee_id: emp.id,
        days_d: ex.days_d, days_e: ex.days_e, days_n: ex.days_n,
        days_a: ex.days_a, days_p: ex.days_p, days_off: ex.days_off,
        days_sick: ex.days_sick, days_absent: ex.days_absent,
        extra_hours: ex.extra_hours,
        total_work_hours: ex.total_work_hours, overtime_pay: ex.overtime_pay,
        night_allowance: ex.night_allowance, gross_salary: ex.gross_salary,
        absence_deduction: ex.absence_deduction, calculated_net: ex.calculated_net,
      }
    }
    return {
      employee_id: emp.id,
      days_d: 0, days_e: 0, days_n: 0, days_a: 0, days_p: 0,
      days_off: 0, days_sick: 0, days_absent: 0, extra_hours: 0,
      total_work_hours: 0, overtime_pay: 0, night_allowance: 0,
      gross_salary: 0, absence_deduction: 0, calculated_net: 0,
    }
  })

  const [rows, setRows] = useState<ScheduleRow[]>(initRows)
  const [selectedYear, setSelectedYear] = useState(year)
  const [selectedMonth, setSelectedMonth] = useState(month)
  const [selectedBranch, setSelectedBranch] = useState(branchId)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [importError, setImportError] = useState('')

  function calcRow(emp: Employee, row: ScheduleRow): ScheduleRow {
    const schedule = {
      days_d: row.days_d, days_e: row.days_e, days_n: row.days_n,
      days_a: row.days_a, days_p: row.days_p, days_absent: row.days_absent,
      extra_hours: row.extra_hours,
    }
    const result = emp.employee_type === 'monthly'
      ? calcMonthlySalary(emp.base_salary, emp.night_shift_allowance, emp.labor_insurance, emp.health_insurance, schedule)
      : calcHourlySalary(emp.hourly_rate, schedule)

    return {
      ...row,
      total_work_hours: result.totalWorkHours,
      overtime_pay: result.overtimePay,
      night_allowance: result.nightAllowance,
      gross_salary: result.gross,
      absence_deduction: result.absenceDeduction,
      calculated_net: result.net,
    }
  }

  function updateRow(idx: number, field: keyof ScheduleRow, value: number) {
    const emp = employees[idx]
    const updated = [...rows]
    updated[idx] = calcRow(emp, { ...updated[idx], [field]: value })
    setRows(updated)
  }

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')

    try {
      const xlsx = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = xlsx.read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1 })

      if (!data || data.length < 2) {
        setImportError('Excel 格式不正確，請使用範本格式')
        return
      }

      // 第一行是標題，第二行起是資料
      // 格式：姓名, 1, 2, 3, ... (各日班別代碼)
      const updated = [...rows]
      let matched = 0

      for (let ri = 1; ri < data.length; ri++) {
        const row = data[ri]
        if (!row || !row[0]) continue
        const empName = String(row[0]).trim()
        const empIdx = employees.findIndex(e => e.name === empName)
        if (empIdx === -1) continue

        matched++
        const counts: Record<string, number> = { D: 0, E: 0, N: 0, A: 0, P: 0, off: 0, 病: 0, 喪: 0 }
        for (let ci = 1; ci < row.length; ci++) {
          const cell = String(row[ci] || '').trim().toUpperCase()
          if (cell === 'D') counts['D']++
          else if (cell === 'E') counts['E']++
          else if (cell === 'N') counts['N']++
          else if (cell === 'A') counts['A']++
          else if (cell === 'P') counts['P']++
          else if (cell === 'OFF' || cell === '休' || cell === '假') counts['off']++
          else if (cell === '病') counts['病']++
          else if (cell === '喪') counts['喪']++
        }

        const emp = employees[empIdx]
        updated[empIdx] = calcRow(emp, {
          ...updated[empIdx],
          days_d: counts['D'], days_e: counts['E'], days_n: counts['N'],
          days_a: counts['A'], days_p: counts['P'], days_off: counts['off'],
          days_sick: counts['病'], days_absent: counts['喪'],
        })
      }

      if (matched === 0) {
        setImportError('找不到匹配的員工姓名，請確認 Excel 第一欄是員工姓名')
        return
      }
      setRows(updated)
      setImportError(`已匯入 ${matched} 位員工班表`)
    } catch {
      setImportError('讀取 Excel 失敗，請確認檔案格式')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSave() {
    if (!selectedBranch) return
    setSaving(true)
    const supabase = createClient()

    const payload = rows.map(row => ({
      branch_id: selectedBranch,
      employee_id: row.employee_id,
      year: selectedYear,
      month: selectedMonth,
      days_d: row.days_d, days_e: row.days_e, days_n: row.days_n,
      days_a: row.days_a, days_p: row.days_p, days_off: row.days_off,
      days_sick: row.days_sick, days_absent: row.days_absent,
      extra_hours: row.extra_hours,
      total_work_hours: row.total_work_hours,
      overtime_pay: row.overtime_pay,
      night_allowance: row.night_allowance,
      gross_salary: row.gross_salary,
      absence_deduction: row.absence_deduction,
      calculated_net: row.calculated_net,
    }))

    const { error } = await supabase
      .from('employee_monthly_schedules')
      .upsert(payload, { onConflict: 'employee_id,year,month' })

    setSaving(false)
    if (error) { alert('儲存失敗：' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    router.refresh()
  }

  function navigate() {
    const params = new URLSearchParams({ year: String(selectedYear), month: String(selectedMonth), branch: selectedBranch })
    router.push(`/payroll/schedules?${params}`)
  }

  function downloadTemplate() {
    import('xlsx').then(xlsx => {
      const headers = ['姓名', ...Array.from({ length: 31 }, (_, i) => String(i + 1))]
      const sampleRow = employees.length > 0
        ? [employees[0].name, ...Array(31).fill('D')]
        : ['員工姓名範例', ...Array(31).fill('D')]
      const ws = xlsx.utils.aoa_to_sheet([headers, sampleRow])
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, '班表')
      xlsx.writeFile(wb, `班表範本_${selectedYear}_${selectedMonth}.xlsx`)
    })
  }

  const totalNet = rows.reduce((s, r) => s + r.calculated_net, 0)

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
        <button onClick={downloadTemplate}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
          下載班表範本
        </button>
        <label className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors cursor-pointer">
          上傳 Excel 班表
          <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleExcelImport} className="hidden" />
        </label>
      </div>

      {importError && (
        <div className={`px-4 py-3 rounded-lg text-sm ${importError.startsWith('已匯入') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {importError}
        </div>
      )}

      {employees.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">
          此分公司尚無在職員工，請先至「員工管理」新增員工
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-800">{selectedYear} 年 {selectedMonth} 月班表</span>
              <span className="ml-2 text-xs text-gray-500">{employees.length} 位員工</span>
            </div>
            <div className="flex items-center gap-3">
              {saved && <span className="text-green-600 text-sm">✓ 已儲存</span>}
              <button onClick={handleSave} disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? '儲存中...' : '儲存班表'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-gray-700 font-medium sticky left-0 bg-gray-50">員工</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-14">D班</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-14">E班</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-14">N班</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-14">A班</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-14">P班</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-14">休假</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-14">病假</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-14">缺勤</th>
                  <th className="px-2 py-2.5 text-center text-gray-700 font-medium w-16">加班時數</th>
                  <th className="px-3 py-2.5 text-right text-gray-700 font-medium w-24">加班費</th>
                  <th className="px-3 py-2.5 text-right text-gray-700 font-medium w-24">夜班津貼</th>
                  <th className="px-3 py-2.5 text-right text-gray-700 font-medium w-24">缺勤扣款</th>
                  <th className="px-3 py-2.5 text-right text-gray-700 font-medium w-28 bg-blue-50">應發薪資</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const emp = employees[idx]
                  return (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 sticky left-0 bg-white">
                        <div className="font-medium text-gray-900">{emp.name}</div>
                        <div className="text-xs text-gray-500">{emp.employee_type === 'monthly' ? `月薪 ${formatCurrency(emp.base_salary)}` : `時薪 ${emp.hourly_rate}`}</div>
                      </td>
                      {(['days_d', 'days_e', 'days_n', 'days_a', 'days_p', 'days_off', 'days_sick', 'days_absent'] as const).map(field => (
                        <td key={field} className="px-2 py-2 text-center">
                          <input type="number" value={row[field]}
                            onChange={e => updateRow(idx, field, Number(e.target.value))}
                            min="0" max="31"
                            className="w-12 border border-gray-300 rounded px-1 py-1 text-center text-sm text-gray-900" />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <input type="number" value={row.extra_hours}
                          onChange={e => updateRow(idx, 'extra_hours', Number(e.target.value))}
                          min="0" step="0.5"
                          className="w-14 border border-gray-300 rounded px-1 py-1 text-center text-sm text-gray-900" />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.overtime_pay > 0 ? formatCurrency(row.overtime_pay) : '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{row.night_allowance > 0 ? formatCurrency(row.night_allowance) : '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-red-600">{row.absence_deduction > 0 ? `−${formatCurrency(row.absence_deduction)}` : '-'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-blue-800 bg-blue-50">{formatCurrency(row.calculated_net)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-gray-800" colSpan={13}>合計薪資</td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-900 text-base">{formatCurrency(totalNet)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 班別說明 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">班別工時說明</p>
        <div className="flex gap-4 text-xs text-gray-600">
          <span>D班 09-17（8h）</span>
          <span>E班 14-22（8h）</span>
          <span>N班 22-09（11h，有夜班津貼）</span>
          <span>A班 09-21（12h）</span>
          <span>P班 21-09（12h，有夜班津貼）</span>
        </div>
      </div>
    </div>
  )
}
