import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ScheduleImport from './ScheduleImport'

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user!.id).single()

  if (profile?.role === 'viewer') redirect('/dashboard')

  const isAdmin = profile?.role === 'admin'
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year) || now.getFullYear()
  const month = Number(params.month) || now.getMonth() + 1
  const branchId = params.branch || profile?.branch_id || ''

  const { data: branches } = await supabase.from('branches').select('id, name')

  let empQuery = supabase
    .from('employees')
    .select('id, name, employee_type, base_salary, hourly_rate, night_shift_allowance, labor_insurance, health_insurance')
    .eq('is_active', true)
    .order('name')

  if (branchId) empQuery = empQuery.eq('branch_id', branchId)

  const { data: employees } = await empQuery

  // 已有的班表記錄
  const { data: existing } = await supabase
    .from('employee_monthly_schedules')
    .select('*')
    .eq('branch_id', branchId)
    .eq('year', year)
    .eq('month', month)

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">班表上傳</h1>
        <p className="text-gray-600 text-sm mt-1">上傳 Excel 班表，系統自動計算薪資</p>
      </div>

      <ScheduleImport
        year={year}
        month={month}
        branchId={branchId}
        branches={branches || []}
        isAdmin={isAdmin}
        employees={employees || []}
        existing={existing || []}
      />
    </div>
  )
}
