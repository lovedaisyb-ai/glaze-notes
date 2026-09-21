/* 비밀 키(SUPABASE_SECRET_KEY)를 쓰는 관리용 코드. RLS를 건너뛰므로
   서버(라우트 핸들러·서버 액션)와 스크립트·테스트에서만 씁니다. 브라우저에서 불리면 멈춥니다. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("lib/db/admin.ts는 브라우저에서 쓸 수 없습니다.");
}

export const PHOTO_BUCKET = "test-photos";

export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error(".env.local에 NEXT_PUBLIC_SUPABASE_URL과 SUPABASE_SECRET_KEY가 필요합니다.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/* 폴더 안의 파일 경로를 하위 폴더까지 모두 모읍니다 */
async function listFiles(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw error;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) out.push(...(await listFiles(admin, path))); // 폴더
      else out.push(path);
    }
    if (data.length < 100) return out;
  }
}

/* 회원 탈퇴.
   1) 계정을 지우면 DB의 profiles·studios·kilns·materials·recipes·tests·test_photos가
      외래 키(on delete cascade)로 함께 지워집니다.
   2) 사진 파일은 DB 행과 따로 저장되므로, Storage API로 <user_id>/ 폴더를 비웁니다.
      (storage.objects를 SQL로 지우면 실제 파일이 남으므로 쓰지 않습니다.)
   계정을 먼저 지워, 계정이 남아 있는데 사진만 사라지는 일이 없게 합니다.
   파일 삭제가 실패하면 남은 개수를 돌려주고, scripts/storage-orphans로 나중에 치웁니다. */
export async function deleteAccount(userId: string): Promise<{ removedFiles: number; leftFiles: number }> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
  const files = await listFiles(admin, userId);
  let removed = 0;
  for (let i = 0; i < files.length; i += 100) {
    const { data, error: rmError } = await admin.storage.from(PHOTO_BUCKET).remove(files.slice(i, i + 100));
    if (!rmError) removed += data.length;
  }
  return { removedFiles: removed, leftFiles: files.length - removed };
}
