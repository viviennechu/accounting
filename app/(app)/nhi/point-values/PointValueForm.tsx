'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  existingValues: { year: number; quarter: number; point_value: number }[]
  years: number[]
}

export default function PointValueForm({ existingValues, years }: Props) {
  const router = useRouter()
  const now = new Date()
  const [year, setYear] = useState(String(now.getFullYear()))
  const [quarter, setQuarter] = useState(String(Math.ceil((now.getMonth() + 1) / 3)))
  const [pointValue, setPointValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const existing = existingValues.find(v => v.year === Number(year) && v.quarter === Number(quarter))

  async function handleSave() {
    if (!pointValue || Number(pointValue) <= 0) { setError('請填寫點值'); return }
    setSaving(true)
    setError('')
    setSuccess(false)
    const supabase = createClient()

    const { error: err } = await supabase
      .from('nhi_point_values')
      .upsert({ year: Number(year), quarter: Number(quarter), point_value: Number(pointValue) }, { onConflict: 'year,quarter' })

    if (err) { setError('儲存失敗：' + err.message); setSaving(false); return }
    setSuccess(true)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">輸入點值</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">年度</label>
          <select value={year} onChange={e => { setYear(e.target.value); setSuccess(false) }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {years.map(y => <option key={y} value={y}>{y}年</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">季度</label>
          <select value={quarter} onChange={e => { setQuarter(e.target.value); setSuccess(false) }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>第{q}季</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">點值</label>
        <input
          type="number"
          value={pointValue || (existing ? String(existing.point_value) : '')}
          onChange={e => { setPointValue(e.target.value); setSuccess(false) }}
          placeholder={existing ? String(existing.point_value) : '例：0.9234'}
          step="0.0001"
          min="0"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
        />
        {existing && !pointValue && (
          <p className="text-xs text-blue-600 mt-1">目前設定：{existing.point_value}（可修改）</p>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">✅ 已儲存</p>}

      <button onClick={handleSave} disabled={saving}
        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
        {saving ? '儲存中...' : '儲存點值'}
      </button>
    </div>
  )
}
