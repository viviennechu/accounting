'use client'

import { useState } from 'react'
import Link from 'next/link'

interface GalleryVoucher {
  id: string
  date: string
  description: string | null
  attachment_url: string | null
  branch_name: string | null
  total_amount: number
  account_codes: string
}

interface Props {
  vouchers: GalleryVoucher[]
  showBranch: boolean
}

export default function VoucherGallery({ vouchers, showBranch }: Props) {
  const [lightbox, setLightbox] = useState<GalleryVoucher | null>(null)

  const withPhoto = vouchers.filter(v => v.attachment_url)
  const withoutPhoto = vouchers.filter(v => !v.attachment_url)

  return (
    <>
      {/* 燈箱 */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={lightbox.attachment_url!}
              alt="憑證照片"
              className="w-full max-h-[60vh] object-contain bg-gray-100"
            />
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{lightbox.date}　{lightbox.description || '—'}</p>
                  <p className="text-sm text-gray-800">{lightbox.account_codes}　NT$ {lightbox.total_amount.toLocaleString('zh-TW')}</p>
                  {showBranch && <p className="text-xs text-gray-700">{lightbox.branch_name}</p>}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/vouchers/${lightbox.id}/edit`}
                    className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-200"
                  >
                    ✏️ 編輯
                  </Link>
                  <button
                    onClick={() => setLightbox(null)}
                    className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-gray-900"
                  >
                    關閉
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 有照片的憑證 */}
      {withPhoto.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">📷 有附件 ({withPhoto.length} 筆)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {withPhoto.map(v => (
              <div
                key={v.id}
                className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLightbox(v)}
              >
                <div className="relative aspect-[4/3] bg-gray-100">
                  <img
                    src={v.attachment_url!}
                    alt="憑證"
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-black/50 text-white text-xs px-2 py-1 rounded-full">點擊放大</span>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-800">{v.date}</p>
                  <p className="text-xs font-medium text-gray-800 truncate">{v.description || '—'}</p>
                  <p className="text-xs text-blue-600 font-mono">NT$ {v.total_amount.toLocaleString('zh-TW')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 沒有照片的憑證 */}
      {withoutPhoto.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-gray-700 mb-3 text-sm">📄 無附件 ({withoutPhoto.length} 筆)</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {withoutPhoto.map(v => (
              <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <span className="text-xs text-gray-800 mr-2">{v.date}</span>
                  <span className="text-sm text-gray-800">{v.description || '—'}</span>
                  {showBranch && <span className="ml-2 text-xs text-gray-700">{v.branch_name}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-gray-700">NT$ {v.total_amount.toLocaleString('zh-TW')}</span>
                  <Link href={`/vouchers/${v.id}/edit`} className="text-gray-700 hover:text-blue-600 text-sm">✏️</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vouchers.length === 0 && (
        <div className="text-center py-16 text-gray-700">
          <div className="text-4xl mb-3">📭</div>
          <p>本月尚無憑證記錄</p>
        </div>
      )}
    </>
  )
}
