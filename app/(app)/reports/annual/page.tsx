import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import FilterBar from '@/components/FilterBar'

const TYPE_LABELS: Record<string, string> = {
  revenue: '營業收入',
  cost: '營業成本',
  expense: '營業費用',
  other_income: '業外收益',
  other_loss: '業外損失',
}

const TYPE_ORDER = ['revenue', 'cost', 'expense', 'other_income', 'other_loss']

export default async function AnnualReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; branch?: string }>
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
  const year = parseInt(params.year || String(new Date().getFullYear()))
  const branchId = params.branch || (!isAdmin ? profile?.branch_id : null)

  const { data: branches } = await supabase.from('branches').select('id, name')
  const currentBranch = branches?.find(b => b.id === branchId)

  // 查詢該年度所有傳票分錄
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

  // 篩選分公司並彙整
  type SummaryMap = Record<string, {
    code: string; name: string; type: string;
    monthly: Record<number, number>
  }>

  const summary: SummaryMap = {}

  for (const line of (lines || [])) {
    const voucher = line.voucher as any
    const account = line.account as any
    if (!account || !voucher) continue
    if (branchId && voucher.branch_id !== branchId) continue

    const date = new Date(voucher.date)
    const month = date.getMonth() + 1
    const key = account.code

    if (!summary[key]) {
      summary[key] = { code: account.code, name: account.name, type: account.type, monthly: {} }
    }

    // 根據科目類型計算淨額
    const net = (account.type === 'revenue' || account.type === 'other_income')
      ? (line.credit - line.debit)  // 收入：貸方-借方
      : (line.debit - line.credit)  // 支出：借方-貸方

    summary[key].monthly[month] = (summary[key].monthly[month] || 0) + net
  }

  const rows = Object.values(summary).sort((a, b) => a.code.localeCompare(b.code))

  // 計算各類型小計
  function subtotal(type: string, month?: number) {
    const typeRows = rows.filter(r => r.type === type)
    if (month !== undefined) {
      return typeRows.reduce((sum, r) => sum + (r.monthly[month] || 0), 0)
    }
    return typeRows.reduce((sum, r) => {
      return sum + Object.values(r.monthly).reduce((s, v) => s + v, 0)
    }, 0)
  }

  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  // 盈餘計算
  const revenueTotal = subtotal('revenue') + subtotal('other_income')
  const expenseTotal = subtotal('cost') + subtotal('expense') + subtotal('other_loss')
  const netIncome = revenueTotal - expenseTotal

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">年度總表</h1>
          <p className="text-gray-500 text-sm mt-1">
            {year}年度 · {currentBranch?.name || (isAdmin ? '所有分公司' : profile?.branch?.name)}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/reports/export?year=${year}${branchId ? `&branch=${branchId}` : ''}&format=excel`}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            📥 匯出 Excel
          </a>
        </div>
      </div>

      <FilterBar
        year={year}
        branchId={params.branch || ''}
        branches={branches || []}
        showBranch={isAdmin}
      />

      {/* 年度總表 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="report-table min-w-max">
            <thead>
              <tr>
                <th className="w-20">科目代號</th>
                <th className="w-36">科目名稱</th>
                {months.map(m => <th key={m} className="w-24">{m}月</th>)}
                <th className="w-28">合計</th>
                <th className="w-24">平均</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map(type => {
                const typeRows = rows.filter(r => r.type === type)
                if (typeRows.length === 0) return null
                const st = subtotal(type)

                return [
                  // 類型標題行
                  <tr key={`header-${type}`} className="section-header">
                    <td colSpan={15}>{TYPE_LABELS[type]}</td>
                  </tr>,
                  // 科目行
                  ...typeRows.map(row => {
                    const total = Object.values(row.monthly).reduce((s, v) => s + v, 0)
                    return (
                      <tr key={row.code}>
                        <td className="text-gray-700">{row.code}</td>
                        <td>{row.name}</td>
                        {months.map(m => (
                          <td key={m} className="font-mono">
                            {row.monthly[m] ? formatCurrency(row.monthly[m]) : '-'}
                          </td>
                        ))}
                        <td className="font-mono font-semibold">{formatCurrency(total)}</td>
                        <td className="font-mono text-gray-700">{formatCurrency(Math.round(total / 12))}</td>
                      </tr>
                    )
                  }),
                  // 小計行
                  <tr key={`subtotal-${type}`} className="subtotal">
                    <td></td>
                    <td>小計</td>
                    {months.map(m => (
                      <td key={m} className="font-mono">{formatCurrency(subtotal(type, m))}</td>
                    ))}
                    <td className="font-mono">{formatCurrency(st)}</td>
                    <td className="font-mono text-gray-700">{formatCurrency(Math.round(st / 12))}</td>
                  </tr>,
                ]
              })}

              {/* 各月盈餘 */}
              <tr className="bg-amber-50 font-bold">
                <td></td>
                <td>各月盈餘</td>
                {months.map(m => {
                  const rev = (rows.filter(r => r.type === 'revenue' || r.type === 'other_income')
                    .reduce((s, r) => s + (r.monthly[m] || 0), 0))
                  const exp = (rows.filter(r => r.type === 'cost' || r.type === 'expense' || r.type === 'other_loss')
                    .reduce((s, r) => s + (r.monthly[m] || 0), 0))
                  const net = rev - exp
                  return (
                    <td key={m} className={`font-mono ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {net !== 0 ? formatCurrency(net) : '-'}
                    </td>
                  )
                })}
                <td className={`font-mono ${netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatCurrency(netIncome)}
                </td>
                <td className="font-mono text-gray-700">{formatCurrency(Math.round(netIncome / 12))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
