export type UserRole = 'admin' | 'accountant' | 'viewer'

export type AccountType = 'revenue' | 'cost' | 'expense' | 'asset' | 'liability' | 'other_income' | 'other_loss'

export interface Branch {
  id: string
  name: string
  code: string
  created_at: string
}

export interface Profile {
  id: string
  branch_id: string | null
  role: UserRole
  name: string
  created_at: string
  branch?: Branch
}

export interface Account {
  id: string
  branch_id?: string
  code: string
  name: string
  type: AccountType
  is_active?: boolean
}

export interface VoucherLine {
  id: string
  voucher_id: string
  account_id: string
  debit: number
  credit: number
  note: string | null
  line_order: number
  account?: Account
}

export interface Voucher {
  id: string
  branch_id: string
  voucher_no: string | null
  date: string
  description: string | null
  attachment_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  branch?: Branch
  voucher_lines?: VoucherLine[]
}

// 年度總表用的彙整資料
export interface MonthlySummaryRow {
  account_code: string
  account_name: string
  account_type: AccountType
  monthly: Record<number, number>  // month -> net amount
  total: number
  average: number
  benchmark?: number  // 其他機構同期
}

// 住民
export interface Resident {
  id: string
  branch_id: string
  name: string
  admission_date: string
  discharge_date?: string | null
  resident_type: 'monthly_fee' | 'social_welfare'
  monthly_fee: number | null
  welfare_amount: number | null
  welfare_type: 'disability' | 'homeless' | null
  welfare_doc_no: string | null
  nhi_identity: string | null
  notes?: string | null
  is_active: boolean
  created_at: string
}

// 健保點值
export interface NhiPointValue {
  id: string
  year: number
  quarter: number
  point_value: number
}

// 健保申報記錄
export interface NhiClaim {
  id: string
  branch_id: string
  service_year: number
  service_month: number
  total_points: number
  submitted_at?: string | null
  expected_amount?: number | null
  received_amount?: number | null
  received_at?: string | null
  voucher_id?: string | null
  notes?: string | null
  created_at: string
}

// 住民月費記錄
export interface ResidentMonthlyFee {
  id: string
  branch_id: string
  resident_id: string
  year: number
  month: number
  nhi_points: number
  nhi_amount: number
  self_pay: number
  subsidy_amount: number
  self_pay_paid_at?: string | null
  notes?: string | null
  resident?: Resident
}

// 員工
export interface Employee {
  id: string
  branch_id: string
  name: string
  title?: string | null
  employee_type: 'monthly' | 'hourly'
  base_salary: number
  hourly_rate: number
  night_shift_allowance: number
  labor_insurance: number
  health_insurance: number
  is_active: boolean
  created_at: string
  branch?: Branch
}

// 員工月班表暨薪資
export interface EmployeeMonthlySchedule {
  id: string
  branch_id: string
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
  notes?: string | null
  employee?: Employee
}

// OCR 解析結果
export interface OcrResult {
  date: string | null
  amount: number | null
  description: string | null
  suggested_account_code: string | null
  is_debit: boolean  // true=借方(支出), false=貸方(收入)
  confidence: 'high' | 'medium' | 'low'
}
