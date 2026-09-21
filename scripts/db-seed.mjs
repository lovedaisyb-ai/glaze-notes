/* supabase/seed/*.json(옛 사이트에서 뽑은 35종)을 데이터베이스에 넣습니다.
   여러 번 돌려도 결과가 같습니다 (id가 고정이고, 시드 레시피의 줄·경고는 지우고 다시 넣음).
   실행: npm run db:seed */
import { readFileSync } from "node:fs";
import { connect } from "./db.mjs";

const read = (name) => JSON.parse(readFileSync(new URL(`../supabase/seed/${name}.json`, import.meta.url), "utf8"));
const materials = read("materials");
const recipes = read("recipes");
const lines = read("recipe_lines");
const warnings = read("recipe_warnings");

const db = await connect();
try {
  await db.query("begin");
  for (const m of materials) {
    await db.query(
      `insert into public.materials (id, owner_id, name_ko, aliases, category)
       values ($1, null, $2, $3, $4)
       on conflict (id) do update set name_ko = excluded.name_ko, aliases = excluded.aliases, category = excluded.category`,
      [m.id, m.name_ko, m.aliases, m.category]);
  }
  for (const r of recipes) {
    await db.query(
      `insert into public.recipes (id, owner_id, slug, name, hanja, atmosphere, temp_text, temp_min_c, surface, note,
                                   source_text, source_url, trust, visibility, art, sort)
       values ($1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       on conflict (id) do update set slug = excluded.slug, name = excluded.name, hanja = excluded.hanja,
         atmosphere = excluded.atmosphere, temp_text = excluded.temp_text, temp_min_c = excluded.temp_min_c,
         surface = excluded.surface, note = excluded.note, source_text = excluded.source_text,
         source_url = excluded.source_url, trust = excluded.trust, visibility = excluded.visibility,
         art = excluded.art, sort = excluded.sort`,
      [r.id, r.slug, r.name, r.hanja, r.atmosphere, r.temp_text, r.temp_min_c, r.surface, r.note,
       r.source_text, r.source_url, r.trust, r.visibility, r.art, r.sort]);
  }
  const ids = recipes.map((r) => r.id);
  await db.query("delete from public.recipe_lines where recipe_id = any($1)", [ids]);
  await db.query("delete from public.recipe_warnings where recipe_id = any($1)", [ids]);
  for (const l of lines) {
    await db.query(
      "insert into public.recipe_lines (recipe_id, material_id, pct, is_addition, sort) values ($1, $2, $3, $4, $5)",
      [l.recipe_id, l.material_id, l.pct, l.is_addition, l.sort]);
  }
  for (const w of warnings) {
    await db.query("insert into public.recipe_warnings (recipe_id, label) values ($1, $2)", [w.recipe_id, w.label]);
  }
  await db.query("commit");
  console.log(`시드를 넣었습니다: 원료 ${materials.length}, 레시피 ${recipes.length}, 줄 ${lines.length}, 경고 ${warnings.length}`);
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error("실패, 모두 되돌렸습니다:", e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
