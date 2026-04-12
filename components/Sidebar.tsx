'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

interface SidebarProps {
  profile: Profile | null
}

const navItems = [
  { href: '/dashboard', label: '儀表板', icon: '📊' },
  { href: '/vouchers', label: '傳票日記簿', icon: '📋' },
  { href: '/vouchers/new', label: '新增傳票', icon: '➕' },
  { href: '/vouchers/batch', label: '批次上傳憑證', icon: '📷' },
  { href: '/vouchers/gallery', label: '發票瀏覽器', icon: '🖼️' },
  { href: '/reports/annual', label: '年度總表', icon: '📈' },
  { href: '/reports/ledger', label: '流水帳', icon: '📒' },
  { href: '/reports/consolidated', label: '合併報表', icon: '🏢', adminOnly: true },
]

const nhiItems = [
  { href: '/residents', label: '住民管理', icon: '🏥' },
  { href: '/nhi/attendance', label: '每月出席登錄', icon: '📅' },
  { href: '/nhi/claims', label: '健保申報記錄', icon: '📄' },
  { href: '/nhi/point-values', label: '點值設定', icon: '⚕️', adminOnly: true },
]

const payrollItems = [
  { href: '/payroll/employees', label: '員工管理', icon: '👤' },
  { href: '/payroll/schedules', label: '班表上傳', icon: '📅' },
  { href: '/payroll/verify', label: '薪資核對', icon: '💰' },
]

const adminItems = [
  { href: '/admin/branches', label: '分公司管理', icon: '🏠' },
  { href: '/admin/users', label: '用戶管理', icon: '👥' },
  { href: '/admin/accounts', label: '科目代號', icon: '⚙️' },
  { href: '/admin/custom-fields', label: '自訂欄位', icon: '🗂️' },
]

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = profile?.role === 'admin'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="text-sm font-bold text-blue-700">🏥 記帳系統</div>
        <div className="text-xs text-gray-700 mt-1 truncate">
          {profile?.branch?.name || '總管理者'}
        </div>
        <div className="text-xs text-gray-900">{profile?.name}</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems
          .filter(item => !item.adminOnly || isAdmin)
          .map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}

        {/* 健保管理 */}
        <>
          <div className="pt-3 pb-1 px-3 text-xs font-semibold text-gray-900 uppercase tracking-wider">
            健保管理
          </div>
          {nhiItems
            .filter(item => !item.adminOnly || isAdmin)
            .map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === item.href
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
        </>

        {/* 薪資管理 */}
        <>
          <div className="pt-3 pb-1 px-3 text-xs font-semibold text-gray-900 uppercase tracking-wider">
            薪資管理
          </div>
          {payrollItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-800 hover:bg-gray-50'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </>

        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3 text-xs font-semibold text-gray-900 uppercase tracking-wider">
              管理
            </div>
            {adminItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  pathname === item.href
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <span>🚪</span>
          <span>登出</span>
        </button>
      </div>
    </aside>
  )
}
