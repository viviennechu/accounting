import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, branch:branches(*)')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // 取得本月傳票數
  let voucherQuery = supabase
    .from('vouchers')
    .select('id', { count: 'exact' })
    .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
    .lte('date', `${year}-${String(month).padStart(2, '0')}-31`)

  if (!isAdmin && profile?.branch_id) {
    voucherQuery = voucherQuery.eq('branch_id', profile.branch_id)
  }

  const { count: voucherCount } = await voucherQuery

  // 取得分公司列表（admin 用）
  let branches: { id: string; name: string }[] = []
  if (isAdmin) {
    const { data } = await supabase.from('branches').select('id, name')
    branches = data || []
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">儀表板</h1>
        <p className="text-gray-700 text-sm mt-1">
          {year}年 {month}月 · {isAdmin ? '總管理者' : profile?.branch?.name}
        </p>
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link
          href="/vouchers/new"
          className="bg-blue-600 text-white rounded-xl p-5 hover:bg-blue-700 transition-colors"
        >
          <div className="text-2xl mb-2">📷</div>
          <div className="font-semibold">拍照記帳</div>
          <div className="text-blue-200 text-sm mt-1">上傳發票或收據自動辨識</div>
        </Link>

        <Link
          href="/vouchers"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="text-2xl mb-2">📋</div>
          <div className="font-semibold text-gray-800">傳票日記簿</div>
          <div className="text-gray-700 text-sm mt-1">本月已記 {voucherCount || 0} 筆傳票</div>
        </Link>

        <Link
          href="/reports/annual"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="text-2xl mb-2">📈</div>
          <div className="font-semibold text-gray-800">年度總表</div>
          <div className="text-gray-700 text-sm mt-1">查看 {year} 年度收支報表</div>
        </Link>
      </div>

      {/* Admin：分公司概覽 */}
      {isAdmin && branches.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">分公司</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {branches.map(b => (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="font-medium text-gray-800">{b.name}</div>
                <div className="flex gap-2 mt-3">
                  <Link
                    href={`/reports/annual?branch=${b.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    年度總表
                  </Link>
                  <span className="text-gray-300">·</span>
                  <Link
                    href={`/vouchers?branch=${b.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    傳票
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
