import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractMultipleFromImage } from '@/lib/claude'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const branchId = formData.get('branch_id') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  let accountQuery = supabase.from('accounts').select('code, name').eq('is_active', true)
  if (branchId) accountQuery = accountQuery.eq('branch_id', branchId)
  const { data: accounts } = await accountQuery

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type || 'image/jpeg'

  try {
    const results = await extractMultipleFromImage(base64, mimeType, accounts || [])
    return NextResponse.json({ results, count: results.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('OCR multi error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
