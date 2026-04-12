import { createClient } from '@/lib/supabase/server'
import BatchInvoiceUpload from '@/components/forms/BatchInvoiceUpload'

export default async function BatchVoucherPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  let accountQuery = supabase
    .from('accounts')
    .select('id, code, name, type, branch_id')
    .neq('is_active', false)
    .order('code')

  if (!isAdmin && profile?.branch_id) {
    accountQuery = accountQuery.eq('branch_id', profile.branch_id)
  }

  const { data: accounts } = await accountQuery

  const { data: branches } = isAdmin
    ? await supabase.from('branches').select('id, name')
    : { data: null }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">批次上傳憑證</h1>
      <p className="text-sm text-gray-800 mb-6">一張照片包含多張發票？上傳後 AI 自動辨識每一張，逐一確認後一次儲存</p>
      <BatchInvoiceUpload
        accounts={accounts || []}
        branches={branches || []}
        defaultBranchId={profile?.branch_id || ''}
        isAdmin={isAdmin}
      />
    </div>
  )
}
