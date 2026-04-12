import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditVoucherForm from '@/components/forms/EditVoucherForm'

export default async function EditVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const { data: voucher } = await supabase
    .from('vouchers')
    .select(`id, date, voucher_no, description, attachment_url, branch_id,
      voucher_lines(id, account_id, debit, credit, note, line_order, account:accounts(code, name, type))`)
    .eq('id', id)
    .single()

  if (!voucher) notFound()

  let accountQuery = supabase
    .from('accounts')
    .select('id, code, name, type, branch_id')
    .neq('is_active', false)
    .order('code')

  if (!isAdmin && profile?.branch_id) {
    accountQuery = accountQuery.eq('branch_id', profile.branch_id)
  }

  const { data: accounts } = await accountQuery

  const lines = ((voucher.voucher_lines as any[]) || [])
    .sort((a, b) => a.line_order - b.line_order)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <a href={`/vouchers/${id}`} className="text-gray-800 hover:text-gray-700">← 返回</a>
        <h1 className="text-xl font-bold text-gray-800">編輯傳票</h1>
      </div>
      <EditVoucherForm
        voucher={voucher as any}
        lines={lines}
        accounts={accounts || []}
        isAdmin={isAdmin}
      />
    </div>
  )
}
