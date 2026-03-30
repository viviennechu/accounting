-- ============================================================
-- 多分公司記帳系統 - Supabase 資料庫 Schema
-- 到 Supabase 後台 > SQL Editor 執行此檔案
-- ============================================================

-- 分公司
CREATE TABLE branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 用戶資料（對應 auth.users）
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  branch_id UUID REFERENCES branches(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'viewer')) DEFAULT 'accountant',
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 科目代號
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('revenue', 'cost', 'expense', 'asset', 'liability', 'other_income', 'other_loss')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, code)
);

-- 傳票主檔
CREATE TABLE vouchers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE NOT NULL,
  voucher_no TEXT,
  date DATE NOT NULL,
  description TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 傳票明細（借貸分錄）
CREATE TABLE voucher_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES accounts(id) NOT NULL,
  debit NUMERIC(12,0) DEFAULT 0,
  credit NUMERIC(12,0) DEFAULT 0,
  note TEXT,
  line_order INTEGER DEFAULT 0
);

-- 其他機構同期比較資料（手動輸入）
CREATE TABLE benchmark_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC(12,0) DEFAULT 0,
  UNIQUE(branch_id, account_code, year, month)
);

-- ============================================================
-- 自動更新 updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security（權限控制）
-- ============================================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_data ENABLE ROW LEVEL SECURITY;

-- 取得目前用戶的 role 和 branch_id
CREATE OR REPLACE FUNCTION get_my_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_branch_id() RETURNS UUID AS $$
  SELECT branch_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- branches: admin 可看全部，其他只看自己的分公司
CREATE POLICY "branches_select" ON branches FOR SELECT USING (
  get_my_role() = 'admin' OR id = get_my_branch_id()
);
CREATE POLICY "branches_admin" ON branches FOR ALL USING (get_my_role() = 'admin');

-- profiles: 只能看自己或同分公司
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
  id = auth.uid() OR get_my_role() = 'admin'
);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_admin" ON profiles FOR ALL USING (get_my_role() = 'admin');

-- accounts: admin 看全部，其他只看自己分公司
CREATE POLICY "accounts_select" ON accounts FOR SELECT USING (
  get_my_role() = 'admin' OR branch_id = get_my_branch_id()
);
CREATE POLICY "accounts_write" ON accounts FOR ALL USING (
  get_my_role() IN ('admin', 'accountant')
  AND (branch_id = get_my_branch_id() OR get_my_role() = 'admin')
);

-- vouchers: admin 看全部，其他只看自己分公司
CREATE POLICY "vouchers_select" ON vouchers FOR SELECT USING (
  get_my_role() = 'admin' OR branch_id = get_my_branch_id()
);
CREATE POLICY "vouchers_write" ON vouchers FOR ALL USING (
  get_my_role() IN ('admin', 'accountant')
  AND (branch_id = get_my_branch_id() OR get_my_role() = 'admin')
);

-- voucher_lines: 跟著 vouchers 走
CREATE POLICY "voucher_lines_select" ON voucher_lines FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM vouchers v WHERE v.id = voucher_id
    AND (get_my_role() = 'admin' OR v.branch_id = get_my_branch_id())
  )
);
CREATE POLICY "voucher_lines_write" ON voucher_lines FOR ALL USING (
  EXISTS (
    SELECT 1 FROM vouchers v WHERE v.id = voucher_id
    AND get_my_role() IN ('admin', 'accountant')
    AND (v.branch_id = get_my_branch_id() OR get_my_role() = 'admin')
  )
);

-- benchmark_data
CREATE POLICY "benchmark_select" ON benchmark_data FOR SELECT USING (
  get_my_role() = 'admin' OR branch_id = get_my_branch_id()
);
CREATE POLICY "benchmark_write" ON benchmark_data FOR ALL USING (
  get_my_role() IN ('admin', 'accountant')
);

-- ============================================================
-- 初始資料：三間分公司
-- ============================================================
INSERT INTO branches (name, code) VALUES
  ('立川康復之家', 'lichuan'),
  ('喜鵲康復之家', 'magpie'),
  ('天下財管', 'tianxia');

-- ============================================================
-- 初始科目代號（共用科目，branch_id = NULL 表示所有分公司共用）
-- 注意：實際使用時每間分公司需有自己的科目，這裡以立川示範
-- ============================================================

-- 先取得立川的 id 再插入（在 SQL Editor 執行時請先確認 branch_id）
-- 以下使用子查詢動態取得 branch_id

