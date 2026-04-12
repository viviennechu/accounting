import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import FilterBar from '@/components/FilterBar'

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; account?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user!.id)
    .single()

  const now = new Date()
  const year = parseInt(params.year || String(now.getFullYear()))
  const month = parseInt(params.month || String(now.getMonth() + 1))
  const isAdmin = profile?.role === 'admin'

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`

  // 取得流水帳（依日期排序的所有傳票分錄）
  let query = supabase
    .from('vouchers')
    .select(`
      id, date, description, voucher_no,
      branch:branches(name),
      voucher_lines(
        id, debit, credit, note, line_order,
        account:accounts(code, name, type)
      )
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date')

  if (!isAdmin && profile?.branch_id) {
    query = query.eq('branch_id', profile.branch_id)
  }

  const { data: vouchers } = await query

  // 計算收支總計
  let totalIncome = 0
  let totalExpense = 0

  for (const v of (vouchers || [])) {
    for (const line of ((v as any).voucher_lines || [])) {
      const acct = (line as any).account
      if (!acct) continue
      if (acct.type === 'revenue' || acct.type === 'other_income') {
        totalIncome += (line.credit - line.debit)
      } else if (acct.type === 'cost' || acct.type === 'expense' || acct.type === 'other_loss') {
        totalExpense += (line.debit - line.credit)
      }
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">流水帳</h1>
          <p className="text-gray-700 text-sm mt-1">{year}年{month}月</p>
        </div>
      </div>

      <FilterBar year={year} month={month} showMonth />

      {/* 本月摘要 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-xs text-green-600 mb-1">本月收入</div>
          <div className="text-xl font-bold text-green-700">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-xs text-red-600 mb-1">本月支出</div>
          <div className="text-xl font-bold text-red-700">{formatCurrency(totalExpense)}</div>
        </div>
        <div className={`border rounded-xl p-4 text-center ${totalIncome - totalExpense >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className={`text-xs mb-1 ${totalIncome - totalExpense >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>本月盈餘</div>
          <div className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>
            {formatCurrency(totalIncome - totalExpense)}
          </div>
        </div>
      </div>

      {/* 流水帳表格 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="report-table">
            <thead>
              <tr>
                <th className="w-24">日期</th>
                {isAdmin && <th>分公司</th>}
                <th>科目</th>
                <th>摘要</th>
                <th className="w-28">收入</th>
                <th className="w-28">支出</th>
              </tr>
            </thead>
            <tbody>
              {!vouchers || vouchers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center text-gray-900 py-8">
                    本月尚無記錄
                  </td>
                </tr>
              ) : (
                vouchers.flatMap((v: any) =>
                  (v.voucher_lines || []).map((line: any, idx: number) => {
                    const acct = line.account
                    const isIncome = acct?.type === 'revenue' || acct?.type === 'other_income'
                    const displayAmount = isIncome
                      ? line.credit - line.debit
                      : line.debit - line.credit

                    return (
                      <tr key={`${v.id}-${line.id}`}>
                        {idx === 0 && (
                          <td rowSpan={(v.voucher_lines || []).length} className="align-top pt-2 text-center whitespace-nowrap text-sm">
                            <Link href={`/vouchers/${v.id}`} className="text-blue-600 hover:underline">
                              {v.date}
                            </Link>
                          </td>
                        )}
                        {isAdmin && idx === 0 && (
                          <td rowSpan={(v.voucher_lines || []).length} className="align-top pt-2 text-center text-xs text-gray-900">
                            {v.branch?.name}
                          </td>
                        )}
                        <td className="text-xs text-gray-900">{acct?.code} {acct?.name}</td>
                        <td className="text-sm">{line.note || v.description}</td>
                        <td className="font-mono text-green-700">
                          {(isIncome && displayAmount > 0) ? formatCurrency(displayAmount) : ''}
                        </td>
                        <td className="font-mono text-red-700">
                          {(!isIncome && displayAmount > 0) ? formatCurrency(displayAmount) : ''}
                        </td>
                      </tr>
                    )
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
