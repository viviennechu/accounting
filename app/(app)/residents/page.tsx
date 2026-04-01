import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import ResidentActions from './ResidentActions'

export default async function ResidentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  let query = supabase
    .from('residents')
    .select('*')
    .order('admission_date', { ascending: false })

  if (!isAdmin && profile?.branch_id) {
    query = query.eq('branch_id', profile.branch_id)
  }

  const { data: residents } = await query
  const { data: branches } = await supabase.from('branches').select('id, name')

  const active = residents?.filter(r => r.is_active) || []
  const inactive = residents?.filter(r => !r.is_active) || []

  const residentTypeLabel = (type: string) => ({
    monthly_fee: '月費住民',
    social_welfare: '社會局住民',
  }[type] || type)

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">住民管理</h1>
          <p className="text-gray-600 text-sm mt-1">在籍 {active.length} 人 · 離院 {inactive.length} 人</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/residents/import"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            📊 批次匯入
          </Link>
          <Link
            href="/residents/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            ＋ 新增住民
          </Link>
        </div>
      </div>

      {/* 在籍住民 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-800">在籍住民（{active.length} 人）</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="report-table">
            <thead>
              <tr>
                <th>姓名</th>
                {isAdmin && <th>分公司</th>}
                <th>入住日期</th>
                <th>計費類型</th>
                <th className="w-28">月費金額</th>
                <th className="w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr><td colSpan={isAdmin ? 6 : 5} className="text-center text-gray-600 py-8">尚無在籍住民</td></tr>
              ) : active.map(r => (
                <tr key={r.id}>
                  <td className="font-medium text-gray-900">{r.name}</td>
                  {isAdmin && <td className="text-sm text-gray-600">{branches?.find(b => b.id === r.branch_id)?.name}</td>}
                  <td className="text-sm text-gray-700">{r.admission_date}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.resident_type === 'social_welfare'
                        ? 'bg-purple-50 text-purple-700'
                        : 'bg-blue-50 text-blue-700'
                    }`}>{residentTypeLabel(r.resident_type)}</span>
                  </td>
                  <td className="font-mono text-gray-900">
                    {r.resident_type === 'monthly_fee'
                      ? (r.monthly_fee ? formatCurrency(r.monthly_fee) : '-')
                      : (r.welfare_amount ? formatCurrency(r.welfare_amount) : '-')
                    }
                  </td>
                  <td className="text-center">
                    <ResidentActions residentId={r.id} residentName={r.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 離院住民 */}
      {inactive.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-600">已離院（{inactive.length} 人）</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="report-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  {isAdmin && <th>分公司</th>}
                  <th>入住日期</th>
                  <th>離院日期</th>
                  <th>費用類型</th>
                </tr>
              </thead>
              <tbody>
                {inactive.map(r => (
                  <tr key={r.id} className="opacity-60">
                    <td className="text-gray-700">{r.name}</td>
                    {isAdmin && <td className="text-sm text-gray-600">{branches?.find(b => b.id === r.branch_id)?.name}</td>}
                    <td className="text-sm">{r.admission_date}</td>
                    <td className="text-sm">{r.discharge_date}</td>
                    <td><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{residentTypeLabel(r.resident_type)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
