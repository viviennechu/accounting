import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CreateUserForm from '@/components/admin/CreateUserForm'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, role, created_at, branch:branches(name)')
    .order('created_at')

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .order('name')

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">用戶管理</h1>
        <CreateUserForm branches={branches || []} />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-900">姓名</th>
              <th className="text-left px-4 py-3 font-medium text-gray-900">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-900">所屬分公司</th>
              <th className="text-left px-4 py-3 font-medium text-gray-900">角色</th>
              <th className="text-left px-4 py-3 font-medium text-gray-900">建立日期</th>
            </tr>
          </thead>
          <tbody>
            {(users || []).map(u => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-900 text-xs">{(u as any).email || '—'}</td>
                <td className="px-4 py-3 text-gray-900">{(u.branch as any)?.name || '（總管理者）'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    u.role === 'accountant' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-900'
                  }`}>
                    {u.role === 'admin' ? '管理者' : u.role === 'accountant' ? '記帳人員' : '檢視者'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-900 text-xs">
                  {new Date(u.created_at).toLocaleDateString('zh-TW')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
