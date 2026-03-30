'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  residentId: string
  branchId: string
  year: number
  month: number
  selfPay: number
  feeId?: string
}

export default function MarkPaidButton({ residentId, branchId, year, month, selfPay, feeId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleMark() {
    setLoading(true)
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    if (feeId) {
      await supabase.from('resident_monthly_fees').update({ self_pay_paid_at: today }).eq('id', feeId)
    } else {
      await supabase.from('resident_monthly_fees').insert({
        branch_id: branchId,
        resident_id: residentId,
        year,
        month,
        self_pay: selfPay,
        self_pay_paid_at: today,
        nhi_points: 0,
        nhi_amount: 0,
        subsidy_amount: 0,
      })
    }

    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleMark}
      disabled={loading}
      className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
    >
      {loading ? '...' : '標記已收'}
    </button>
  )
}
