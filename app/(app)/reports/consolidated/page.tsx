import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import FilterBar from '@/components/FilterBar'

const TYPE_LABELS: Record<string, string> = {
  revenue: '營業收入',
  cost: '營業成本',
  expense: '營業費用',
  other_income: '業外收益',
  other_loss: '業外損失',
}

const TYPE_ORDER = ['revenue', 'cost', 'expense', 'other_income', 'other_loss']

export default async function ConsolidatedPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
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

  const year = parseInt(params.year || String(new Date().getFullYear()))
  const { data: branches } = await supabase.from('branches').select('id, name').order('name')

  // 取得所有傳票分錄
  const { data: lines } = await supabase
    .from('voucher_lines')
    .select(`
      debit, credit,
      account:accounts(code, name, type),
      voucher:vouchers(date, branch_id)
    `)
    .gte('voucher.date', `${year}-01-01`)
    .lte('voucher.date', `${year}-12-31`)

  // 彙整：科目 × 分公司 × 淨額
  type ConsolidatedMap = Record<string, {
    code: string; name: string; type: string;
    byBranch: Record<string, number>
    total: number
  }>
  const consolidated: ConsolidatedMap = {}

  for (const line of (lines || [])) {
    const voucher = line.voucher as any
    const account = line.account as any
    if (!account || !voucher) continue

    const key = account.code
    const branchId = voucher.branch_id

    if (!consolidated[key]) {
      consolidated[key] = { code: account.code, name: account.name, type: account.type, byBranch: {}, total: 0 }
    }

    const net = (account.type === 'revenue' || account.type === 'other_income')
      ? (line.credit - line.debit)
      : (line.debit - line.credit)

    consolidated[key].byBranch[branchId] = (consolidated[key].byBranch[branchId] || 0) + net
    consolidated[key].total += net
  }

  const rows = Object.values(consolidated).sort((a, b) => a.code.localeCompare(b.code))

  function branchTotal(branchId: string, type?: string) {
    return rows
      .filter(r => !type || r.type === type)
      .reduce((sum, r) => sum + (r.byBranch[branchId] || 0), 0)
  }

  function typeSubtotal(type: string) {
    return rows.filter(r => r.type === type).reduce((sum, r) => sum + r.total, 0)
  }

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">合併報表</h1>
          <p className="text-gray-500 text-sm mt-1">{year}年度 · 所有分公司</p>
        </div>
        <a
          href={`/api/reports/export?year=${year}&format=excel&consolidated=true`}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          📥 匯出 Excel
        </a>
      </div>

      <FilterBar year={year} />

      {/* 各分公司盈餘摘要 */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: `repeat(${(branches || []).length}, 1fr)` }}>
        {(branches || []).map(b => {
          const inc = branchTotal(b.id, 'revenue') + branchTotal(b.id, 'other_income')
          const exp = branchTotal(b.id, 'cost') + branchTotal(b.id, 'expense') + branchTotal(b.id, 'other_loss')
          const net = inc - exp
          return (
            <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="font-semibold text-gray-700 mb-2">{b.name}</div>
              <div className="text-xs text-gray-500">年度盈餘</div>
              <div className={`text-xl font-bold ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(net)}
              </div>
            </div>
          )
        })}
      </div>

      {/* 合併總表 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="report-table min-w-max">
            <thead>
              <tr>
                <th className="w-20">科目代號</th>
                <th className="w-36">科目名稱</th>
                {(branches || []).map(b => (
                  <th key={b.id} className="w-32">{b.name}</th>
                ))}
                <th className="w-32">合計</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map(type => {
                const typeRows = rows.filter(r => r.type === type)
                if (typeRows.length === 0) return null
                const st = typeSubtotal(type)

                return [
                  <tr key={`h-${type}`} className="section-header">
                    <td colSpan={3 + (branches || []).length}>{TYPE_LABELS[type]}</td>
                  </tr>,
                  ...typeRows.map(row => (
                    <tr key={row.code}>
                      <td className="text-gray-500">{row.code}</td>
                      <td>{row.name}</td>
                      {(branches || []).map(b => (
                        <td key={b.id} className="font-mono">
                          {row.byBranch[b.id] ? formatCurrency(row.byBranch[b.id]) : '-'}
                        </td>
                      ))}
                      <td className="font-mono font-semibold">{formatCurrency(row.total)}</td>
                    </tr>
                  )),
                  <tr key={`st-${type}`} className="subtotal">
                    <td></td>
                    <td>小計</td>
                    {(branches || []).map(b => (
                      <td key={b.id} className="font-mono">{formatCurrency(branchTotal(b.id, type))}</td>
                    ))}
                    <td className="font-mono">{formatCurrency(st)}</td>
                  </tr>,
                ]
              })}

              {/* 總盈餘 */}
              <tr className="bg-amber-50 font-bold">
                <td></td>
                <td>年度盈餘</td>
                {(branches || []).map(b => {
                  const net = branchTotal(b.id, 'revenue') + branchTotal(b.id, 'other_income')
                    - branchTotal(b.id, 'cost') - branchTotal(b.id, 'expense') - branchTotal(b.id, 'other_loss')
                  return (
                    <td key={b.id} className={`font-mono ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {formatCurrency(net)}
                    </td>
                  )
                })}
                <td className={`font-mono ${
                  (typeSubtotal('revenue') + typeSubtotal('other_income') - typeSubtotal('cost') - typeSubtotal('expense') - typeSubtotal('other_loss')) >= 0
                    ? 'text-green-700' : 'text-red-600'
                }`}>
                  {formatCurrency(
                    typeSubtotal('revenue') + typeSubtotal('other_income')
                    - typeSubtotal('cost') - typeSubtotal('expense') - typeSubtotal('other_loss')
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
