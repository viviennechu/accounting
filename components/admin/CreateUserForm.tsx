'use client'

import { useState } from 'react'

interface Props {
  branches: { id: string; name: string }[]
}

export default function CreateUserForm({ branches }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('accountant')
  const [branchId, setBranchId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    if (!name || !email || !password) { setError('請填寫所有必填欄位'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role, branch_id: branchId || null }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || '建立失敗')
      setSaving(false)
      return
    }

    setSuccess(true)
    setSaving(false)
    setTimeout(() => {
      window.location.reload()
    }, 1200)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        ＋ 新增用戶
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">新增用戶</h2>

            {success ? (
              <div className="text-center py-6 text-green-600 font-medium">✅ 用戶建立成功！</div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">姓名 *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    placeholder="例：王小明"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">密碼 *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                    placeholder="至少 6 個字"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">角色</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="accountant">記帳人員</option>
                    <option value="viewer">檢視者</option>
                    <option value="admin">管理者</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-900 mb-1">所屬分公司</label>
                  <select
                    value={branchId}
                    onChange={e => setBranchId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">（總管理者，可看全部）</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? '建立中...' : '建立用戶'}
                  </button>
                  <button
                    onClick={() => { setOpen(false); setError('') }}
                    className="flex-1 border border-gray-300 text-gray-900 py-2.5 rounded-lg font-medium hover:bg-gray-50"
                  >
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
