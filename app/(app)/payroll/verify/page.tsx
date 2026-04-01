import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PayrollVerify from './PayrollVerify'

export default async function PayrollVerifyPage({
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

  // 該分公司所有在職員工
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name, title, base_salary, license_fee, labor_insurance, health_insurance')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name')

  // 該月已有的班表記錄
  const { data: schedules } = await supabase
    .from('employee_monthly_schedules')
    .select('*')
    .eq('branch_id', branchId)
    .eq('year', year)
    .eq('month', month)

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">薪資核對</h1>
        <p className="text-gray-600 text-sm mt-1">核對計算薪資與實際發放金額</p>
      </div>

      <PayrollVerify
        year={year}
        month={month}
        branchId={branchId}
        branches={branches || []}
        isAdmin={isAdmin}
        employees={employees || []}
        schedules={schedules || []}
      />
    </div>
  )
}
