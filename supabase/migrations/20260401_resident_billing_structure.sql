-- Migration: resident-billing-structure
-- 重構住民計費欄位：月費住民 vs 社會局住民

-- 1.1 新增 resident_type enum
DO $$ BEGIN
  CREATE TYPE resident_type_enum AS ENUM ('monthly_fee', 'social_welfare');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1.1 新增 resident_type 欄位
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS resident_type resident_type_enum;

-- 1.2 新增其他新欄位
ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS monthly_fee integer,
  ADD COLUMN IF NOT EXISTS welfare_amount integer,
  ADD COLUMN IF NOT EXISTS welfare_type text CHECK (welfare_type IN ('disability', 'homeless') OR welfare_type IS NULL),
  ADD COLUMN IF NOT EXISTS welfare_doc_no text,
  ADD COLUMN IF NOT EXISTS nhi_identity text;

-- 1.3 遷移 subsidy_type = 'self' → monthly_fee 住民
UPDATE residents
SET
  resident_type = 'monthly_fee',
  monthly_fee = COALESCE(monthly_self_pay, 0)
WHERE subsidy_type = 'self';

-- 1.4 遷移 subsidy_type = 'subsidy' → social_welfare 住民
UPDATE residents
SET
  resident_type = 'social_welfare',
  welfare_amount = COALESCE(monthly_subsidy, 0)
WHERE subsidy_type = 'subsidy';

-- 處理 'both' 類型（若有）：視為 monthly_fee，保留自付金額
UPDATE residents
SET
  resident_type = 'monthly_fee',
  monthly_fee = COALESCE(monthly_self_pay, 0)
WHERE subsidy_type = 'both';

-- 未設定的預設為 monthly_fee
UPDATE residents
SET resident_type = 'monthly_fee'
WHERE resident_type IS NULL;

-- 設定 NOT NULL 約束
ALTER TABLE residents
  ALTER COLUMN resident_type SET NOT NULL;

-- 1.5 移除舊欄位
ALTER TABLE residents
  DROP COLUMN IF EXISTS subsidy_type,
  DROP COLUMN IF EXISTS monthly_self_pay,
  DROP COLUMN IF EXISTS monthly_subsidy;
