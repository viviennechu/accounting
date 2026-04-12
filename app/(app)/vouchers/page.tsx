import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import FilterBar from '@/components/FilterBar'

export default async function VouchersPage({
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
      id, voucher_no, date, description, attachment_url, created_at,
      branch:branches(name),
      voucher_lines(id, debit, credit, account:accounts(code, name), note)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data: vouchers } = await query

  // 取得分公司清單（admin 用）
  const { data: branches } = await supabase.from('branches').select('id, name')

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">傳票日記簿</h1>
          <p className="text-gray-700 text-sm mt-1">{year}年{month}月</p>
        </div>
        <Link
          href="/vouchers/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          ＋ 新增傳票
        </Link>
      </div>

      <FilterBar
        year={year}
        month={month}
        branchId={params.branch || ''}
        branches={branches || []}
        showMonth
        showBranch={isAdmin}
      />

      {/* 傳票清單 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="report-table">
            <thead>
              <tr>
                <th className="w-24">傳票日期</th>
                <th className="w-28">傳票編號</th>
                {isAdmin && <th>分公司</th>}
                <th>科目代號</th>
                <th>科目名稱</th>
                <th>摘要</th>
                <th className="w-24">借方</th>
                <th className="w-24">貸方</th>
                <th className="w-16">附件</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {!vouchers || vouchers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="text-center text-gray-900 py-8">
                    本月尚無傳票記錄
                  </td>
                </tr>
              ) : (
                vouchers.map((v: any) => {
                  const lines = v.voucher_lines || []
                  return lines.map((line: any, idx: number) => (
                    <tr key={`${v.id}-${line.id}`} className="hover:bg-gray-50">
                      {idx === 0 && (
                        <>
                          <td rowSpan={lines.length} className="text-center align-top pt-2 whitespace-nowrap">
                            <Link href={`/vouchers/${v.id}`} className="text-blue-600 hover:underline">
                              {v.date}
                            </Link>
                          </td>
                          <td rowSpan={lines.length} className="text-center align-top pt-2 text-gray-700 text-xs">
                            {v.voucher_no || '-'}
                          </td>
                          {isAdmin && (
                            <td rowSpan={lines.length} className="text-center align-top pt-2 text-xs text-gray-900">
                              {(v.branch as any)?.name}
                            </td>
                          )}
                        </>
                      )}
                      <td className="text-gray-900">{line.account?.code}</td>
                      <td>{line.account?.name}</td>
                      <td className="text-gray-700">{line.note || v.description}</td>
                      <td className="text-right font-mono">
                        {line.debit > 0 ? formatCurrency(line.debit) : ''}
                      </td>
                      <td className="text-right font-mono">
                        {line.credit > 0 ? formatCurrency(line.credit) : ''}
                      </td>
                      {idx === 0 && (
                        <>
                          <td rowSpan={lines.length} className="text-center align-top pt-2">
                            {v.attachment_url && (
                              <a href={v.attachment_url} target="_blank" className="text-blue-500 text-lg">📎</a>
                            )}
                          </td>
                          <td rowSpan={lines.length} className="text-center align-top pt-1">
                            <Link
                              href={`/vouchers/${v.id}/edit`}
                              className="text-gray-700 hover:text-blue-600 text-sm px-1"
                              title="編輯"
                            >
                              ✏️
                            </Link>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
