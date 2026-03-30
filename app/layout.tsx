import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '康復之家記帳系統',
  description: '多分公司記帳、報表與照片自動記帳系統',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" className="h-full">
      <body className="min-h-full bg-gray-50">{children}</body>
    </html>
  )
}
