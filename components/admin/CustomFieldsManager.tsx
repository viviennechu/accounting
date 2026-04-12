'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FieldDef {
  id: string
  label: string
  field_type: string
  options: string[]
  required: boolean
  field_order: number
}

interface Props {
  branchId: string
  branchName: string
  initialFields: FieldDef[]
}

export default function CustomFieldsManager({ branchId, branchName, initialFields }: Props) {
  const supabase = createClient()
  const [fields, setFields] = useState<FieldDef[]>(initialFields)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState('text')
  const [optionsText, setOptionsText] = useState('')
  const [required, setRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    if (!label.trim()) { setError('請填寫欄位名稱'); return }
    setSaving(true)
    setError('')

    const options = fieldType === 'select'
      ? optionsText.split('\n').map(s => s.trim()).filter(Boolean)
      : []

    const { data, error: err } = await supabase
      .from('custom_field_definitions')
      .insert({
        branch_id: branchId,
        label: label.trim(),
        field_type: fieldType,
        options,
        required,
        field_order: fields.length,
      })
      .select()
      .single()

    if (err || !data) {
      setError('新增失敗：' + err?.message)
      setSaving(false)
      return
    }

    setFields(prev => [...prev, data])
    setLabel('')
    setFieldType('text')
    setOptionsText('')
    setRequired(false)
    setAdding(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('確定要刪除這個欄位？已填寫的資料也會一併刪除')) return
    await supabase.from('custom_field_definitions').delete().eq('id', id)
    setFields(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">{branchName} 的自訂欄位</h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            ＋ 新增欄位
          </button>
        )}
      </div>

      {/* 新增表單 */}
      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-blue-900 text-sm">新增自訂欄位</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">欄位名稱 *</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="例：廠商名稱、發票號碼"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-900 mb-1">欄位類型</label>
              <select
                value={fieldType}
                onChange={e => setFieldType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
              >
                <option value="text">文字</option>
                <option value="number">數字</option>
                <option value="select">下拉選單</option>
              </select>
            </div>
            {fieldType === 'select' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-900 mb-1">選項（每行一個）</label>
                <textarea
                  value={optionsText}
                  onChange={e => setOptionsText(e.target.value)}
                  rows={4}
                  placeholder={"選項一\n選項二\n選項三"}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
                />
              </div>
            )}
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={required}
                onChange={e => setRequired(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="required" className="text-sm text-gray-900">必填欄位</label>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '新增中...' : '確認新增'}
            </button>
            <button
              onClick={() => { setAdding(false); setError('') }}
              className="border border-gray-300 text-gray-900 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 欄位清單 */}
      {fields.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-white border border-gray-200 rounded-xl">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">尚無自訂欄位</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {fields.map(f => (
            <div key={f.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{f.label}</span>
                <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                  {f.field_type === 'text' ? '文字' : f.field_type === 'number' ? '數字' : '下拉'}
                </span>
                {f.required && (
                  <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">必填</span>
                )}
                {f.field_type === 'select' && f.options.length > 0 && (
                  <span className="text-xs text-gray-500">{f.options.join('、')}</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
