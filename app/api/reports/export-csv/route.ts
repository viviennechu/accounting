import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') || `${new Date().getFullYear()}-01-01`
  const end = searchParams.get('end') || `${new Date().getFullYear()}-12-31`
  const branchId = searchParams.get('branch')
  const accountCode = searchParams.get('account')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const effectiveBranchId = branchId || (!isAdmin ? profile?.branch_id : null)

  let query = supabase
    .from('voucher_lines')
    .select(`
      debit, credit, note,
      account:accounts(code, name, type),
      voucher:vouchers(id, date, description, branch_id, branch:branches(name))
    `)
    .gte('voucher.date', start)
    .lte('voucher.date', end)
    .order('voucher.date', { ascending: true })

  const { data: lines } = await query

  const filtered = (lines || []).filter((l: any) => {
    const v = l.voucher
    if (!v) return false
    if (effectiveBranchId && v.branch_id !== effectiveBranchId) return false
    if (accountCode && l.account?.code !== accountCode) return false
    return true
  })

  // 建立 CSV
  const headers = ['日期', '分公司', '科目代號', '科目名稱', '借方', '貸方', '摘要', '傳票ID']
  const rows = filtered.map((l: any) => [
    l.voucher?.date || '',
    (l.voucher?.branch as any)?.name || '',
    l.account?.code || '',
    l.account?.name || '',
    l.debit > 0 ? l.debit : '',
    l.credit > 0 ? l.credit : '',
    `"${(l.note || l.voucher?.description || '').replace(/"/g, '""')}"`,
    l.voucher?.id || '',
  ])

  const csv = [
    headers.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\n')

  const bom = '\uFEFF' // 讓 Excel 正確顯示中文
  const filename = `傳票明細_${start}_${end}.csv`

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
