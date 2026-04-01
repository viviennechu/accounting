// 115年（2026年）台灣行事曆各月標準工時
const MONTHLY_STANDARDS: Record<number, Record<number, number>> = {
  2026: {
    1: 168, 2: 112, 3: 176, 4: 160, 5: 160, 6: 168,
    7: 184, 8: 168, 9: 160, 10: 160, 11: 168, 12: 176,
  },
}

export function getMonthlyStandard(year: number, month: number): number {
  return MONTHLY_STANDARDS[year]?.[month] ?? 176
}

export interface PayrollInput {
  year: number
  month: number
  days_d: number
  days_e: number
  days_n: number
  days_a: number
  days_p: number
  days_absent: number
}

export interface PayrollResult {
  actual_hours: number
  monthly_standard_hours: number
  overtime_hours: number
  overtime_pay: number
  absence_deduction: number
  gross_salary: number
  calculated_net: number
}

export function calcMonthlySalary(
  employee: {
    base_salary: number
    license_fee: number
    labor_insurance: number
    health_insurance: number
  },
  schedule: PayrollInput
): PayrollResult {
  const { base_salary, license_fee, labor_insurance, health_insurance } = employee
  const { year, month, days_d, days_e, days_n, days_a, days_p, days_absent } = schedule

  // Step 1: 月實際工時
  const actual_hours = days_d * 8 + days_e * 8 + days_n * 11 + days_a * 12 + days_p * 12

  // Step 2: 當月標準工時
  const monthly_standard_hours = getMonthlyStandard(year, month)

  // Step 3: 加班時數（月總時數超過標準才算）
  const overtime_hours = Math.max(0, actual_hours - monthly_standard_hours)

  // Step 4: 加班費（1.34× 池 = 各延長班每班最多 2h，超出用 1.67×）
  const ot1_pool = days_n * 2 + days_a * 2 + days_p * 2
  const ot1_hours = Math.min(overtime_hours, ot1_pool)
  const ot2_hours = Math.max(0, overtime_hours - ot1_hours)
  const hr = base_salary / 240
  const overtime_pay = Math.round(ot1_hours * hr * 1.34 + ot2_hours * hr * 1.67)

  // Step 5: 缺勤扣款
  const absence_deduction = Math.round(base_salary / 30) * days_absent

  // Step 6: 應發與實發
  const gross_salary = base_salary + license_fee + overtime_pay
  const calculated_net = gross_salary - absence_deduction - labor_insurance - health_insurance

  return {
    actual_hours,
    monthly_standard_hours,
    overtime_hours,
    overtime_pay,
    absence_deduction,
    gross_salary,
    calculated_net,
  }
}
