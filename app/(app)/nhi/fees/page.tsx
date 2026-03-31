import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import FilterBar from '@/components/FilterBar'
import MarkPaidButton from './MarkPaidButton'

export default async function ResidentFeesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin'

  const now = new Date()
  const year = parseInt(params.year || String(now.getFullYear()))
  const month = parseInt(params.month || String(now.getMonth() + 1))

  // 取得在籍住民
  let resQuery = supabase
    .from('residents')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (!isAdmin && profile?.branch_id) {
    resQuery = resQuery.eq('branch_id', profile.branch_id)
  }

  const { data: residents } = await resQuery

  // 取得該月費用記錄
  const residentIds = (residents || []).map(r => r.id)
  const { data: fees } = residentIds.length > 0
    ? await supabase
        .from('resident_monthly_fees')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .in('resident_id', residentIds)
    : { data: [] }

  const feeMap = Object.fromEntries((fees || []).map(f => [f.resident_id, f]))

  const totalSelfPay = (fees || []).reduce((sum, f) => sum + f.self_pay, 0)
  const totalSubsidy = (fees || []).reduce((sum, f) => sum + f.subsidy_amount, 0)
  const paidCount = (fees || []).filter(f => f.self_pay_paid_at).length

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">住民月費管理</h1>
          <p className="text-gray-600 text-sm mt-1">{year}年{month}月</p>
        </div>
      </div>

      <FilterBar year={year} month={month} showMonth />

      {/* 月份摘要 */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-xs text-green-600 mb-1">應收自付額</div>
          <div className="text-xl font-bold text-green-700">{formatCurrency(totalSelfPay)}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <div className="text-xs text-blue-600 mb-1">補助金額</div>
          <div className="text-xl font-bold text-blue-700">{formatCurrency(totalSubsidy)}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-xs text-amber-600 mb-1">自付額收款</div>
          <div className="text-xl font-bold text-amber-700">{paidCount} / {residents?.length || 0} 人</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="report-table">
            <thead>
              <tr>
                <th>住民</th>
                <th>費用類型</th>
                <th className="w-24">健保點數</th>
                <th className="w-28">健保金額</th>
                <th className="w-28">自付額</th>
                <th className="w-28">補助金額</th>
                <th>自付額狀態</th>
              </tr>
            </thead>
            <tbody>
              {!residents || residents.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-600 py-8">本月尚無在籍住民</td></tr>
              ) : residents.map(r => {
                const fee = feeMap[r.id]
                const subsidyLabel = ({ self: '自費', subsidy: '補助', both: '自費＋補助' } as any)[r.subsidy_type]
                return (
                  <tr key={r.id}>
                    <td className="font-medium text-gray-900">{r.name}</td>
                    <td><span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{subsidyLabel}</span></td>
                    <td className="font-mono text-gray-900">{fee?.nhi_points ? fee.nhi_points.toLocaleString('zh-TW') : '-'}</td>
                    <td className="font-mono text-gray-900">{fee?.nhi_amount ? formatCurrency(fee.nhi_amount) : '-'}</td>
                    <td className="font-mono text-gray-900">{fee?.self_pay ? formatCurrency(fee.self_pay) : (r.monthly_self_pay > 0 ? formatCurrency(r.monthly_self_pay) : '-')}</td>
                    <td className="font-mono text-gray-900">{fee?.subsidy_amount ? formatCurrency(fee.subsidy_amount) : (r.monthly_subsidy > 0 ? formatCurrency(r.monthly_subsidy) : '-')}</td>
                    <td className="text-center">
                      {fee?.self_pay_paid_at ? (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                          已收 {fee.self_pay_paid_at}
                        </span>
                      ) : r.monthly_self_pay > 0 ? (
                        <MarkPaidButton
                          residentId={r.id}
                          branchId={r.branch_id}
                          year={year}
                          month={month}
                          selfPay={fee?.self_pay || r.monthly_self_pay}
                          feeId={fee?.id}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
