import * as XLSX from 'xlsx'
import type { MonthlySummaryRow } from './types'
import { formatCurrency } from './utils'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  revenue: '營業收入',
  cost: '營業成本',
  expense: '營業費用',
  other_income: '業外收益',
  other_loss: '業外損失',
}

export function generateAnnualExcel(
  branchName: string,
  year: number,
  rows: MonthlySummaryRow[]
): Uint8Array {
  const wb = XLSX.utils.book_new()
  const wsData: (string | number)[][] = []

  // 標題
  wsData.push([`${branchName}年度總表`])
  wsData.push([`${year}年度`])
  wsData.push([])

  // 表頭
  wsData.push([
    '',
    '科目名稱',
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月',
    '合計', '平均', '其他機構同期',
  ])

  // 依科目類型分組
  const types = ['revenue', 'cost', 'expense', 'other_income', 'other_loss']
  for (const type of types) {
    const typeRows = rows.filter(r => r.account_type === type)
    if (typeRows.length === 0) continue

    for (const row of typeRows) {
      const dataRow: (string | number)[] = [
        row.account_code,
        row.account_name,
      ]
      for (let m = 1; m <= 12; m++) {
        dataRow.push(row.monthly[m] || 0)
      }
      dataRow.push(row.total)
      dataRow.push(Math.round(row.total / 12))
      dataRow.push(row.benchmark || '')
      wsData.push(dataRow)
    }

    // 小計行
    const subtotalRow: (string | number)[] = ['', `${ACCOUNT_TYPE_LABELS[type]}小計`]
    for (let m = 1; m <= 12; m++) {
      subtotalRow.push(typeRows.reduce((sum, r) => sum + (r.monthly[m] || 0), 0))
    }
    subtotalRow.push(typeRows.reduce((sum, r) => sum + r.total, 0))
    subtotalRow.push(Math.round(typeRows.reduce((sum, r) => sum + r.total, 0) / 12))
    subtotalRow.push('')
    wsData.push(subtotalRow)
    wsData.push([])
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // 欄寬設定
  ws['!cols'] = [
    { wch: 8 },   // 科目代號
    { wch: 16 },  // 科目名稱
    ...Array(12).fill({ wch: 12 }),  // 月份
    { wch: 12 },  // 合計
    { wch: 10 },  // 平均
    { wch: 14 },  // 其他機構同期
  ]

  XLSX.utils.book_append_sheet(wb, ws, '年度總表')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}

export function generateJournalExcel(
  branchName: string,
  year: number,
  month: number,
  vouchers: {
    voucher_no: string | null
    date: string
    lines: { account_code: string; account_name: string; note: string; debit: number; credit: number }[]
  }[]
): Uint8Array {
  const wb = XLSX.utils.book_new()
  const wsData: (string | number)[][] = []

  wsData.push([branchName])
  wsData.push(['日記簿'])
  wsData.push([`${year - 1911}年度`])
  wsData.push([])
  wsData.push(['傳票編號', '傳票日期', '科目代號', '科目名稱', '摘要', '借', '貸'])

  for (const v of vouchers) {
    for (const line of v.lines) {
      wsData.push([
        v.voucher_no || '',
        v.date,
        line.account_code,
        line.account_name,
        line.note,
        line.debit || '',
        line.credit || '',
      ])
    }
    wsData.push([])
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, '日記簿')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}
