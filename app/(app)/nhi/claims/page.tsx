import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import ReceivePaymentButton from './ReceivePaymentButton'

export default async function NhiClaimsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*, branch:branches(*)').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin'

  let query = supabase
    .from('nhi_claims')
    .select('*, branch:branches(name)')
    .order('service_year', { ascending: false })
    .order('service_month', { ascending: false })

  if (!isAdmin && profile?.branch_id) {
    query = query.eq('branch_id', profile.branch_id)
  }

  const { data: claims } = await query
  const { data: branches } = await supabase.from('branches').select('id, name')
  const { data: pointValues } = await supabase.from('nhi_point_values').select('*').order('year').order('quarter')

  // 取得所有 NHI 科目（4102）用於自動產生傳票
  const { data: nhiAccounts } = await supabase
    .from('accounts')
    .select('id, branch_id, code, name')
    .eq('code', '4102')

  const pending = claims?.filter(c => !c.received_at) || []
  const received = claims?.filter(c => c.received_at) || []

  function getPointValue(year: number, month: number) {
    const q = Math.ceil(month / 3)
    return pointValues?.find(pv => pv.year === year && pv.quarter === q)?.point_value
  }

  function statusBadge(claim: any) {
    if (claim.received_at) {
      const diff = (claim.received_amount || 0) - (claim.expected_amount || 0)
      if (diff === 0) return <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">已收款</span>
      if (diff > 0) return <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">已收＋{formatCurrency(diff)}</span>
      return <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">已收 差{formatCurrency(Math.abs(diff))}</span>
    }
    return <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">待收款</span>
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">健保申報記錄</h1>
          <p className="text-gray-600 text-sm mt-1">待收款 {pending.length} 筆 · 已收款 {received.length} 筆</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link href="/nhi/point-values"
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              點值設定
            </Link>
          )}
          <Link href="/nhi/claims/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            ＋ 新增申報
          </Link>
        </div>
      </div>

      {/* 待收款 */}
      {pending.length > 0 && (
        <div className="bg-white border border-orange-200 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-orange-100 bg-orange-50">
            <h2 className="font-semibold text-orange-800">待收款（{pending.length} 筆）</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr>
                  <th>服務月份</th>
                  {isAdmin && <th>分公司</th>}
                  <th className="w-28">申報點數</th>
                  <th className="w-28">預計收款</th>
                  <th>申報日期</th>
                  <th>狀態</th>
                  <th className="w-28">操作</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(c => {
                  const pv = getPointValue(c.service_year, c.service_month)
                  const nhiAccountId = nhiAccounts?.find(a => a.branch_id === c.branch_id)?.id
                  return (
                    <tr key={c.id}>
                      <td className="font-medium text-gray-900">{c.service_year}年{c.service_month}月</td>
                      {isAdmin && <td className="text-sm text-gray-600">{(c.branch as any)?.name}</td>}
                      <td className="font-mono text-gray-900">{c.total_points.toLocaleString('zh-TW')}</td>
                      <td className="font-mono text-gray-900">
                        {c.expected_amount ? formatCurrency(c.expected_amount) : (pv ? formatCurrency(Math.round(c.total_points * pv)) : '-')}
                      </td>
                      <td className="text-sm text-gray-700">{c.submitted_at || '-'}</td>
                      <td>{statusBadge(c)}</td>
                      <td className="text-center">
                        <ReceivePaymentButton
                          claimId={c.id}
                          branchId={c.branch_id}
                          serviceYear={c.service_year}
                          serviceMonth={c.service_month}
                          expectedAmount={c.expected_amount || (pv ? Math.round(c.total_points * pv) : 0)}
                          nhiAccountId={nhiAccountId || ''}
                          branches={branches || []}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 已收款 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-700">已收款記錄</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="report-table">
            <thead>
              <tr>
                <th>服務月份</th>
                {isAdmin && <th>分公司</th>}
                <th className="w-28">申報點數</th>
                <th className="w-28">預計收款</th>
                <th className="w-28">實際收款</th>
                <th>收款日期</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {received.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="text-center text-gray-400 py-8">尚無已收款記錄</td></tr>
              ) : received.map(c => (
                <tr key={c.id}>
                  <td className="font-medium text-gray-900">{c.service_year}年{c.service_month}月</td>
                  {isAdmin && <td className="text-sm text-gray-600">{(c.branch as any)?.name}</td>}
                  <td className="font-mono text-gray-900">{c.total_points.toLocaleString('zh-TW')}</td>
                  <td className="font-mono text-gray-700">{c.expected_amount ? formatCurrency(c.expected_amount) : '-'}</td>
                  <td className="font-mono font-semibold text-gray-900">{c.received_amount ? formatCurrency(c.received_amount) : '-'}</td>
                  <td className="text-sm text-gray-700">{c.received_at}</td>
                  <td>{statusBadge(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
