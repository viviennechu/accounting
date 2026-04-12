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
  resident_type: 'monthly_fee' | 'social_welfare'
  monthly_fee: number
  welfare_amount: number
  welfare_type: string
  welfare_doc_no: string
  nhi_identity: string
  notes: string
  error?: string
}

const RESIDENT_TYPE_MAP: Record<string, 'monthly_fee' | 'social_welfare'> = {
  '月費': 'monthly_fee',
  '月費住民': 'monthly_fee',
  'monthly_fee': 'monthly_fee',
  '社會局': 'social_welfare',
  '社會局住民': 'social_welfare',
  '社會局補助': 'social_welfare',
  'social_welfare': 'social_welfare',
}

const WELFARE_TYPE_MAP: Record<string, string> = {
  '身障': 'disability',
  '身障保護安置': 'disability',
  'disability': 'disability',
  '街友': 'homeless',
  '街友救助科': 'homeless',
  'homeless': 'homeless',
}

function parseDate(val: any): string {
  if (!val) return ''
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const str = String(val).trim()
  const roc = str.match(/^(\d{2,3})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (roc && Number(roc[1]) < 200) {
    const y = Number(roc[1]) + 1911
    return `${y}-${roc[2].padStart(2, '0')}-${roc[3].padStart(2, '0')}`
  }
  const iso = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  return str
}

export default function ResidentImport({ branches, defaultBranchId, isAdmin }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [branchId, setBranchId] = useState(defaultBranchId || branches[0]?.id || '')
  const [rows, setRows] = useState<ResidentRow[]>([])
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [done, setDone] = useState(false)

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ['姓名', '入住日期', '計費類型', '健保身份', '月費金額', '社會局核定月費', '補助類型', '公文字號', '備註'],
      ['王小明', '2024/01/15', '月費', '低收', 9000, '', '', '', ''],
      ['李小花', '2023/06/01', '月費', '健保', 10950, '', '', '', ''],
      ['張大同', '2024/03/20', '社會局', '健保', '', 25000, '身障保護安置', '新北社助字第1140756071號', ''],
    ])
    ws['!cols'] = [
      { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 20 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '住民資料')
    XLSX.writeFile(wb, '住民匯入範本.xlsx')
  }

  function validateRow(r: ResidentRow): string {
    if (!r.name) return '姓名不能為空'
    if (!r.admission_date || !/^\d{4}-\d{2}-\d{2}$/.test(r.admission_date)) return '日期格式錯誤'
    if (!r.nhi_identity) return '健保身份不能為空'
    if (r.resident_type === 'monthly_fee' && r.monthly_fee <= 0) return '月費住民需填寫月費金額'
    if (r.resident_type === 'social_welfare' && r.welfare_amount <= 0) return '社會局住民需填寫核定月費'
    if (r.resident_type === 'social_welfare' && !r.welfare_type) return '社會局住民需填寫補助類型'
    return ''
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

      const parsed: ResidentRow[] = dataRows.map((r) => {
        const name = String(r[0] || '').trim()
        const admission_date = parseDate(r[1])
        const residentTypeRaw = String(r[2] || '').trim()
        const resident_type = RESIDENT_TYPE_MAP[residentTypeRaw] || 'monthly_fee'
        const nhi_identity = String(r[3] || '').trim()
        const monthly_fee = Number(r[4]) || 0
        const welfare_amount = Number(r[5]) || 0
        const welfareTypeRaw = String(r[6] || '').trim()
        const welfare_type = WELFARE_TYPE_MAP[welfareTypeRaw] || welfareTypeRaw
        const welfare_doc_no = String(r[7] || '').trim()
        const notes = String(r[8] || '').trim()

        const row: ResidentRow = {
          name, admission_date, resident_type, nhi_identity,
          monthly_fee, welfare_amount, welfare_type, welfare_doc_no, notes,
        }
        row.error = validateRow(row)
        return row
      })

      setRows(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  function updateRow(idx: number, field: keyof ResidentRow, value: string | number) {
    const updated = [...rows]
    updated[idx] = { ...updated[idx], [field]: value }
    updated[idx].error = validateRow(updated[idx])
    setRows(updated)
  }

  function removeRow(idx: number) {
    setRows(rows.filter((_, i) => i !== idx))
  }

  function exportErrors() {
    const errorRows = rows.filter(r => r.error)
    const data = [
      ['姓名', '入住日期', '計費類型', '健保身份', '月費金額', '社會局核定月費', '補助類型', '公文字號', '備註', '錯誤原因'],
      ...errorRows.map(r => [
        r.name, r.admission_date,
        r.resident_type === 'monthly_fee' ? '月費' : '社會局',
        r.nhi_identity,
        r.resident_type === 'monthly_fee' ? r.monthly_fee || '' : '',
        r.resident_type === 'social_welfare' ? r.welfare_amount || '' : '',
        r.welfare_type === 'disability' ? '身障保護安置' : r.welfare_type === 'homeless' ? '街友救助科' : '',
        r.welfare_doc_no || '',
        r.notes || '',
        r.error || '',
      ])
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    ws['!cols'] = [10,14,10,8,12,14,16,28,16,20].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '待確認住民')
    XLSX.writeFile(wb, '待確認住民.xlsx')
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
      resident_type: r.resident_type,
      monthly_fee: r.resident_type === 'monthly_fee' ? r.monthly_fee : null,
      welfare_amount: r.resident_type === 'social_welfare' ? r.welfare_amount : null,
      welfare_type: r.resident_type === 'social_welfare' ? r.welfare_type || null : null,
      welfare_doc_no: r.resident_type === 'social_welfare' ? r.welfare_doc_no || null : null,
      nhi_identity: r.nhi_identity || null,
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

  return (
    <div className="space-y-5">
      {/* 步驟說明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h2 className="font-semibold text-blue-800 mb-2">操作步驟</h2>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>下載範本，依格式填寫住民資料</li>
          <li>計費類型填：月費 / 社會局</li>
          <li>健保身份填：健保 / 低收 / 中低收</li>
          <li>日期支援西元（2024/01/01）或民國（113/01/01）格式</li>
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
              {errorCount > 0 && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⚠ {errorCount} 筆待確認</span>}
            </div>
            <div className="flex gap-2">
              {errorCount > 0 && (
                <button
                  onClick={exportErrors}
                  className="border border-amber-400 text-amber-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors"
                >
                  📥 匯出待確認（{errorCount} 筆）
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || validCount === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '存入中...' : `存入正確筆數（${validCount} 筆）`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium w-8">#</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">姓名</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">入住日期</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">計費類型</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">健保身份</th>
                  <th className="px-3 py-2 text-right text-gray-700 font-medium">月費金額</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">補助類型</th>
                  <th className="px-3 py-2 text-left text-gray-700 font-medium">備註</th>
                  <th className="px-3 py-2 w-8"></th>
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
                        type="date"
                        value={row.admission_date}
                        onChange={e => updateRow(idx, 'admission_date', e.target.value)}
                        className={`border rounded px-2 py-1 text-sm text-gray-900 ${row.error?.includes('日期') ? 'border-red-400' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.resident_type}
                        onChange={e => updateRow(idx, 'resident_type', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                      >
                        <option value="monthly_fee">月費</option>
                        <option value="social_welfare">社會局</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.nhi_identity}
                        onChange={e => updateRow(idx, 'nhi_identity', e.target.value)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                        placeholder="健保"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {row.resident_type === 'monthly_fee' ? (
                        <input
                          type="number"
                          value={row.monthly_fee || ''}
                          onChange={e => updateRow(idx, 'monthly_fee', Number(e.target.value))}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right"
                          min="1"
                        />
                      ) : (
                        <input
                          type="number"
                          value={row.welfare_amount || ''}
                          onChange={e => updateRow(idx, 'welfare_amount', Number(e.target.value))}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 text-right"
                          min="1"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.resident_type === 'social_welfare' ? (
                        <select
                          value={row.welfare_type}
                          onChange={e => updateRow(idx, 'welfare_type', e.target.value)}
                          className={`border rounded px-2 py-1 text-sm text-gray-900 ${row.error?.includes('補助類型') ? 'border-red-400' : 'border-gray-300'}`}
                        >
                          <option value="">請選擇</option>
                          <option value="disability">身障保護安置</option>
                          <option value="homeless">街友救助科</option>
                        </select>
                      ) : <span className="text-gray-700 text-xs">—</span>}
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
