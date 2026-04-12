import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PointValueForm from './PointValueForm'

export default async function PointValuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: pointValues } = await supabase
    .from('nhi_point_values')
    .select('*')
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })

  const years = Array.from(new Set([
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
  ]))

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">健保點值設定</h1>
        <p className="text-gray-900 text-sm mt-1">每季由健保署公告，影響申報預估收款金額</p>
      </div>

      <PointValueForm existingValues={pointValues || []} years={years} />

      {/* 歷史記錄 */}
      {pointValues && pointValues.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-700">歷史點值</h2>
          </div>
          <table className="report-table">
            <thead>
              <tr>
                <th>年度</th>
                <th>季度</th>
                <th>點值</th>
              </tr>
            </thead>
            <tbody>
              {pointValues.map(pv => (
                <tr key={pv.id}>
                  <td className="text-gray-900">{pv.year}年</td>
                  <td className="text-gray-900">第{pv.quarter}季</td>
                  <td className="font-mono text-gray-900">{pv.point_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
