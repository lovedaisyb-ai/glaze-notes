/* RLS 테스트 — 개발용 Supabase 프로젝트에 실제로 접속합니다.
   비밀 키로 시험용 계정 둘(A, B)을 만든 뒤, 각자 publishable 키로 로그인해 규칙을 확인하고,
   끝나면 계정과 사진을 지웁니다. .env.local 값이 없으면 건너뜁니다. */
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const hasEnv = Boolean(URL_ && PUBLISHABLE && process.env.SUPABASE_SECRET_KEY);

const seedMaterials = JSON.parse(
  readFileSync(new URL("../supabase/seed/materials.json", import.meta.url), "utf8")
) as { id: string; name_ko: string }[];
const FELDSPAR = seedMaterials.find((m) => m.name_ko === "장석")!.id;
const SEED_CELADON = "063867c0-c3f3-567f-b0e0-db1208bcf68d";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const client = () =>
  createClient(URL_!, PUBLISHABLE!, { auth: { persistSession: false, autoRefreshToken: false } });

describe.skipIf(!hasEnv)("RLS (개발용 Supabase)", { timeout: 30_000 }, () => {
  let admin: SupabaseClient;
  let deleteAccount: (id: string) => Promise<{ removedFiles: number; leftFiles: number }>;
  let anon: SupabaseClient;
  const A = { db: null as unknown as SupabaseClient, id: "" };
  const B = { db: null as unknown as SupabaseClient, id: "" };
  const made: { kilnA?: string; privRecipe?: string; pubRecipe?: string; privTest?: string; membersTest?: string; bTestOnA?: string } = {};

  async function makeUser(tag: string, u: { db: SupabaseClient; id: string }) {
    const email = `rls-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
    const password = `pw-${crypto.randomUUID()}`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
    const { error: signInError } = await u.db.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }

  beforeAll(async () => {
    const mod = await import("@/lib/db/admin");
    admin = mod.createAdminClient();
    deleteAccount = mod.deleteAccount;
    anon = client();
    A.db = client();
    B.db = client();
    await makeUser("a", A);
    await makeUser("b", B);
  });

  afterAll(async () => {
    for (const u of [A, B]) if (u.id) await deleteAccount(u.id).catch(() => {});
  });

  it("로그인 없이도 시드 레시피 35종과 조성을 읽을 수 있다", async () => {
    const { count } = await anon.from("recipes").select("id", { count: "exact", head: true }).is("owner_id", null);
    expect(count).toBe(35);
    const { data: lines } = await anon.from("recipe_lines").select("id").eq("recipe_id", SEED_CELADON);
    expect(lines!.length).toBeGreaterThan(0);
  });

  it("A가 가마·레시피·시편을 만든다 (기본 공개 범위는 private)", async () => {
    const kiln = await A.db.from("kilns").insert({ owner_id: A.id, type: "electric", name: "A 가마" }).select().single();
    expect(kiln.error).toBeNull();
    made.kilnA = kiln.data!.id;

    const priv = await A.db.from("recipes").insert({ owner_id: A.id, name: "A 비공개 유약" }).select().single();
    expect(priv.error).toBeNull();
    expect(priv.data!.visibility).toBe("private");
    expect(priv.data!.trust).toBe("unverified");
    made.privRecipe = priv.data!.id;
    const line = await A.db.from("recipe_lines").insert({ recipe_id: made.privRecipe, material_id: FELDSPAR, pct: 100 });
    expect(line.error).toBeNull();

    const pub = await A.db.from("recipes").insert({ owner_id: A.id, name: "A 공개 유약", visibility: "public" }).select().single();
    expect(pub.error).toBeNull();
    made.pubRecipe = pub.data!.id;

    const t1 = await A.db.from("tests")
      .insert({ owner_id: A.id, recipe_id: made.privRecipe, kiln_id: made.kilnA, application: "pour", result_note: "비공개" })
      .select().single();
    expect(t1.error).toBeNull();
    expect(t1.data!.visibility).toBe("private");
    made.privTest = t1.data!.id;

    const t2 = await A.db.from("tests")
      .insert({ owner_id: A.id, recipe_id: SEED_CELADON, visibility: "members", result_note: "회원 공개" })
      .select().single();
    expect(t2.error).toBeNull();
    made.membersTest = t2.data!.id;
  });

  it("B는 A의 비공개 레시피·시편·가마·프로필을 볼 수 없다", async () => {
    expect((await B.db.from("tests").select("id").eq("id", made.privTest!)).data).toEqual([]);
    expect((await B.db.from("recipes").select("id").eq("id", made.privRecipe!)).data).toEqual([]);
    expect((await B.db.from("recipe_lines").select("id").eq("recipe_id", made.privRecipe!)).data).toEqual([]);
    expect((await B.db.from("kilns").select("id").eq("id", made.kilnA!)).data).toEqual([]);
    expect((await B.db.from("profiles").select("id").eq("user_id", A.id)).data).toEqual([]);
    expect((await A.db.from("tests").select("id").eq("id", made.privTest!)).data).toHaveLength(1);
  });

  it("회원 공개(members)는 로그인한 B에게만 보이고, 로그인 안 한 사람에게는 안 보인다", async () => {
    expect((await B.db.from("tests").select("id").eq("id", made.membersTest!)).data).toHaveLength(1);
    expect((await anon.from("tests").select("id").eq("id", made.membersTest!)).data).toEqual([]);
    expect((await anon.from("recipes").select("id").eq("id", made.pubRecipe!)).data).toHaveLength(1);
  });

  it("B는 A의 시편을 고치거나 지울 수 없고, A의 가마나 A 이름으로 기록할 수 없다", async () => {
    const upd = await B.db.from("tests").update({ result_note: "B가 고침" }).eq("id", made.membersTest!).select();
    expect(upd.data).toEqual([]);
    const del = await B.db.from("tests").delete().eq("id", made.membersTest!).select();
    expect(del.data).toEqual([]);
    const withAKiln = await B.db.from("tests").insert({ owner_id: B.id, recipe_id: SEED_CELADON, kiln_id: made.kilnA });
    expect(withAKiln.error).not.toBeNull();
    const asA = await B.db.from("recipes").insert({ owner_id: A.id, name: "사칭" });
    expect(asA.error).not.toBeNull();
    const onPriv = await B.db.from("tests").insert({ owner_id: B.id, recipe_id: made.privRecipe });
    expect(onPriv.error).not.toBeNull();
  });

  it("아무도 시드 레시피를 고치거나 지울 수 없다", async () => {
    const upd = await A.db.from("recipes").update({ name: "바꿈" }).eq("id", SEED_CELADON).select();
    expect(upd.data).toEqual([]);
    const del = await A.db.from("recipes").delete().eq("id", SEED_CELADON).select();
    expect(del.data).toEqual([]);
    const { data } = await anon.from("recipes").select("name").eq("id", SEED_CELADON).single();
    expect(data!.name).toBe("청자유");
  });

  it("사용자는 신뢰 등급을 tested로 직접 바꿀 수 없다", async () => {
    const ins = await A.db.from("recipes").insert({ owner_id: A.id, name: "자칭 검증", trust: "tested" });
    expect(ins.error?.message).toContain("tested");
    const upd = await A.db.from("recipes").update({ trust: "tested" }).eq("id", made.pubRecipe!);
    expect(upd.error?.message).toContain("tested");
  });

  it("시편 기록이 있는 레시피는 지울 수 없고, 이유를 알려 준다", async () => {
    const del = await A.db.from("recipes").delete().eq("id", made.privRecipe!);
    expect(del.error?.details).toBe("recipe_has_tests");
    expect(del.error?.message).toContain("시편 기록");
  });

  it("사진은 자기 폴더에만 올리고, 남의 사진은 볼 수 없다", async () => {
    const own = `${A.id}/${made.privTest}/tile.png`;
    const up = await A.db.storage.from("test-photos").upload(own, PNG, { contentType: "image/png" });
    expect(up.error).toBeNull();
    const photo = await A.db.from("test_photos").insert({ test_id: made.privTest, storage_path: own });
    expect(photo.error).toBeNull();

    const intoB = await A.db.storage.from("test-photos").upload(`${B.id}/x/tile.png`, PNG, { contentType: "image/png" });
    expect(intoB.error).not.toBeNull();
    expect((await B.db.storage.from("test-photos").download(own)).error).not.toBeNull();
    expect((await A.db.storage.from("test-photos").download(own)).error).toBeNull();
    expect((await B.db.from("test_photos").select("id").eq("storage_path", own)).data).toEqual([]);
  });

  it("회원 탈퇴하면 A의 모든 행과 사진이 지워지고, B가 A의 공개 레시피로 남긴 기록은 남는다", async () => {
    const bTest = await B.db.from("tests").insert({ owner_id: B.id, recipe_id: made.pubRecipe, result_note: "B 기록" }).select().single();
    expect(bTest.error).toBeNull();
    made.bTestOnA = bTest.data!.id;

    const result = await deleteAccount(A.id);
    expect(result).toEqual({ removedFiles: 1, leftFiles: 0 });

    for (const [table, col] of [["profiles", "user_id"], ["studios", "owner_id"], ["kilns", "owner_id"],
                                ["materials", "owner_id"], ["recipes", "owner_id"], ["tests", "owner_id"]] as const) {
      const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq(col, A.id);
      expect([table, count]).toEqual([table, 0]);
    }
    const { count: photos } = await admin.from("test_photos").select("id", { count: "exact", head: true }).eq("test_id", made.privTest!);
    expect(photos).toBe(0);
    const { data: files } = await admin.storage.from("test-photos").list(A.id);
    expect(files).toEqual([]);

    const { data: kept } = await admin.from("tests").select("recipe_id, result_note").eq("id", made.bTestOnA).single();
    expect(kept).toEqual({ recipe_id: null, result_note: "B 기록" });
    A.id = "";
  });
});
