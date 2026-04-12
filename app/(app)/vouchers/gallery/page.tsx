import { createClient } from '@/lib/supabase/server'
import FilterBar from '@/components/FilterBar'
import VoucherGallery from '@/components/VoucherGallery'
import Link from 'next/link'

export default async function VoucherGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; branch?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const now = new Date()
  const year = parseInt(params.year || String(now.getFullYear()))
  const month = parseInt(params.month || String(now.getMonth() + 1))
  const branchId = params.branch || (!isAdmin ? profile?.branch_id : null)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  let query = supabase
    .from('vouchers')
    .select(`
      id, date, description, attachment_url,
      branch:branches(name),
      voucher_lines(debit, credit, account:accounts(code, name))
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (branchId) query = query.eq('branch_id', branchId)

  const { data: vouchers } = await query
  const { data: branches } = await supabase.from('branches').select('id, name')

  const galleryData = (vouchers || []).map((v: any) => {
    const lines = v.voucher_lines || []
    const totalDebit = lines.reduce((s: number, l: any) => s + l.debit, 0)
    const codes = [...new Set(lines.map((l: any) => l.account?.code).filter(Boolean))].join('、')
    return {
      id: v.id,
      date: v.date,
      description: v.description,
      attachment_url: v.attachment_url,
      branch_name: (v.branch as any)?.name || null,
      total_amount: totalDebit,
      account_codes: codes,
    }
  })

  // CSV 下載網址
  const csvParams = new URLSearchParams({
    start: startDate,
    end: endDate,
    ...(branchId ? { branch: branchId } : {}),
  })

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">發票瀏覽器</h1>
          <p className="text-sm text-gray-800 mt-1">{year}年{month}月　共 {galleryData.length} 筆</p>
        </div>
        <a
          href={`/api/reports/export-csv?${csvParams}`}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          ⬇️ 匯出 CSV
        </a>
      </div>

      <FilterBar
        year={year}
        month={month}
        branchId={params.branch || ''}
        branches={branches || []}
        showMonth
        showBranch={isAdmin}
      />

      <VoucherGallery vouchers={galleryData} showBranch={isAdmin} />
    </div>
  )
}
