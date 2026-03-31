// 班別工時定義
export const SHIFT_HOURS: Record<string, number> = { D: 8, E: 8, N: 11, A: 12, P: 12 }
export const SHIFT_NIGHT: Record<string, boolean> = { D: false, E: false, N: true, A: false, P: true }

export interface ScheduleInput {
  days_d: number
  days_e: number
  days_n: number
  days_a: number
  days_p: number
  days_absent: number
  extra_hours: number
}

export interface SalaryCalcResult {
  totalWorkHours: number
  overtimePay: number
  nightAllowance: number
  absenceDeduction: number
  gross: number
  net: number
}

function calcOvertimePayForShift(hourlyRate: number, totalHours: number): number {
  const ot1 = Math.min(Math.max(totalHours - 8, 0), 2)  // 8-10h: ×1.34
  const ot2 = Math.min(Math.max(totalHours - 10, 0), 2) // 10-12h: ×1.67
  return Math.round(ot1 * hourlyRate * 1.34 + ot2 * hourlyRate * 1.67)
}

export function calcMonthlySalary(
  baseSalary: number,
  nightShiftAllowance: number,
  laborInsurance: number,
  healthInsurance: number,
  schedule: ScheduleInput
): SalaryCalcResult {
  const hr = baseSalary / 240

  const shifts: Array<{ key: keyof ScheduleInput; shift: string }> = [
    { key: 'days_d', shift: 'D' },
    { key: 'days_e', shift: 'E' },
    { key: 'days_n', shift: 'N' },
    { key: 'days_a', shift: 'A' },
    { key: 'days_p', shift: 'P' },
  ]

  let overtimePay = 0
  let totalWorkHours = 0
  let nightDays = 0

  for (const { key, shift } of shifts) {
    const count = schedule[key] as number
    const hours = SHIFT_HOURS[shift]
    overtimePay += count * calcOvertimePayForShift(hr, hours)
    totalWorkHours += count * hours
    if (SHIFT_NIGHT[shift]) nightDays += count
  }

  // 額外加班（平日時數 ×1.34）
  overtimePay += Math.round(schedule.extra_hours * hr * 1.34)
  totalWorkHours += schedule.extra_hours

  const nightAllowance = nightDays * nightShiftAllowance
  const absenceDeduction = Math.round(baseSalary / 30) * schedule.days_absent
  const gross = baseSalary + overtimePay + nightAllowance
  const net = gross - absenceDeduction - laborInsurance - healthInsurance

  return {
    totalWorkHours,
    overtimePay: Math.round(overtimePay),
    nightAllowance: Math.round(nightAllowance),
    absenceDeduction: Math.round(absenceDeduction),
    gross: Math.round(gross),
    net: Math.round(net),
  }
}

export function calcHourlySalary(
  hourlyRate: number,
  schedule: ScheduleInput
): SalaryCalcResult {
  const totalWorkHours =
    schedule.days_d * 8 +
    schedule.days_e * 8 +
    schedule.days_n * 11 +
    schedule.days_a * 12 +
    schedule.days_p * 12 +
    schedule.extra_hours

  const net = Math.round(totalWorkHours * hourlyRate)

  return {
    totalWorkHours,
    overtimePay: 0,
    nightAllowance: 0,
    absenceDeduction: 0,
    gross: net,
    net,
  }
}
