-- 2026-10-05 鎖住角色與分公司（大V同意；記帳系統還沒正式使用）
-- 問題：profiles 允許使用者新增、修改「自己那一列」，資料庫也給了 authenticated 改 role 欄位的權限，
--       任何人用 Email（或之後 MontiDay 的 Apple／Google）註冊後，都能把自己設成 admin 或任選分公司，
--       進而讀寫所有分公司的住民、健保申報、員工、傳票。
-- 修法：一般登入者不能自己建立 profile、不能改 role／branch_id；只有 admin（或 service role，
--       也就是記帳系統「用戶管理」的 API）可以。另外把傳票自訂欄位兩張表改成跟傳票一樣只看自己分公司。

-- 1. profiles：拿掉「自己新增自己」的規則（註冊頁也一起拿掉，新人由管理員在用戶管理新增）
drop policy if exists "Users can insert own profile" on public.profiles;

-- 2. profiles：觸發器擋住非管理員改角色與分公司（規則只能管「哪幾列」，管不到「哪幾個欄位」，所以用觸發器）
--    security invoker：current_user 才會是呼叫者（authenticated／anon／service_role）
create or replace function public.profiles_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new; -- service_role、資料庫管理者照常
  end if;
  if public.get_my_role() = 'admin' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception '只有管理員可以建立使用者資料';
  end if;
  if new.id is distinct from old.id or new.role is distinct from old.role or new.branch_id is distinct from old.branch_id then
    raise exception '只有管理員可以修改角色或分公司';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- 3. voucher_custom_values：原本任何登入者都能讀寫 → 跟 voucher_lines 一樣看所屬傳票的分公司
drop policy if exists "authenticated read voucher_custom_values" on public.voucher_custom_values;
drop policy if exists "authenticated write voucher_custom_values" on public.voucher_custom_values;
create policy vcv_select on public.voucher_custom_values for select to authenticated using (
  exists (select 1 from public.vouchers v where v.id = voucher_custom_values.voucher_id
          and (public.get_my_role() = 'admin' or v.branch_id = public.get_my_branch_id())));
create policy vcv_write on public.voucher_custom_values for all to authenticated using (
  exists (select 1 from public.vouchers v where v.id = voucher_custom_values.voucher_id
          and public.get_my_role() in ('admin', 'accountant')
          and (public.get_my_role() = 'admin' or v.branch_id = public.get_my_branch_id())))
with check (
  exists (select 1 from public.vouchers v where v.id = voucher_custom_values.voucher_id
          and public.get_my_role() in ('admin', 'accountant')
          and (public.get_my_role() = 'admin' or v.branch_id = public.get_my_branch_id())));

-- 4. custom_field_definitions：原本任何登入者都能讀 → 只看自己分公司（管理員看全部；管理員管理的規則不變）
drop policy if exists "authenticated read custom_field_definitions" on public.custom_field_definitions;
create policy cfd_select on public.custom_field_definitions for select to authenticated using (
  public.get_my_role() = 'admin' or branch_id = public.get_my_branch_id());

-- 5. 既有問題順便修：profiles 有 update_profiles_updated_at 觸發器會寫 NEW.updated_at，但表上沒有這個欄位，
--    導致任何修改 profiles（管理員改角色、用戶管理 API 對既有帳號 upsert）都會失敗。補上欄位。
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
