import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeeManager from './EmployeeManager'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user!.id).single()

  if (profile?.role === 'viewer') redirect('/dashboard')

  const isAdmin = profile?.role === 'admin'
  const { data: branches } = await supabase.from('branches').select('id, name')

  let query = supabase
    .from('employees')
    .select('*, branch:branches(id, name)')
    .eq('is_active', true)
    .order('name')

  if (!isAdmin) {
    query = query.eq('branch_id', profile?.branch_id ?? '')
  }

  const { data: employees } = await query

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">員工管理</h1>
        <p className="text-gray-900 text-sm mt-1">管理員工基本資料、薪資設定</p>
      </div>

      <EmployeeManager
        employees={employees || []}
        branches={branches || []}
        defaultBranchId={profile?.branch_id || ''}
        isAdmin={isAdmin}
      />
    </div>
  )
}
