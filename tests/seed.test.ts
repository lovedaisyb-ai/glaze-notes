import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { baseSignature, baseTotal, validateBase, type RecipeLine } from "@/lib/calc";
import { buildSeed, readLegacy } from "../scripts/legacy.mjs";

type Seed = ReturnType<typeof buildSeed>;

const readSeedFile = (name: string) =>
  JSON.parse(readFileSync(new URL(`../supabase/seed/${name}.json`, import.meta.url), "utf8"));

const legacy = readLegacy();
const seed: Seed = buildSeed(legacy);

const linesOf = (recipeId: string): RecipeLine[] =>
  seed.recipe_lines
    .filter((l) => l.recipe_id === recipeId)
    .map((l) => ({ materialId: l.material_id, pct: l.pct, isAddition: l.is_addition }));

describe("시드 추출", () => {
  it("저장소의 supabase/seed/*.json이 옛 사이트에서 새로 뽑은 결과와 같다", () => {
    for (const name of ["materials", "recipes", "recipe_lines", "recipe_warnings"] as const) {
      expect(readSeedFile(name), `${name}.json — npm run seed:extract로 다시 뽑으세요`).toEqual(seed[name]);
    }
  });

  it("레시피 35종, 원료 38종, 경고 16개", () => {
    expect(seed.recipes).toHaveLength(35);
    expect(seed.materials).toHaveLength(38);
    expect(seed.recipe_warnings).toHaveLength(16);
  });

  it("이름이 같은 원료는 한 행으로 묶인다", () => {
    const names = seed.materials.map((m) => m.name_ko);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n === "장석")).toHaveLength(1);
  });

  it("id는 여러 번 뽑아도 같다", () => {
    expect(buildSeed(readLegacy()).recipes.map((r) => r.id)).toEqual(seed.recipes.map((r) => r.id));
  });
});

describe("레시피 35종", () => {
  it.each(seed.recipes.map((r) => [r.slug, r.id]))("%s — 기본 조성 합이 100", (_slug, id) => {
    expect(validateBase(linesOf(id))).toBeNull();
    expect(Math.abs(baseTotal(linesOf(id)) - 100)).toBeLessThanOrEqual(0.1);
  });

  it("신뢰 등급: sourced 12종, unverified 23종", () => {
    const sourced = seed.recipes.filter((r) => r.trust === "sourced").map((r) => r.slug);
    expect(sourced.sort()).toEqual(
      ["leach", "raku", "ash", "g2926b", "g2934", "mgbase3", "g1214z1", "g1947u", "g2571a", "g2240", "g1916q", "g2931k"].sort()
    );
    expect(seed.recipes.filter((r) => r.trust === "unverified")).toHaveLength(23);
  });

  it("같은 기본 조성 묶음이 옛 사이트의 baseSig와 같다", () => {
    const legacySig = new Map(
      legacy.recipes.map((r: { id: string; base: [string, number][] }) => [
        r.id,
        r.base.map(([n, p]) => `${n}:${p}`).sort().join("|"),
      ])
    );
    const newSig = new Map(seed.recipes.map((r) => [r.slug, baseSignature(linesOf(r.id))]));
    const slugs = seed.recipes.map((r) => r.slug);
    for (const a of slugs) {
      for (const b of slugs) {
        expect([a, b, newSig.get(a) === newSig.get(b)]).toEqual([a, b, legacySig.get(a) === legacySig.get(b)]);
      }
    }
  });
});
