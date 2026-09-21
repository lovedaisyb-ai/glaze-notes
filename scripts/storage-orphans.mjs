/* test-photos 버킷에서 주인(auth.users)이 없는 폴더를 찾습니다.
   Supabase 대시보드에서 사용자를 직접 지웠거나, 탈퇴 중 파일 삭제가 실패한 경우를 치우는 용도.
   실행: npm run storage:orphans            — 찾기만
         npm run storage:orphans -- --delete — 찾아서 지우기 */
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const BUCKET = "test-photos";

async function listFiles(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw error;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listFiles(path)));
      else out.push(path);
    }
    if (data.length < 100) return out;
  }
}

const users = new Set();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  data.users.forEach((u) => users.add(u.id));
  if (data.users.length < 1000) break;
}

const { data: top, error } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
if (error) throw error;
const orphanDirs = top.filter((i) => i.id === null && !users.has(i.name)).map((i) => i.name);
const files = (await Promise.all(orphanDirs.map(listFiles))).flat();
console.log(`주인 없는 폴더 ${orphanDirs.length}개, 파일 ${files.length}개`);

if (process.argv.includes("--delete") && files.length) {
  for (let i = 0; i < files.length; i += 100) await admin.storage.from(BUCKET).remove(files.slice(i, i + 100));
  console.log("지웠습니다.");
}
