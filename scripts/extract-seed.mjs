/* 옛 사이트의 레시피 데이터를 supabase/seed/*.json으로 뽑습니다.
   실행: npm run seed:extract */
import { mkdirSync, writeFileSync } from "node:fs";
import { buildSeed, readLegacy } from "./legacy.mjs";

const outDir = new URL("../supabase/seed/", import.meta.url);
const seed = buildSeed(readLegacy());

mkdirSync(outDir, { recursive: true });
for (const [name, rows] of Object.entries(seed)) {
  writeFileSync(new URL(`${name}.json`, outDir), JSON.stringify(rows, null, 2) + "\n", "utf8");
}

console.log(
  `시드를 만들었습니다: 원료 ${seed.materials.length}, 레시피 ${seed.recipes.length}, ` +
    `레시피 줄 ${seed.recipe_lines.length}, 경고 ${seed.recipe_warnings.length}`
);
