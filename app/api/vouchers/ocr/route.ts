import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractFromImage } from '@/lib/claude'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const branchId = formData.get('branch_id') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // 取得科目清單（供 Claude 推薦用）
  let accountQuery = supabase.from('accounts').select('code, name').eq('is_active', true)
  if (branchId) accountQuery = accountQuery.eq('branch_id', branchId)
  const { data: accounts } = await accountQuery

  // 轉換圖片為 base64
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type || 'image/jpeg'

  const result = await extractFromImage(base64, mimeType, accounts || [])
  return NextResponse.json(result)
}
