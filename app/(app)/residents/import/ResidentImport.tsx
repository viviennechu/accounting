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

interface ResidentRow {
  name: string
  admission_date: string
  subsidy_type: string
  monthly_self_pay: number
  monthly_subsidy: number
  notes: string
  error?: string
}

const SUBSIDY_MAP: Record<string, string> = {
  '自費': 'self',
  '社會局補助': 'subsidy',
  '補助': 'subsidy',
  '自費＋補助': 'both',
  '自費+補助': 'both',
  'self': 'self',
  'subsidy': 'subsidy',
  'both': 'both',
}

function parseDate(val: any): string {
  if (!val) return ''
  // Excel 日期數字
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  // 字串：支援 2024/01/01、2024-01-01、民國113/01/01
  const str = String(val).trim()
  // 民國年
  const roc = str.match(/^(\d{2,3})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (roc && Number(roc[1]) < 200) {
    const y = Number(roc[1]) + 1911
    return `${y}-${roc[2].padStart(2, '0')}-${roc[3].padStart(2, '0')}`
  }
  // 西元
  const iso = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  return str
}

export default function ResidentImport({ branches, defaultBranchId, isAdmin }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [branchId, setBranchId] = useState(defaultBranchId)
  const [rows, setRows] = useState<ResidentRow[]>([])
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [done, setDone] = useState(false)

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['姓名', '入住日期', '費用類型', '每月自付額', '每月補助金額', '備註'],
      ['王小明', '2024/01/15', '自費', 8000, 0, ''],
      ['李小花', '2023/06/01', '自費＋補助', 3000, 5000, '低收入戶'],
      ['張大同', '2024/03/20', '社會局補助', 0, 8000, ''],
    ])
    ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '住民資料')
    XLSX.writeFile(wb, '住民匯入範本.xlsx')
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

      // 略過標題行
      const dataRows = raw.slice(1).filter(r => r.some(c => String(c).trim()))

      const parsed: ResidentRow[] = dataRows.map((r) => {
        const name = String(r[0] || '').trim()
        const admission_date = parseDate(r[1])
        const subsidyRaw = String(r[2] || '').trim()
        const subsidy_type = SUBSIDY_MAP[subsidyRaw] || 'self'
        const monthly_self_pay = Number(r[3]) || 0
        const monthly_subsidy = Number(r[4]) || 0
        const notes = String(r[5] || '').trim()

        let error = ''
        if (!name) error = '姓名不能為空'
        else if (!admission_date || !/^\d{4}-\d{2}-\d{2}$/.test(admission_date)) error = '日期格式錯誤'

        return { name, admission_date, subsidy_type, monthly_self_pay, monthly_subsidy, notes, error }
      })

      setRows(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  function updateRow(idx: number, field: keyof ResidentRow, value: string | number) {
    const updated = [...rows]
    updated[idx] = { ...updated[idx], [field]: value }
    // 重新驗證
    const r = updated[idx]
    if (!r.name) updated[idx].error = '姓名不能為空'
    else if (!r.admission_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.admission_date)) updated[idx].error = '日期格式錯誤'
    else updated[idx].error = ''
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
      admission_date: r.admission_date,
      subsidy_type: r.subsidy_type,
      monthly_self_pay: r.monthly_self_pay,
      monthly_subsidy: r.monthly_subsidy,
      notes: r.notes || null,
      is_active: true,
    }))

    const { error } = await supabase.from('residents').insert(payload)
    setSaving(false)
    if (error) {
      alert('部分資料儲存失敗：' + error.message)
      return
    }
    setSavedCount(validRows.length)
    setDone(true)
    setRows([])
  }

  const validCount = rows.filter(r => !r.error).length
  const errorCount = rows.filter(r => r.error).length

  const subsidyLabel = (type: string) => ({ self: '自費', subsidy: '社會局補助', both: '自費＋補助' }[type] || type)

  return (
    <div className="space-y-5">
      {/* 步驟說明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h2 className="font-semibold text-blue-800 mb-2">操作步驟</h2>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>下載範本，依格式填寫住民資料</li>
          <li>費用類型填：自費 / 社會局補助 / 自費＋補助</li>
          <li>日期支援西元（2024/01/01）或民國（113/01/01）格式</li>
          <li>上傳後確認預覽，可直接修改錯誤</li>
          <li>確認無誤後按「全部存入」</li>
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
        <div className="text-xs text-gray-400 mt-1">支援 .xlsx / .xls</div>
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
          <div className="font-semibold text-green-700">成功匯入 {savedCount} 位住民</div>
          <button
            onClick={() => router.push('/residents')}
            className="mt-3 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
          >
            查看住民清單
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
              {errorCount > 0 && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">✗ {errorCount} 筆有誤</span>}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || validCount === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '存入中...' : `全部存入（${validCount} 筆）`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium w-8">#</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">姓名</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">入住日期</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">費用類型</th>
                  <th className="px-3 py-2 text-right text-gray-700 font-medium">每月自付額</th>
                  <th className="px-3 py-2 text-right text-gray-700 font-medium">每月補助</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">備註</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className={`border-b border-gray-100 ${row.error ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
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
                        type="date"
                        value={row.admission_date}
                        onChange={e => updateRow(idx, 'admission_date', e.target.value)}
                        className={`border rounded px-2 py-1 text-sm text-gray-900 ${row.error?.includes('日期') ? 'border-red-400' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.subsidy_type}
                        onChange={e => updateRow(idx, 'subsidy_type', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                      >
                        <option value="self">自費</option>
                        <option value="subsidy">社會局補助</option>
                        <option value="both">自費＋補助</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.monthly_self_pay || ''}
                        onChange={e => updateRow(idx, 'monthly_self_pay', Number(e.target.value))}
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={row.monthly_subsidy || ''}
                        onChange={e => updateRow(idx, 'monthly_subsidy', Number(e.target.value))}
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.notes}
                        onChange={e => updateRow(idx, 'notes', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                        placeholder="選填"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {row.error ? (
                        <span title={row.error} className="text-red-500 cursor-help text-xs">⚠️</span>
                      ) : (
                        <span className="text-green-500 text-xs">✓</span>
                      )}
                      <button onClick={() => removeRow(idx)} className="ml-1 text-gray-400 hover:text-red-500 text-xs">✕</button>
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
