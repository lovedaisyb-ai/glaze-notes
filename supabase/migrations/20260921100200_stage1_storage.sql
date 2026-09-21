-- 시편 사진 버킷 (비공개, 장당 10MB, 이미지 파일만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('test-photos', 'test-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp']);

-- 1단계: 자기 폴더(<user_id>/...)의 파일만 올리고, 보고, 지울 수 있음.
-- (공개·회원 공개 시편 사진을 남이 보는 것은 2단계에서 정책을 더함)
create policy "본인 사진 보기" on storage.objects for select to authenticated
  using (bucket_id = 'test-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "본인 사진 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'test-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "본인 사진 바꾸기" on storage.objects for update to authenticated
  using (bucket_id = 'test-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'test-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "본인 사진 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'test-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
