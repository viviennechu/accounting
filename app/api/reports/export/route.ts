import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAnnualExcel } from '@/lib/excel'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const branchId = searchParams.get('branch')
  const format = searchParams.get('format') || 'excel'

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id, branch:branches(name)')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const effectiveBranchId = branchId || (!isAdmin ? profile?.branch_id : null)
  const branchName = isAdmin && !branchId ? '所有分公司' : (profile?.branch as any)?.name || '分公司'

  // 取得傳票分錄
  let query = supabase
    .from('voucher_lines')
    .select(`
      debit, credit,
      account:accounts(code, name, type),
      voucher:vouchers(date, branch_id)
    `)
    .gte('voucher.date', `${year}-01-01`)
    .lte('voucher.date', `${year}-12-31`)

  const { data: lines } = await query

  // 彙整
  type SummaryRow = {
    code: string; name: string; type: string
    monthly: Record<number, number>; total: number; average: number
  }
  const summaryMap: Record<string, SummaryRow> = {}

  for (const line of (lines || [])) {
    const voucher = line.voucher as any
    const account = line.account as any
    if (!account || !voucher) continue
    if (effectiveBranchId && voucher.branch_id !== effectiveBranchId) continue

    const month = new Date(voucher.date).getMonth() + 1
    const key = account.code

    if (!summaryMap[key]) {
      summaryMap[key] = { code: account.code, name: account.name, type: account.type, monthly: {}, total: 0, average: 0 }
    }

    const net = (account.type === 'revenue' || account.type === 'other_income')
      ? (line.credit - line.debit)
      : (line.debit - line.credit)

    summaryMap[key].monthly[month] = (summaryMap[key].monthly[month] || 0) + net
    summaryMap[key].total += net
  }

  const rows = Object.values(summaryMap)
    .map(r => ({ ...r, average: Math.round(r.total / 12), account_type: r.type as any, account_code: r.code, account_name: r.name }))
    .sort((a, b) => a.code.localeCompare(b.code))

  const excelBuffer = generateAnnualExcel(branchName, year, rows)
  const buffer = Buffer.from(excelBuffer)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${branchName}_${year}年度總表.xlsx"`,
    },
  })
}
