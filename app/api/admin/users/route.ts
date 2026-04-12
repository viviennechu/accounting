import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  // 確認呼叫者是 admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, password, name, role, branch_id } = await request.json()
  if (!email || !password || !name) {
    return NextResponse.json({ error: '請填寫 email、密碼、姓名' }, { status: 400 })
  }

  // 用 service role 建立 auth 用戶
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let userId: string

  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    // 如果是 email 已存在，找到既有用戶 ID 直接補寫 profile
    if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
      const { data: userList } = await adminClient.auth.admin.listUsers()
      const existing = userList?.users?.find(u => u.email === email)
      if (!existing) return NextResponse.json({ error: createError.message }, { status: 400 })
      userId = existing.id
    } else {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }
  } else {
    userId = newUser.user.id
  }

  // 寫入 profile（有就更新，沒有就新增）
  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: userId,
      name,
      role: role || 'accountant',
      branch_id: branch_id || null,
    })

  if (profileError) {
    return NextResponse.json({ error: 'Auth 建立成功但 profile 更新失敗：' + profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
