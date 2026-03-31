import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function BranchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, code, created_at')
    .order('created_at')

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">分公司管理</h1>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">分公司名稱</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">代碼</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">建立日期</th>
            </tr>
          </thead>
          <tbody>
            {(branches || []).map(b => (
              <tr key={b.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 text-gray-700 font-mono">{b.code}</td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {new Date(b.created_at).toLocaleDateString('zh-TW')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-600 mt-3">如需新增分公司，請聯繫系統管理員直接更新資料庫。</p>
    </div>
  )
}
