'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

interface Employee {
  id: string
  branch_id: string
  name: string
  title?: string | null
  base_salary: number
  license_fee: number
  labor_insurance: number
  health_insurance: number
  is_active: boolean
  branch?: { id: string; name: string }
}

interface Props {
  employees: Employee[]
  branches: { id: string; name: string }[]
  defaultBranchId: string
  isAdmin: boolean
}

const emptyForm = (branchId: string) => ({
  branch_id: branchId,
  name: '',
  title: '',
  base_salary: '',
  license_fee: '0',
  labor_insurance: '',
  health_insurance: '',
})

export default function EmployeeManager({ employees, branches, defaultBranchId, isAdmin }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [form, setForm] = useState(emptyForm(defaultBranchId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openNew() {
    setEditing(null)
    setForm(emptyForm(defaultBranchId))
    setShowForm(true)
    setError('')
  }

  function openEdit(emp: Employee) {
    setEditing(emp)
    setForm({
      branch_id: emp.branch_id,
      name: emp.name,
      title: emp.title || '',
      base_salary: String(emp.base_salary),
      license_fee: String(emp.license_fee),
      labor_insurance: String(emp.labor_insurance),
      health_insurance: String(emp.health_insurance),
    })
    setShowForm(true)
    setError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('請填寫員工姓名'); return }
    if (!Number(form.base_salary)) { setError('請填寫月薪金額'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const payload = {
      branch_id: form.branch_id,
      name: form.name.trim(),
      title: form.title || null,
      base_salary: Number(form.base_salary) || 0,
      license_fee: Number(form.license_fee) || 0,
      labor_insurance: Number(form.labor_insurance) || 0,
      health_insurance: Number(form.health_insurance) || 0,
    }

    const { error: err } = editing
      ? await supabase.from('employees').update(payload).eq('id', editing.id)
      : await supabase.from('employees').insert(payload)

    setSaving(false)
    if (err) { setError('儲存失敗：' + err.message); return }
    setShowForm(false)
    router.refresh()
  }

  async function handleDeactivate(id: string) {
    if (!confirm('確定要停用此員工？')) return
    const supabase = createClient()
    await supabase.from('employees').update({ is_active: false }).eq('id', id)
    router.refresh()
  }

  const colCount = isAdmin ? 8 : 7

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          ＋ 新增員工
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">{editing ? '編輯員工' : '新增員工'}</h2>

          <div className="grid grid-cols-2 gap-4">
            {isAdmin && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">分公司</label>
                <select value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900">
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">姓名 *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">職稱</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="例：護理師"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">月薪（元）*</label>
              <input type="number" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))}
                placeholder="例：32000" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">証照費（元/月）</label>
              <input type="number" value={form.license_fee} onChange={e => setForm(f => ({ ...f, license_fee: e.target.value }))}
                placeholder="例：2000" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">勞保員工負擔（元）</label>
              <input type="number" value={form.labor_insurance} onChange={e => setForm(f => ({ ...f, labor_insurance: e.target.value }))}
                placeholder="例：870" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">健保員工負擔（元）</label>
              <input type="number" value={form.health_insurance} onChange={e => setForm(f => ({ ...f, health_insurance: e.target.value }))}
                placeholder="例：1080" min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {isAdmin && <th className="px-4 py-3 text-left text-gray-700 font-medium">分公司</th>}
              <th className="px-4 py-3 text-left text-gray-700 font-medium">姓名</th>
              <th className="px-4 py-3 text-left text-gray-700 font-medium">職稱</th>
              <th className="px-4 py-3 text-right text-gray-700 font-medium">月薪</th>
              <th className="px-4 py-3 text-right text-gray-700 font-medium">証照費</th>
              <th className="px-4 py-3 text-right text-gray-700 font-medium">勞保</th>
              <th className="px-4 py-3 text-right text-gray-700 font-medium">健保</th>
              <th className="px-4 py-3 text-center text-gray-700 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-gray-600">尚無員工資料</td>
              </tr>
            ) : employees.map(emp => (
              <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                {isAdmin && <td className="px-4 py-3 text-gray-700">{emp.branch?.name}</td>}
                <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                <td className="px-4 py-3 text-gray-600">{emp.title || '-'}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">{formatCurrency(emp.base_salary)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {emp.license_fee > 0 ? formatCurrency(emp.license_fee) : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(emp.labor_insurance)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCurrency(emp.health_insurance)}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => openEdit(emp)}
                      className="text-blue-600 hover:text-blue-800 text-xs">編輯</button>
                    <button onClick={() => handleDeactivate(emp.id)}
                      className="text-red-500 hover:text-red-700 text-xs">停用</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
