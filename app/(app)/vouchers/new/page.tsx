import { createClient } from '@/lib/supabase/server'
import SimpleVoucherForm from '@/components/forms/SimpleVoucherForm'

export default async function NewVoucherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // 取得科目清單（含 branch_id 以便前端過濾）
  let accountQuery = supabase
    .from('accounts')
    .select('id, code, name, type, branch_id')
    .eq('is_active', true)
    .order('code')

  if (!isAdmin && profile?.branch_id) {
    accountQuery = accountQuery.eq('branch_id', profile.branch_id)
  }

  const { data: accounts } = await accountQuery

  // Admin 取得分公司清單
  const { data: branches } = isAdmin
    ? await supabase.from('branches').select('id, name')
    : { data: null }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增傳票</h1>
      <SimpleVoucherForm
        accounts={accounts || []}
        branches={branches || []}
        defaultBranchId={profile?.branch_id || ''}
        isAdmin={isAdmin}
      />
    </div>
  )
}
