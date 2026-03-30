# 康復之家記帳系統

多間康復之家的雲端記帳 Web 系統。

## 技術架構

- **前端**：Next.js 14 App Router + TypeScript + Tailwind CSS
- **資料庫**：Supabase (PostgreSQL + Auth + Storage + RLS)
- **AI OCR**：Claude API vision (claude-sonnet-4-6) 辨識發票/收據
- **Excel 匯出**：SheetJS (xlsx)
- **部署**：Vercel + Supabase cloud

## 專案背景

用戶經營多間康復之家（立川、喜鵲、天下財管等），各分公司有不同記帳格式，目標統一成一套系統：
- 各分公司記帳人員可拍照上傳自動記帳
- 總管理者可看跨分公司合併報表

## 三種報表格式

1. **年度總表**（`/reports/annual`）- 月份 × 科目代號的損益彙整（立川格式）
2. **傳票日記簿**（`/vouchers`）- 複式借貸傳票格式（喜鵲格式）
3. **流水帳**（`/reports/ledger`）- 收支日記（天下格式）

## 權限設計

- **admin**：看所有分公司、合併報表、管理用戶
- **accountant**：只能看/編輯自己分公司
- **viewer**：只能看報表

## 科目代號規則

- `4xxx`：revenue（營業收入）
- `5xxx`：cost（營業成本）
- `6xxx`：expense（營業費用）
- `7xxx`：other_income / other_loss（業外）
- `1xxx`：asset（資產）
- `2xxx`：liability（負債）

## 資料庫主要表格

```
branches         - 分公司
profiles         - 使用者（關聯 Supabase Auth）
accounts         - 科目代號（每間分公司各自一份）
vouchers         - 傳票主檔
voucher_lines    - 傳票借貸分錄
```

## 環境設定

需建立 `.env.local`（從現有成員取得，不放進 git）：
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## 開發偏好

- 直接執行，不需要在每個步驟前停下來確認
- 只在真正卡住時才詢問
