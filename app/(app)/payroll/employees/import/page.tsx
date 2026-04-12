import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeeImport from './EmployeeImport'

export default async function EmployeeImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user!.id)
    .single()

  if (profile?.role === 'viewer') redirect('/dashboard')

  const isAdmin = profile?.role === 'admin'
  const { data: branches } = await supabase.from('branches').select('id, name')

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">員工資料批次匯入</h1>
        <p className="text-gray-900 text-sm mt-1">透過 Excel 範本一次匯入多位員工</p>
      </div>

      <EmployeeImport
        branches={branches || []}
        defaultBranchId={profile?.branch_id || ''}
        isAdmin={isAdmin}
      />
    </div>
  )
}
