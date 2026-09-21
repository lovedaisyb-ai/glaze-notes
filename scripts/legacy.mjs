/* 옛 사이트(public/legacy/index.html)에서 RECIPES·WARN 데이터를 코드로 꺼냅니다.
   손으로 옮겨 적지 않기 위한 도구입니다. 시드 추출 스크립트와 테스트가 함께 씁니다. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

export const LEGACY_PATH = new URL("../public/legacy/index.html", import.meta.url);

/* `const NAME = ` 뒤의 배열·객체 리터럴을 괄호 짝을 세어 잘라냅니다 */
function sliceLiteral(html, name) {
  const head = `const ${name} = `;
  const at = html.indexOf(head);
  if (at < 0) throw new Error(`${name}을(를) 찾지 못했습니다.`);
  const start = at + head.length;
  const open = html[start];
  const close = open === "[" ? "]" : open === "{" ? "}" : null;
  if (!close) throw new Error(`${name} 뒤에 배열이나 객체가 없습니다.`);
  let depth = 0;
  let quote = null;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`${name}의 끝을 찾지 못했습니다.`);
}

/* 데이터 리터럴만 빈 샌드박스에서 평가합니다 (페이지 코드는 실행하지 않음) */
const evalLiteral = (src) => vm.runInNewContext(`(${src})`, Object.create(null), { timeout: 1000 });

export function readLegacy(path = LEGACY_PATH) {
  const html = readFileSync(path, "utf8");
  return {
    recipes: evalLiteral(sliceLiteral(html, "RECIPES")),
    warn: evalLiteral(sliceLiteral(html, "WARN")),
  };
}

/* 이름에서 늘 같은 uuid를 만듭니다 (RFC 4122 v5). 시드를 여러 번 넣어도 id가 같게 */
const NAMESPACE = "6f1b8c2e-3a4d-4e5f-9a0b-1c2d3e4f5a6b";
export function uuidV5(name, namespace = NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const firstCelsius = (text) => {
  const m = /(\d{3,4})\s*℃/.exec(text);
  return m ? parseInt(m[1], 10) : null;
};

/* 옛 데이터를 DB 시드 모양(materials·recipes·recipe_lines·recipe_warnings)으로 바꿉니다.
   원료 이름이 같으면 같은 materials 행으로 묶습니다. */
export function buildSeed({ recipes, warn }) {
  const materials = new Map();
  const materialId = (name, category) => {
    if (!materials.has(name)) {
      materials.set(name, { id: uuidV5(`material:${name}`), name_ko: name, aliases: [], category });
    } else if (materials.get(name).category !== category) {
      throw new Error(`원료 "${name}"의 분류가 레시피마다 다릅니다.`);
    }
    return materials.get(name).id;
  };

  const recipeRows = [];
  const lineRows = [];
  const warningRows = [];

  recipes.forEach((r, order) => {
    const id = uuidV5(`recipe:${r.id}`);
    const sourceText = [r.source?.label, r.sourceText].filter(Boolean).join(" · ") || null;
    recipeRows.push({
      id,
      slug: r.id,
      owner_id: null,
      name: r.name,
      hanja: r.hanja || null,
      atmosphere: r.atmos,
      temp_text: r.temp,
      temp_min_c: firstCelsius(r.temp),
      surface: r.surface,
      note: r.note,
      source_text: sourceText,
      source_url: r.source?.url ?? null,
      trust: r.trust,
      visibility: "public",
      art: { c1: r.c1, c2: r.c2, texture: r.texture, light: !!r.light },
      sort: order,
    });
    const lines = [
      ...r.base.map(([name, pct, cat]) => ({ name, pct, cat, add: false })),
      ...r.add.map(([name, pct, cat]) => ({ name, pct, cat, add: true })),
    ];
    lines.forEach((l, i) => {
      lineRows.push({
        recipe_id: id,
        material_id: materialId(l.name, l.cat),
        pct: l.pct,
        is_addition: l.add,
        sort: i,
      });
    });
    [].concat(warn[r.id] || []).forEach((label) => warningRows.push({ recipe_id: id, label }));
  });

  return {
    materials: [...materials.values()],
    recipes: recipeRows,
    recipe_lines: lineRows,
    recipe_warnings: warningRows,
  };
}
