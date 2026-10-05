-- 驗證 20261005_lock_down_roles：用模擬身分測，全部在交易裡，最後 rollback，不留資料
begin;
create temp table r (n int, test text, result text) on commit drop;
grant all on r to authenticated;

-- 準備：一個陌生人（沒有 profile）、一個某分公司的會計（暫時建立），都只存在這個交易裡
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'stranger-test@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'accountant-test@example.com', 'authenticated', 'authenticated');
insert into public.profiles (id, name, role, branch_id)
  values ('00000000-0000-0000-0000-0000000000a2', '測試會計', 'accountant', (select id from public.branches order by id limit 1));

-- 洛先生（現有管理員）的編號先查好：切成一般使用者後就讀不到 auth.users
select set_config('test.admin_id', (select id::text from auth.users where email = 'royshencr@gmail.com'), true);

-- ── 陌生人 ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.profiles (id, name, role) values ('00000000-0000-0000-0000-0000000000a1', 'x', 'admin');
    insert into r values (1, '陌生人自己建立 admin 資料', '沒被擋（錯）');
  exception when others then insert into r values (1, '陌生人自己建立 admin 資料', '被擋：' || sqlerrm); end;
end $$;
insert into r select 2, '陌生人讀住民', count(*)::text from public.residents;
insert into r select 3, '陌生人讀健保申報', count(*)::text from public.nhi_claims;
insert into r select 4, '陌生人讀傳票', count(*)::text from public.vouchers;
insert into r select 5, '陌生人讀傳票自訂欄位值', count(*)::text from public.voucher_custom_values;
insert into r select 6, '陌生人讀自訂欄位定義', count(*)::text from public.custom_field_definitions;
insert into r select 7, '陌生人讀員工', count(*)::text from public.employees;

-- ── 會計（非管理員）──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a2';
    insert into r values (8, '會計把自己改成 admin', '沒被擋（錯）');
  exception when others then insert into r values (8, '會計把自己改成 admin', '被擋：' || sqlerrm); end;
  begin
    update public.profiles set branch_id = (select id from public.branches order by id desc limit 1) where id = '00000000-0000-0000-0000-0000000000a2';
    insert into r values (9, '會計自己換分公司', case when (select count(*) from public.branches) < 2 then '只有一間分公司，無法測' else '沒被擋（錯）' end);
  exception when others then insert into r values (9, '會計自己換分公司', '被擋：' || sqlerrm); end;
  begin
    update public.profiles set name = '測試會計改名' where id = '00000000-0000-0000-0000-0000000000a2';
    insert into r values (10, '會計改自己的名字（應該可以）', '成功');
  exception when others then insert into r values (10, '會計改自己的名字（應該可以）', '被擋（錯）：' || sqlerrm); end;
end $$;
insert into r select 11, '會計讀到別間分公司的住民數（應為 0）', count(*)::text from public.residents
  where branch_id is distinct from (select branch_id from public.profiles where id = '00000000-0000-0000-0000-0000000000a2');

-- ── 現有管理員（洛先生）可以改別人的角色 ──
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.admin_id'), 'role', 'authenticated')::text, true);
do $$ begin
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a2';
    insert into r values (12, '管理員改別人的角色（應該可以）', case when found then '成功' else '沒有更新到（錯）' end);
  exception when others then insert into r values (12, '管理員改別人的角色（應該可以）', '被擋（錯）：' || sqlerrm); end;
end $$;

reset role;
select n, test, result from r order by n;
rollback;
