import { createClient } from '@/lib/supabase/server'
import NewClaimForm from './NewClaimForm'

export default async function NewClaimPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin'
  const { data: branches } = await supabase.from('branches').select('id, name')
  const { data: pointValues } = await supabase.from('nhi_point_values').select('*')

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">新增健保申報</h1>
      <NewClaimForm
        branches={branches || []}
        defaultBranchId={profile?.branch_id || ''}
        isAdmin={isAdmin}
        pointValues={pointValues || []}
      />
    </div>
  )
}
