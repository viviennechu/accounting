-- 2026-10-05 發票照片空間 voucher-attachments：原本任何登入者都能列出、讀取、上傳
-- （MontiDay 家庭同步開放 Apple／Google 註冊後，任何家長登入都能瀏覽全部發票照片）
-- 改成：管理員全部；會計只能動自己分公司的資料夾（上傳路徑是「分公司 ID/檔名」）
-- 註：bucket 仍是 public，記帳系統用公開網址顯示照片；拿到確切網址的人還是看得到，之後改成私有＋限時網址
drop policy if exists allow_read on storage.objects;
drop policy if exists allow_upload on storage.objects;
create policy voucher_attachments_select on storage.objects for select to authenticated using (
  bucket_id = 'voucher-attachments'
  and (public.get_my_role() = 'admin'
       or (public.get_my_role() = 'accountant' and (storage.foldername(name))[1] = public.get_my_branch_id()::text)));
create policy voucher_attachments_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'voucher-attachments'
  and (public.get_my_role() = 'admin'
       or (public.get_my_role() = 'accountant' and (storage.foldername(name))[1] = public.get_my_branch_id()::text)));
