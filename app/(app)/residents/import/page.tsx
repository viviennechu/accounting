import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResidentImport from './ResidentImport'

export default async function ResidentImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user!.id).single()

  if (profile?.role === 'viewer') redirect('/residents')

  const isAdmin = profile?.role === 'admin'
  const { data: branches } = await supabase.from('branches').select('id, name')

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">批次匯入住民</h1>
        <p className="text-gray-900 text-sm mt-1">上傳 Excel 檔案，一次新增多位住民</p>
      </div>
      <ResidentImport
        branches={branches || []}
        defaultBranchId={profile?.branch_id || ''}
        isAdmin={isAdmin}
      />
    </div>
  )
}
