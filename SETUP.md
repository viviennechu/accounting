# 記帳系統設定指南

## 第一步：建立 Supabase 專案

1. 到 https://supabase.com 註冊免費帳號
2. 點「New Project」，填入專案名稱（e.g. `kang-fu-accounting`），選擇離台灣最近的區域
3. 設定資料庫密碼（請記住）
4. 等待約 2 分鐘讓專案初始化完成

## 第二步：建立資料庫

1. 在 Supabase 後台，點左側「SQL Editor」
2. 點「New Query」
3. 複製 `lib/database.sql` 的全部內容貼入
4. 點「Run」執行
5. 確認沒有錯誤

## 第三步：建立 Storage Bucket

1. 點左側「Storage」
2. 點「New bucket」，名稱填 `voucher-attachments`
3. 勾選「Public bucket」（讓附件可公開存取）
4. 點「Save」

## 第四步：取得 API Keys

1. 點左側「Project Settings」→「API」
2. 複製以下資訊：
   - `Project URL`
   - `anon public` key
   - `service_role` key（點「Reveal」顯示）

## 第五步：設定環境變數

編輯 `.env.local` 檔案，填入剛才複製的資訊：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...（anon key）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...（service role key）
ANTHROPIC_API_KEY=sk-ant-...（下方說明）
```

## 第六步：取得 Anthropic API Key（OCR 功能）

1. 到 https://console.anthropic.com 註冊帳號
2. 點「API Keys」→「Create Key」
3. 複製 API Key 填入 `.env.local`

## 第七步：建立第一個管理員帳號

1. 在 Supabase 後台，點左側「Authentication」→「Users」
2. 點「Invite User」輸入您的 Email
3. 到信箱點擊邀請連結設定密碼
4. 回到 Supabase 後台，點「SQL Editor」執行：

```sql
-- 將 'your@email.com' 換成您的 Email
UPDATE profiles
SET role = 'admin', name = '系統管理員'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

## 第八步：啟動系統

```bash
cd /Users/a_bab/Projects/accounting
npm run dev
```

在瀏覽器開啟 http://localhost:3000 即可使用！

## 新增記帳人員

1. 在 Supabase 後台「Authentication」→「Users」→「Invite User」
2. 輸入記帳人員的 Email
3. 記帳人員登入後，在 SQL Editor 設定其分公司：

```sql
-- 將資訊換成實際值
UPDATE profiles
SET
  role = 'accountant',
  name = '記帳人員姓名',
  branch_id = (SELECT id FROM branches WHERE code = 'magpie')  -- 喜鵲=magpie, 立川=lichuan, 天下=tianxia
WHERE id = (SELECT id FROM auth.users WHERE email = '記帳人員@email.com');
```

## 部署到雲端（Vercel）

1. 到 https://vercel.com 用 GitHub 帳號登入
2. 將 `/Users/a_bab/Projects/accounting` 資料夾推送到 GitHub
3. 在 Vercel 匯入該 GitHub repository
4. 在 Vercel 設定 Environment Variables（與 `.env.local` 相同的四個值）
5. 部署完成後就有公開 URL，所有分公司人員都可以使用
