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

const PRESET_ACCOUNTS: { code: string; name: string; type: string }[] = [
  // 營業收入
  { code: '4100', name: '自費住民', type: 'revenue' },
  { code: '4102', name: '大健保', type: 'revenue' },
  { code: '4103', name: '小健保', type: 'revenue' },
  { code: '4104', name: '社會局補助款', type: 'revenue' },
  // 營業成本
  { code: '5100', name: '住民體檢費', type: 'cost' },
  { code: '5101', name: '住民買菜金', type: 'cost' },
  { code: '5102', name: '住民雜支', type: 'cost' },
  { code: '5103', name: '復健基金', type: 'cost' },
  { code: '5104', name: '社會局個案支出', type: 'cost' },
  { code: '5105', name: '物資運費', type: 'cost' },
  { code: '5106', name: '社會局醫療支出', type: 'cost' },
  // 營業費用
  { code: '6010', name: '薪資支出', type: 'expense' },
  { code: '6020', name: '租金支出', type: 'expense' },
  { code: '6021', name: '租賃所得稅', type: 'expense' },
  { code: '6022', name: '二代健保', type: 'expense' },
  { code: '6030', name: '文具用品', type: 'expense' },
  { code: '6050', name: '運費', type: 'expense' },
  { code: '6060', name: '郵資費', type: 'expense' },
  { code: '6070', name: '修繕費', type: 'expense' },
  { code: '6101', name: '保險費-勞保', type: 'expense' },
  { code: '6102', name: '保險費-健保', type: 'expense' },
  { code: '6120', name: '水費', type: 'expense' },
  { code: '6130', name: '電費', type: 'expense' },
  { code: '6140', name: '退休金-勞退', type: 'expense' },
  { code: '6290', name: '管理費', type: 'expense' },
  { code: '6330', name: '瓦斯費', type: 'expense' },
  { code: '6400', name: '伙食費', type: 'expense' },
  // 資產
  { code: '1105', name: '現金-前檯', type: 'asset' },
  { code: '1106', name: '現金-行政金', type: 'asset' },
  { code: '1110', name: '銀行存款-郵局', type: 'asset' },
  { code: '1114', name: '銀行存款-合庫公帳', type: 'asset' },
  // 負債
  { code: '2140', name: '應付薪資', type: 'liability' },
  { code: '2147', name: '應付勞保費', type: 'liability' },
  { code: '2148', name: '應付健保費', type: 'liability' },
  { code: '2149', name: '應付勞退金', type: 'liability' },
  // 業外收益
  { code: '7040', name: '利息收入', type: 'other_income' },
  { code: '7100', name: '其他收入', type: 'other_income' },
]

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
  const [showPreset, setShowPreset] = useState(false)
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set())

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

  async function handleAddPresets() {
    if (selectedPresets.size === 0 || !selectedBranch) return
    setSaving(true)
    const existingCodes = new Set(accounts.map(a => a.code))
    const toInsert = PRESET_ACCOUNTS.filter(
      p => selectedPresets.has(p.code) && !existingCodes.has(p.code)
    ).map(p => ({ branch_id: selectedBranch, code: p.code, name: p.name, type: p.type }))

    if (toInsert.length > 0) {
      const supabase = createClient()
      await supabase.from('accounts').insert(toInsert)
    }
    setSelectedPresets(new Set())
    setShowPreset(false)
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
                  <td className="px-4 py-2 text-gray-700 w-20">{a.code}</td>
                  <td className="px-4 py-2 text-gray-900">{a.name}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => toggleActive(a.id, a.is_active ?? true)}
                      className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
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
      {!adding && !showPreset ? (
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreset(true)}
            className="flex-1 bg-white border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            📋 從常用科目選
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex-1 bg-white border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-700 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            ＋ 手動新增科目
          </button>
        </div>
      ) : showPreset ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="font-semibold text-gray-800">常用科目庫</span>
            <button onClick={() => { setShowPreset(false); setSelectedPresets(new Set()) }} className="text-gray-600 hover:text-gray-600 text-sm">✕ 關閉</button>
          </div>
          <div className="p-4 space-y-4">
            {Object.entries(TYPE_LABELS).map(([type, label]) => {
              const group = PRESET_ACCOUNTS.filter(p => p.type === type)
              if (group.length === 0) return null
              const existingCodes = new Set(accounts.map(a => a.code))
              return (
                <div key={type}>
                  <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded mb-2">{label}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {group.map(p => {
                      const exists = existingCodes.has(p.code)
                      const checked = selectedPresets.has(p.code)
                      return (
                        <label
                          key={p.code}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                            exists
                              ? 'border-gray-100 bg-gray-50 text-gray-600 cursor-not-allowed'
                              : checked
                              ? 'border-blue-300 bg-blue-50 text-blue-800'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={exists}
                            checked={exists ? false : checked}
                            onChange={e => {
                              const next = new Set(selectedPresets)
                              e.target.checked ? next.add(p.code) : next.delete(p.code)
                              setSelectedPresets(next)
                            }}
                            className="rounded"
                          />
                          <span className="font-mono text-xs text-gray-600 w-10 shrink-0">{p.code}</span>
                          <span>{p.name}</span>
                          {exists && <span className="ml-auto text-xs text-gray-600">已新增</span>}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-700">已選 {selectedPresets.size} 項</span>
            <button
              onClick={handleAddPresets}
              disabled={saving || selectedPresets.size === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '新增中...' : `新增已勾選（${selectedPresets.size} 項）`}
            </button>
          </div>
        </div>
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
