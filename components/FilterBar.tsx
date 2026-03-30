'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface FilterBarProps {
  year: number
  month?: number
  branchId?: string
  branches?: { id: string; name: string }[]
  showMonth?: boolean
  showBranch?: boolean
}

export default function FilterBar({ year, month, branchId, branches, showMonth, showBranch }: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }

  const years = [year - 2, year - 1, year, year + 1]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-2 items-center">
      <select
        value={year}
        onChange={e => update('year', e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
      >
        {years.map(y => <option key={y} value={y}>{y}年</option>)}
      </select>

      {showMonth && (
        <select
          value={month}
          onChange={e => update('month', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{m}月</option>
          ))}
        </select>
      )}

      {showBranch && branches && (
        <select
          value={branchId || ''}
          onChange={e => update('branch', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
        >
          <option value="">所有分公司</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
    </div>
  )
}
