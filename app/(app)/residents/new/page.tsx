import { createClient } from '@/lib/supabase/server'
import ResidentForm from '../ResidentForm'

export default async function NewResidentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin'
  const { data: branches } = await supabase.from('branches').select('id, name')

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增住民</h1>
      <ResidentForm
        branches={branches || []}
        defaultBranchId={profile?.branch_id || ''}
        isAdmin={isAdmin}
      />
    </div>
  )
}
