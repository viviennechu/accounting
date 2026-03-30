'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResidentActions({ residentId, residentName }: { residentId: string; residentName: string }) {
  const router = useRouter()

  async function handleDischarge() {
    if (!confirm(`確認將「${residentName}」標記為離院？`)) return
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('residents').update({ is_active: false, discharge_date: today }).eq('id', residentId)
    router.refresh()
  }

  return (
    <div className="flex gap-2 justify-center">
      <Link href={`/residents/${residentId}/edit`} className="text-xs text-blue-600 hover:underline">編輯</Link>
      <button onClick={handleDischarge} className="text-xs text-red-500 hover:underline">離院</button>
    </div>
  )
}
