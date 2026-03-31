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

  const { data: schedules } = await supabase
    .from('employee_monthly_schedules')
    .select('*, employee:employees(id, name, employee_type, base_salary, hourly_rate)')
    .eq('branch_id', branchId)
    .eq('year', year)
    .eq('month', month)
    .order('employee(name)')

  // 找薪資用科目（借：6010，貸：2140）
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code, name')
    .eq('branch_id', branchId)
    .in('code', ['6010', '2140'])

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">薪資核對</h1>
        <p className="text-gray-600 text-sm mt-1">核對計算薪資與實際發放，產生薪資傳票</p>
      </div>

      <PayrollVerify
        year={year}
        month={month}
        branchId={branchId}
        branches={branches || []}
        isAdmin={isAdmin}
        schedules={schedules || []}
        accounts={accounts || []}
      />
    </div>
  )
}
