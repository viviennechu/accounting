import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomFieldsManager from '@/components/admin/CustomFieldsManager'

export default async function CustomFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .order('name')

  if (!branches || branches.length === 0) redirect('/dashboard')

  const branchId = params.branch || branches[0].id
  const branch = branches.find(b => b.id === branchId) || branches[0]

  const { data: fields } = await supabase
    .from('custom_field_definitions')
    .select('id, label, field_type, options, required, field_order')
    .eq('branch_id', branch.id)
    .order('field_order')

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">自訂欄位管理</h1>
        <p className="text-sm text-gray-600 mt-1">為各分公司設定填傳票時的額外欄位（如廠商、發票號碼等）</p>
      </div>

      {/* 分公司切換 */}
      <div className="flex gap-2 flex-wrap">
        {branches.map(b => (
          <a
            key={b.id}
            href={`/admin/custom-fields?branch=${b.id}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              b.id === branch.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {b.name}
          </a>
        ))}
      </div>

      <CustomFieldsManager
        branchId={branch.id}
        branchName={branch.name}
        initialFields={fields || []}
      />
    </div>
  )
}
