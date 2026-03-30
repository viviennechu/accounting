import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function VoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: voucher } = await supabase
    .from('vouchers')
    .select(`
      id, voucher_no, date, description, attachment_url, created_at,
      branch:branches(name),
      voucher_lines(id, debit, credit, note, line_order, account:accounts(code, name, type))
    `)
    .eq('id', id)
    .single()

  if (!voucher) notFound()

  const lines = (voucher.voucher_lines as any[] || []).sort((a, b) => a.line_order - b.line_order)
  const totalDebit = lines.reduce((s: number, l: any) => s + l.debit, 0)
  const totalCredit = lines.reduce((s: number, l: any) => s + l.credit, 0)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/vouchers" className="text-gray-500 hover:text-gray-700">← 傳票清單</Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-xl font-bold text-gray-800">傳票詳情</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {/* 基本資訊 */}
        <div className="grid grid-cols-3 gap-4 text-sm border-b border-gray-100 pb-4">
          <div>
            <div className="text-gray-500 text-xs mb-1">傳票日期</div>
            <div className="font-medium">{voucher.date}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">傳票編號</div>
            <div className="font-medium">{voucher.voucher_no || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs mb-1">分公司</div>
            <div className="font-medium">{(voucher.branch as any)?.name}</div>
          </div>
          <div className="col-span-3">
            <div className="text-gray-500 text-xs mb-1">摘要</div>
            <div className="font-medium">{voucher.description || '—'}</div>
          </div>
        </div>

        {/* 分錄 */}
        <div>
          <h2 className="font-semibold text-gray-700 mb-2 text-sm">借貸分錄</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left pb-2 text-gray-500 font-medium">科目代號</th>
                <th className="text-left pb-2 text-gray-500 font-medium">科目名稱</th>
                <th className="text-left pb-2 text-gray-500 font-medium">摘要</th>
                <th className="text-right pb-2 text-gray-500 font-medium">借方</th>
                <th className="text-right pb-2 text-gray-500 font-medium">貸方</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line: any) => (
                <tr key={line.id} className="border-b border-gray-100">
                  <td className="py-2 text-gray-500">{line.account?.code}</td>
                  <td className="py-2">{line.account?.name}</td>
                  <td className="py-2 text-gray-600">{line.note || '—'}</td>
                  <td className="py-2 text-right font-mono">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                  <td className="py-2 text-right font-mono">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                </tr>
              ))}
              <tr className="font-semibold border-t border-gray-300">
                <td colSpan={3} className="pt-2">合計</td>
                <td className="pt-2 text-right font-mono">{formatCurrency(totalDebit)}</td>
                <td className="pt-2 text-right font-mono">{formatCurrency(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 附件 */}
        {voucher.attachment_url && (
          <div>
            <h2 className="font-semibold text-gray-700 mb-2 text-sm">附件</h2>
            <a href={voucher.attachment_url} target="_blank">
              <img
                src={voucher.attachment_url}
                alt="憑證附件"
                className="max-h-64 rounded-lg border border-gray-200 object-contain"
              />
            </a>
          </div>
        )}

        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          建立時間：{new Date(voucher.created_at).toLocaleString('zh-TW')}
        </div>
      </div>
    </div>
  )
}
