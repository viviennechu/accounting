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
    resident_type: string
    monthly_fee: number | null
    welfare_amount: number | null
    welfare_type: string | null
    welfare_doc_no: string | null
    nhi_identity: string | null
    notes?: string | null
  }
}

const NHI_IDENTITY_OPTIONS = ['健保', '低收', '中低收', '免費', '其他']

export default function ResidentForm({ branches, defaultBranchId, isAdmin, initial }: Props) {
  const router = useRouter()
  const [branchId, setBranchId] = useState(initial?.branch_id || defaultBranchId)
  const [name, setName] = useState(initial?.name || '')
  const [admissionDate, setAdmissionDate] = useState(initial?.admission_date || new Date().toISOString().split('T')[0])
  const [residentType, setResidentType] = useState<'monthly_fee' | 'social_welfare'>(
    (initial?.resident_type as 'monthly_fee' | 'social_welfare') || 'monthly_fee'
  )
  const [monthlyFee, setMonthlyFee] = useState(String(initial?.monthly_fee || ''))
  const [nhiIdentity, setNhiIdentity] = useState(initial?.nhi_identity || '')
  const [welfareAmount, setWelfareAmount] = useState(String(initial?.welfare_amount || ''))
  const [welfareType, setWelfareType] = useState(initial?.welfare_type || '')
  const [welfareDocNo, setWelfareDocNo] = useState(initial?.welfare_doc_no || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleResidentTypeChange(type: 'monthly_fee' | 'social_welfare') {
    setResidentType(type)
    // 切換類型時清空另一方的欄位
    if (type === 'monthly_fee') {
      setWelfareAmount('')
      setWelfareType('')
      setWelfareDocNo('')
    } else {
      setMonthlyFee('')
    }
  }

  async function handleSave() {
    if (!name.trim()) { setError('請填寫住民姓名'); return }
    if (!admissionDate) { setError('請填寫入住日期'); return }
    if (!nhiIdentity) { setError('請填寫健保身份'); return }

    if (residentType === 'monthly_fee') {
      const fee = Number(monthlyFee)
      if (!monthlyFee || fee <= 0) { setError('月費住民需填寫正確的月費金額'); return }
    } else {
      const amount = Number(welfareAmount)
      if (!welfareAmount || amount <= 0) { setError('社會局住民需填寫正確的核定月費'); return }
      if (!welfareType) { setError('請選擇社會局補助類型'); return }
    }

    setSaving(true)
    setError('')
    const supabase = createClient()

    const payload = {
      branch_id: branchId,
      name: name.trim(),
      admission_date: admissionDate,
      resident_type: residentType,
      monthly_fee: residentType === 'monthly_fee' ? Number(monthlyFee) : null,
      welfare_amount: residentType === 'social_welfare' ? Number(welfareAmount) : null,
      welfare_type: residentType === 'social_welfare' ? welfareType || null : null,
      welfare_doc_no: residentType === 'social_welfare' ? welfareDocNo || null : null,
      nhi_identity: nhiIdentity || null,
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

      {/* 健保身份（所有住民必填） */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">健保身份 *</label>
        <select value={nhiIdentity} onChange={e => setNhiIdentity(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
          <option value="">請選擇</option>
          {NHI_IDENTITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>

      {/* 計費類型選擇 */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">計費類型 *</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleResidentTypeChange('monthly_fee')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              residentType === 'monthly_fee'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            月費住民
          </button>
          <button
            type="button"
            onClick={() => handleResidentTypeChange('social_welfare')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              residentType === 'social_welfare'
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            社會局住民
          </button>
        </div>
      </div>

      {/* 月費住民欄位 */}
      {residentType === 'monthly_fee' && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-3">
          <p className="text-xs text-blue-700 font-medium">月費住民：家屬或本人繳費，依健保身份調整費率</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">實收月費（元） *</label>
            <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)}
              placeholder="例：10950、9000、8000"
              min="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            <p className="text-xs text-gray-600 mt-1">填入家屬實際繳交金額（已扣除低收等折扣後的金額）</p>
          </div>
        </div>
      )}

      {/* 社會局住民欄位 */}
      {residentType === 'social_welfare' && (
        <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 space-y-3">
          <p className="text-xs text-purple-700 font-medium">社會局住民：機構直接向社會局請款，金額依公文核定</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">社會局核定月費（元） *</label>
            <input type="number" value={welfareAmount} onChange={e => setWelfareAmount(e.target.value)}
              placeholder="例：18000、25000、32000"
              min="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">補助類型 *</label>
            <select value={welfareType} onChange={e => setWelfareType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
              <option value="">請選擇</option>
              <option value="disability">身障保護安置</option>
              <option value="homeless">街友救助科</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">公文字號</label>
            <input type="text" value={welfareDocNo} onChange={e => setWelfareDocNo(e.target.value)}
              placeholder="例：新北社助字第1140756071號"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
          </div>
        </div>
      )}

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
