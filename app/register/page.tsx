'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [branchId, setBranchId] = useState('')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('branches').select('id, name').order('name').then(({ data }) => {
      setBranches(data || [])
      if (data && data.length > 0) setBranchId(data[0].id)
    })
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('請填寫姓名'); return }
    if (password.length < 6) { setError('密碼至少需要 6 個字元'); return }
    if (password !== password2) { setError('兩次密碼不一致'); return }
    if (!branchId) { setError('請選擇所屬分公司'); return }

    setLoading(true)
    const supabase = createClient()

    // 建立 Auth 帳號
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message.includes('already') ? '此 Email 已註冊過' : '註冊失敗：' + signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // 建立 profile
      await supabase.from('profiles').upsert({
        id: data.user.id,
        name: name.trim(),
        branch_id: branchId,
        role: 'accountant',
      })
    }

    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">註冊成功！</h2>
          <p className="text-gray-600 text-sm mb-6">
            帳號已建立，請直接登入開始使用。
          </p>
          <Link
            href="/login"
            className="block w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors text-center"
          >
            前往登入
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-gray-800">建立帳號</h1>
          <p className="text-gray-700 text-sm mt-1">康復之家記帳系統</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="請輸入您的姓名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">所屬分公司</label>
            <select
              value={branchId}
              onChange={e => setBranchId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電子郵件</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="至少 6 個字元"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">確認密碼</label>
            <input
              type="password"
              required
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="再輸入一次密碼"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '註冊中...' : '建立帳號'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-700 mt-4">
          已有帳號？
          <Link href="/login" className="text-blue-600 hover:underline ml-1">登入</Link>
        </p>
      </div>
    </div>
  )
}
