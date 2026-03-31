'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  branches: { id: string; name: string }[]
  defaultBranchId: string
  isAdmin: boolean
  initial?: {
    id: string
    branch_id: string
    name: string
    admission_date: string
    discharge_date?: string | null
    subsidy_type: string
    daily_self_pay: number
    daily_subsidy_rate: number
    notes?: string | null
  }
}

export default function ResidentForm({ branches, defaultBranchId, isAdmin, initial }: Props) {
  const router = useRouter()
  const [branchId, setBranchId] = useState(initial?.branch_id || defaultBranchId)
  const [name, setName] = useState(initial?.name || '')
  const [admissionDate, setAdmissionDate] = useState(initial?.admission_date || new Date().toISOString().split('T')[0])
  const [subsidyType, setSubsidyType] = useState(initial?.subsidy_type || 'self')
  const [dailySelfPay, setDailySelfPay] = useState(String(initial?.daily_self_pay || ''))
  const [dailySubsidyRate, setDailySubsidyRate] = useState(String(initial?.daily_subsidy_rate || ''))
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('請填寫住民姓名'); return }
    if (!admissionDate) { setError('請填寫入住日期'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const payload = {
      branch_id: branchId,
      name: name.trim(),
      admission_date: admissionDate,
      subsidy_type: subsidyType,
      daily_self_pay: Number(dailySelfPay) || 0,
      daily_subsidy_rate: Number(dailySubsidyRate) || 0,
      // 保留月費估算欄位（以日費率×30天估算）
      monthly_self_pay: Math.round((Number(dailySelfPay) || 0) * 30),
      monthly_subsidy: Math.round((Number(dailySubsidyRate) || 0) * 30),
      notes: notes || null,
    }

    const { error: err } = initial
      ? await supabase.from('residents').update(payload).eq('id', initial.id)
      : await supabase.from('residents').insert(payload)

    if (err) { setError('儲存失敗：' + err.message); setSaving(false); return }
    router.push('/residents')
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      {isAdmin && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">分公司</label>
          <select value={branchId} onChange={e => setBranchId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">住民姓名 *</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="請輸入姓名"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">入住日期 *</label>
        <input type="date" value={admissionDate} onChange={e => setAdmissionDate(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">費用類型</label>
        <select value={subsidyType} onChange={e => setSubsidyType(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
          <option value="self">自費</option>
          <option value="subsidy">社會局補助</option>
          <option value="both">自費＋補助</option>
        </select>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
        <p className="text-xs text-blue-700 mb-3 font-medium">💡 請填每日費率，系統依每月實際在院天數計算</p>
        <div className="grid grid-cols-2 gap-3">
          {(subsidyType === 'self' || subsidyType === 'both') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">每日自付額（元）</label>
              <input type="number" value={dailySelfPay} onChange={e => setDailySelfPay(e.target.value)}
                placeholder="例：250" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
              {dailySelfPay && <p className="text-xs text-gray-500 mt-1">月估算：{Math.round(Number(dailySelfPay) * 30).toLocaleString()} 元</p>}
            </div>
          )}
          {(subsidyType === 'subsidy' || subsidyType === 'both') && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">每日補助費率（元）</label>
              <input type="number" value={dailySubsidyRate} onChange={e => setDailySubsidyRate(e.target.value)}
                placeholder="例：836" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
              {dailySubsidyRate && <p className="text-xs text-gray-500 mt-1">月估算：{Math.round(Number(dailySubsidyRate) * 30).toLocaleString()} 元</p>}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">備註</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="選填"
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 resize-none" />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? '儲存中...' : '儲存'}
        </button>
        <button onClick={() => router.back()}
          className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
          取消
        </button>
      </div>
    </div>
  )
}