WITH b AS (SELECT id FROM branches WHERE code = 'lichuan')
INSERT INTO accounts (branch_id, code, name, type) VALUES
-- 流動資產
((SELECT id FROM b), '1105', '現金-前檯', 'asset'),
((SELECT id FROM b), '1106', '現金-行政金', 'asset'),
((SELECT id FROM b), '1110', '銀行存款-沈君叡郵局', 'asset'),
((SELECT id FROM b), '1114', '銀行存款-合庫公帳', 'asset'),
((SELECT id FROM b), '1116', '現金-瑩珊', 'asset'),
((SELECT id FROM b), '1133', '應收帳款-住民月費', 'asset'),
((SELECT id FROM b), '1137', '其他應收款', 'asset'),
((SELECT id FROM b), '1150', '員工借支', 'asset'),
((SELECT id FROM b), '1240', '其他預付款', 'asset'),
((SELECT id FROM b), '1264', '暫付款', 'asset'),
((SELECT id FROM b), '1265', '暫付款-社會局', 'asset'),
-- 流動負債
((SELECT id FROM b), '2130', '應付帳款', 'liability'),
((SELECT id FROM b), '2140', '應付薪資', 'liability'),
((SELECT id FROM b), '2144', '應付費用', 'liability'),
((SELECT id FROM b), '2145', '應付費用-員工', 'liability'),
((SELECT id FROM b), '2147', '應付費用-勞保', 'liability'),
((SELECT id FROM b), '2148', '應付費用-健保', 'liability'),
((SELECT id FROM b), '2149', '應付費用-勞退', 'liability'),
((SELECT id FROM b), '2160', '其他應付款', 'liability'),
((SELECT id FROM b), '2165', '預收月費', 'liability'),
((SELECT id FROM b), '2205', '暫收款', 'liability'),
((SELECT id FROM b), '2990', '代收勞健保', 'liability'),
-- 營業收入
((SELECT id FROM b), '4100', '住民月費(健保身份)', 'revenue'),
((SELECT id FROM b), '4102', '大健保', 'revenue'),
((SELECT id FROM b), '4103', '小健保', 'revenue'),
((SELECT id FROM b), '4104', '新北社會局補助款', 'revenue'),
-- 營業成本
((SELECT id FROM b), '5101', '住民買菜金', 'cost'),
((SELECT id FROM b), '5102', '住民雜支', 'cost'),
((SELECT id FROM b), '5103', '復健基金', 'cost'),
((SELECT id FROM b), '5104', '社會局個案支出', 'cost'),
((SELECT id FROM b), '5105', '物資運費', 'cost'),
((SELECT id FROM b), '5106', '社會局醫療支出', 'cost'),
-- 營業費用
((SELECT id FROM b), '6010', '薪資支出', 'expense'),
((SELECT id FROM b), '6020', '租金支出', 'expense'),
((SELECT id FROM b), '6030', '文具用品', 'expense'),
((SELECT id FROM b), '6060', '郵資費', 'expense'),
((SELECT id FROM b), '6070', '修繕費', 'expense'),
((SELECT id FROM b), '6080', '廣告費', 'expense'),
((SELECT id FROM b), '6101', '保險費-勞保', 'expense'),
((SELECT id FROM b), '6102', '保險費-健保', 'expense'),
((SELECT id FROM b), '6110', '交際費', 'expense'),
((SELECT id FROM b), '6120', '水費', 'expense'),
((SELECT id FROM b), '6130', '電費', 'expense'),
((SELECT id FROM b), '6140', '退休金-勞退', 'expense'),
((SELECT id FROM b), '6180', '伙食費', 'expense'),
((SELECT id FROM b), '6190', '職工福利', 'expense'),
((SELECT id FROM b), '6210', '主任獎勵金', 'expense'),
((SELECT id FROM b), '6230', '其他費用', 'expense'),
((SELECT id FROM b), '6250', '雜項購置', 'expense'),
((SELECT id FROM b), '6260', '雜費', 'expense'),
((SELECT id FROM b), '6270', '手續費', 'expense'),
((SELECT id FROM b), '6290', '管理費', 'expense'),
((SELECT id FROM b), '6300', '檢測費', 'expense'),
((SELECT id FROM b), '6310', '交通費', 'expense'),
((SELECT id FROM b), '6320', '公會費', 'expense'),
((SELECT id FROM b), '6330', '主任獎金', 'expense'),
((SELECT id FROM b), '6350', '網路電信費', 'expense'),
((SELECT id FROM b), '6390', '勞務費', 'expense'),
((SELECT id FROM b), '6391', '記帳費', 'expense'),
((SELECT id FROM b), '6470', '蟲鼠清潔費', 'expense'),
-- 業外收益
((SELECT id FROM b), '7040', '利息收入', 'other_income'),
((SELECT id FROM b), '7100', '其他收入', 'other_income'),
-- 業外損失
((SELECT id FROM b), '8070', '其他損失', 'other_loss');

-- 喜鵲科目（複製相同科目）
WITH b AS (SELECT id FROM branches WHERE code = 'magpie')
INSERT INTO accounts (branch_id, code, name, type)
SELECT (SELECT id FROM b), code, name, type FROM accounts
WHERE branch_id = (SELECT id FROM branches WHERE code = 'lichuan');

-- 天下科目（複製相同科目）
WITH b AS (SELECT id FROM branches WHERE code = 'tianxia')
INSERT INTO accounts (branch_id, code, name, type)
SELECT (SELECT id FROM b), code, name, type FROM accounts
WHERE branch_id = (SELECT id FROM branches WHERE code = 'lichuan');
