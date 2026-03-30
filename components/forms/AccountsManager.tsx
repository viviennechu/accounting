'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Account } from '@/lib/types'

const TYPE_LABELS: Record<string, string> = {
  revenue: '營業收入',
  cost: '營業成本',
  expense: '營業費用',
  asset: '資產',
  liability: '負債',
  other_income: '業外收益',
  other_loss: '業外損失',
}

interface Props {
  accounts: Account[]
  branches: { id: string; name: string }[]
  currentBranchId: string
  isAdmin: boolean
}

export default function AccountsManager({ accounts, branches, currentBranchId, isAdmin }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('expense')
  const [saving, setSaving] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(currentBranchId)

  async function handleAdd() {
    if (!newCode || !newName || !selectedBranch) return
    setSaving(true)

    const supabase = createClient()
    await supabase.from('accounts').insert({
      branch_id: selectedBranch,
      code: newCode,
      name: newName,
      type: newType,
    })

    setNewCode('')
    setNewName('')
    setAdding(false)
    setSaving(false)
    router.refresh()
  }

  async function toggleActive(id: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('accounts').update({ is_active: !current }).eq('id', id)
    router.refresh()
  }

  const grouped = Object.entries(TYPE_LABELS).map(([type, label]) => ({
    type,
    label,
    items: accounts.filter(a => a.type === type),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3 items-center">
          <label className="text-sm font-medium text-gray-700">查看分公司：</label>
          <select
            value={selectedBranch}
            onChange={e => {
              setSelectedBranch(e.target.value)
              router.push(`/admin/accounts?branch=${e.target.value}`)
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      {grouped.map(({ type, label, items }) => (
        <div key={type} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-blue-50 px-4 py-2 border-b border-blue-100">
            <h2 className="font-semibold text-blue-800 text-sm">{label}</h2>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {items.map(a => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2 text-gray-500 w-20">{a.code}</td>
                  <td className="px-4 py-2">{a.name}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => toggleActive(a.id, a.is_active ?? true)}
                      className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {a.is_active ? '啟用' : '停用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* 新增科目 */}
      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="w-full bg-white border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          ＋ 新增科目
        </button>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-gray-700">新增科目</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">科目代號</label>
              <input
                type="text"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="e.g. 6400"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">科目名稱</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. 培訓費"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">類型</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
