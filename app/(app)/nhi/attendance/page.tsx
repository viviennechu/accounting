import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AttendanceForm from './AttendanceForm'

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; branch?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user!.id).single()

  if (profile?.role === 'viewer') redirect('/dashboard')

  const params = await searchParams
  const now = new Date()
  const year = Number(params.year) || now.getFullYear()
  const month = Number(params.month) || now.getMonth() + 1
  const isAdmin = profile?.role === 'admin'

  const { data: branches } = await supabase.from('branches').select('id, name')
  const branchId = params.branch || profile?.branch_id || ''

  // 取得該分公司在籍住民（含每日費率）
  const { data: residents } = await supabase
    .from('residents')
    .select('id, name, subsidy_type, daily_self_pay, daily_subsidy_rate')
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name')

  // 取得本月已有的出席記錄
  const { data: existing } = await supabase
    .from('resident_monthly_attendance')
    .select('*')
    .eq('branch_id', branchId)
    .eq('year', year)
    .eq('month', month)

  const daysInMonth = new Date(year, month, 0).getDate()

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">每月出席登錄</h1>
        <p className="text-gray-600 text-sm mt-1">登錄每位住民當月實際在院天數，系統自動計算補助與自付額</p>
      </div>

      <AttendanceForm
        year={year}
        month={month}
        daysInMonth={daysInMonth}
        branchId={branchId}
        branches={branches || []}
        isAdmin={isAdmin}
        residents={residents || []}
        existing={existing || []}
      />
    </div>
  )
}
