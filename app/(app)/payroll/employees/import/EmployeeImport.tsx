'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'

interface Props {
  branches: { id: string; name: string }[]
  defaultBranchId: string
  isAdmin: boolean
}

interface EmployeeRow {
  name: string
  title: string
  base_salary: number
  license_fee: number
  labor_insurance: number
  health_insurance: number
  error?: string
}

function parseNum(val: any): number {
  const n = Number(String(val).replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}

function validateRow(r: EmployeeRow): string {
  if (!r.name) return '姓名不能為空'
  if (r.base_salary <= 0) return '月薪必須大於 0'
  return ''
}

export default function EmployeeImport({ branches, defaultBranchId, isAdmin }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || '')
  const [rows, setRows] = useState<EmployeeRow[]>([])
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [done, setDone] = useState(false)

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['姓名', '職稱', '月薪', '証照費', '勞保員工負擔', '健保員工負擔'],
      ['王小明', '照服員', 32000, 0, 870, 1080],
      ['李小花', '護理師', 38000, 2000, 1010, 1250],
      ['張大同', '社工', 35000, 0, 940, 1170],
    ])
    ws['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '員工資料')
    XLSX.writeFile(wb, '員工匯入範本.xlsx')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setDone(false)
    setSavedCount(0)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      const dataRows = raw.slice(1).filter(r => r.some(c => String(c).trim()))

      const parsed: EmployeeRow[] = dataRows.map((r) => {
        const row: EmployeeRow = {
          name: String(r[0] || '').trim(),
          title: String(r[1] || '').trim(),
          base_salary: parseNum(r[2]),
          license_fee: parseNum(r[3]),
          labor_insurance: parseNum(r[4]),
          health_insurance: parseNum(r[5]),
        }
        row.error = validateRow(row)
        return row
      })

      setRows(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  function updateRow(idx: number, field: keyof EmployeeRow, value: string | number) {
    const updated = [...rows]
    updated[idx] = { ...updated[idx], [field]: value }
    updated[idx].error = validateRow(updated[idx])
    setRows(updated)
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    const validRows = rows.filter(r => !r.error)
    if (validRows.length === 0) return
    setSaving(true)
    const supabase = createClient()

    const payload = validRows.map(r => ({
      branch_id: branchId,
      name: r.name,
      title: r.title || null,
      base_salary: r.base_salary,
      license_fee: r.license_fee,
      labor_insurance: r.labor_insurance,
      health_insurance: r.health_insurance,
      is_active: true,
    }))

    const { error } = await supabase.from('employees').insert(payload)
    setSaving(false)
    if (error) {
      alert('儲存失敗：' + error.message)
      return
    }
    setSavedCount(validRows.length)
    setDone(true)
    setRows([])
  }

  const validCount = rows.filter(r => !r.error).length
  const errorCount = rows.filter(r => r.error).length

  return (
    <div className="space-y-5">
      {/* 步驟說明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h2 className="font-semibold text-blue-800 mb-2">操作步驟</h2>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>下載範本，依格式填寫員工資料</li>
          <li>月薪、証照費、勞保、健保填寫員工負擔金額（數字）</li>
          <li>上傳後確認預覽，可直接修改錯誤後再存入</li>
        </ol>
        <button
          onClick={downloadTemplate}
          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          📥 下載範本
        </button>
      </div>

      {/* 分公司選擇（admin） */}
      {isAdmin && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">匯入到哪間分公司</label>
          <select
            value={branchId}
            onChange={e => setBranchId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900"
          >
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* 上傳區 */}
      <div
        className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <div className="text-3xl mb-2">📊</div>
        <div className="text-gray-700 font-medium">{fileName || '點擊選擇 Excel 檔案'}</div>
        <div className="text-xs text-gray-900 mt-1">支援 .xlsx / .xls</div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {/* 完成訊息 */}
      {done && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl mb-1">✅</div>
          <div className="font-semibold text-green-700">成功匯入 {savedCount} 位員工</div>
          <button
            onClick={() => router.push('/payroll/employees')}
            className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            查看員工清單
          </button>
        </div>
      )}

      {/* 預覽表格 */}
      {rows.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-800">預覽（共 {rows.length} 筆）</span>
              {validCount > 0 && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✓ {validCount} 筆正確</span>}
              {errorCount > 0 && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⚠ {errorCount} 筆待確認</span>}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || validCount === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '存入中...' : `存入正確筆數（${validCount} 筆）`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium w-8">#</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">姓名</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">職稱</th>
                  <th className="px-3 py-2 text-right text-gray-700 font-medium">月薪</th>
                  <th className="px-3 py-2 text-right text-gray-700 font-medium">証照費</th>
                  <th className="px-3 py-2 text-right text-gray-700 font-medium">勞保</th>
                  <th className="px-3 py-2 text-right text-gray-700 font-medium">健保</th>
                  <th className="px-3 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className={`border-b border-gray-100 ${row.error ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2 text-gray-900 text-xs">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => updateRow(idx, 'name', e.target.value)}
                        className={`w-full border rounded px-2 py-1 text-sm text-gray-900 ${row.error?.includes('姓名') ? 'border-red-400' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.title}
                        onChange={e => updateRow(idx, 'title', e.target.value)}
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                        placeholder="選填"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.base_salary || ''}
                        onChange={e => updateRow(idx, 'base_salary', Number(e.target.value))}
                        className={`w-24 border rounded px-2 py-1 text-sm text-gray-900 text-right ${row.error?.includes('月薪') ? 'border-red-400' : 'border-gray-300'}`}
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.license_fee || ''}
                        onChange={e => updateRow(idx, 'license_fee', Number(e.target.value))}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.labor_insurance || ''}
                        onChange={e => updateRow(idx, 'labor_insurance', Number(e.target.value))}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.health_insurance || ''}
                        onChange={e => updateRow(idx, 'health_insurance', Number(e.target.value))}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.error ? (
                        <span title={row.error} className="text-red-500 cursor-help text-xs">⚠️</span>
                      ) : (
                        <span className="text-green-500 text-xs">✓</span>
                      )}
                      <button onClick={() => removeRow(idx)} className="ml-1 text-gray-900 hover:text-red-500 text-xs">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errorCount > 0 && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-600">
              ⚠️ 有誤的欄位已標紅，請直接在表格內修正後再存入
            </div>
          )}
        </div>
      )}
    </div>
  )
}
