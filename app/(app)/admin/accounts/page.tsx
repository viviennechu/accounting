import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AccountsManager from '@/components/forms/AccountsManager'

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user!.id)
    .single()

  if (profile?.role === 'viewer') redirect('/dashboard')

  const isAdmin = profile?.role === 'admin'

  // admin 沒帶 branch 參數時，自動跳到第一間分公司
  if (isAdmin && !params.branch) {
    const { data: firstBranch } = await supabase
      .from('branches')
      .select('id')
      .order('name')
      .limit(1)
      .single()
    if (firstBranch) redirect(`/admin/accounts?branch=${firstBranch.id}`)
  }

  const branchId = params.branch || (!isAdmin ? profile?.branch_id : null)

  const { data: branches } = await supabase.from('branches').select('id, name')

  let accountQuery = supabase
    .from('accounts')
    .select('id, code, name, type, is_active')
    .order('code')

  if (branchId) accountQuery = accountQuery.eq('branch_id', branchId)

  const { data: accounts } = await accountQuery

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">科目代號管理</h1>
      <AccountsManager
        accounts={accounts || []}
        branches={branches || []}
        currentBranchId={branchId || ''}
        isAdmin={isAdmin}
      />
    </div>
  )
}
