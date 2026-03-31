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
  employee_type: 'monthly' | 'hourly'
  base_salary: number
  hourly_rate: number
  night_shift_allowance: number
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
  employee_type: 'monthly' as const,
  base_salary: '',
  hourly_rate: '200',
  night_shift_allowance: '200',
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
      employee_type: emp.employee_type,
      base_salary: String(emp.base_salary),
      hourly_rate: String(emp.hourly_rate),
      night_shift_allowance: String(emp.night_shift_allowance),
      labor_insurance: String(emp.labor_insurance),
      health_insurance: String(emp.health_insurance),
    })
    setShowForm(true)
    setError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('請填寫員工姓名'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const payload = {
      branch_id: form.branch_id,
      name: form.name.trim(),
      title: form.title || null,
      employee_type: form.employee_type,
      base_salary: Number(form.base_salary) || 0,
      hourly_rate: Number(form.hourly_rate) || 200,
      night_shift_allowance: Number(form.night_shift_allowance) || 0,
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

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">薪資類型</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" value="monthly" checked={form.employee_type === 'monthly'}
                    onChange={() => setForm(f => ({ ...f, employee_type: 'monthly' }))} />
                  月薪制
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" value="hourly" checked={form.employee_type === 'hourly'}
                    onChange={() => setForm(f => ({ ...f, employee_type: 'hourly' }))} />
                  兼職時薪
                </label>
              </div>
            </div>

            {form.employee_type === 'monthly' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">月薪（元）</label>
                  <input type="number" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))}
                    placeholder="例：32000" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">夜班津貼（元/班）</label>
                  <input type="number" value={form.night_shift_allowance} onChange={e => setForm(f => ({ ...f, night_shift_allowance: e.target.value }))}
                    placeholder="例：200" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">勞保員工負擔（元）</label>
                  <input type="number" value={form.labor_insurance} onChange={e => setForm(f => ({ ...f, labor_insurance: e.target.value }))}
                    placeholder="例：645" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">健保員工負擔（元）</label>
                  <input type="number" value={form.health_insurance} onChange={e => setForm(f => ({ ...f, health_insurance: e.target.value }))}
                    placeholder="例：426" min="0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">時薪（元）</label>
                <input type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900" />
              </div>
            )}
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
              <th className="px-4 py-3 text-center text-gray-700 font-medium">類型</th>
              <th className="px-4 py-3 text-right text-gray-700 font-medium">月薪/時薪</th>
              <th className="px-4 py-3 text-right text-gray-700 font-medium">夜班津貼</th>
              <th className="px-4 py-3 text-right text-gray-700 font-medium">勞保</th>
              <th className="px-4 py-3 text-right text-gray-700 font-medium">健保</th>
              <th className="px-4 py-3 text-center text-gray-700 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-400">尚無員工資料</td>
              </tr>
            ) : employees.map(emp => (
              <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                {isAdmin && <td className="px-4 py-3 text-gray-700">{emp.branch?.name}</td>}
                <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                <td className="px-4 py-3 text-gray-600">{emp.title || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${emp.employee_type === 'monthly' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {emp.employee_type === 'monthly' ? '月薪' : '時薪'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-900">
                  {emp.employee_type === 'monthly' ? formatCurrency(emp.base_salary) : `${emp.hourly_rate}/時`}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {emp.employee_type === 'monthly' ? formatCurrency(emp.night_shift_allowance) : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {emp.employee_type === 'monthly' ? formatCurrency(emp.labor_insurance) : '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">
                  {emp.employee_type === 'monthly' ? formatCurrency(emp.health_insurance) : '-'}
                </td>
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
