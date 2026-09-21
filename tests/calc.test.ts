import { describe, expect, it } from "vitest";
import {
  additionTotal,
  baseSignature,
  baseTotal,
  scaleRecipe,
  validateBase,
  type RecipeLine,
} from "@/lib/calc";

/* 청자유 (옛 사이트 celadon): 장석 40 · 규석 25 · 석회석 20 · 카올린 15 + 산화철 1.2 */
const celadon: RecipeLine[] = [
  { materialId: "장석", pct: 40, isAddition: false },
  { materialId: "규석", pct: 25, isAddition: false },
  { materialId: "석회석", pct: 20, isAddition: false },
  { materialId: "카올린", pct: 15, isAddition: false },
  { materialId: "산화철", pct: 1.2, isAddition: true },
];

describe("scaleRecipe", () => {
  it("만들 양 1000g이면 비율 그대로 g이 되고, 첨가물도 같은 식으로 더한다", () => {
    expect(scaleRecipe(celadon, 1000).map((l) => l.grams)).toEqual([400, 250, 200, 150, 12]);
  });

  it("소수 첫째 자리에서 반올림한다", () => {
    const lines: RecipeLine[] = [{ materialId: "네펠린", pct: 16.62, isAddition: false }];
    expect(scaleRecipe(lines, 1234)[0].grams).toBe(205.1); // 205.0908
    expect(scaleRecipe(celadon, 333).map((l) => l.grams)).toEqual([133.2, 83.3, 66.6, 50, 4]);
  });

  it("만들 양이 0 이하이거나 숫자가 아니면 거절한다", () => {
    expect(() => scaleRecipe(celadon, 0)).toThrow(RangeError);
    expect(() => scaleRecipe(celadon, -5)).toThrow(RangeError);
    expect(() => scaleRecipe(celadon, Number.NaN)).toThrow(RangeError);
  });
});

describe("baseTotal / additionTotal", () => {
  it("기본 조성과 첨가물을 따로 더한다", () => {
    expect(baseTotal(celadon)).toBe(100);
    expect(additionTotal(celadon)).toBe(1.2);
  });

  it("소수 비율을 더해도 부동소수 오차가 남지 않는다", () => {
    const lines: RecipeLine[] = [0.1, 0.2, 99.7].map((pct, i) => ({
      materialId: `m${i}`,
      pct,
      isAddition: false,
    }));
    expect(baseTotal(lines)).toBe(100);
  });
});

describe("validateBase", () => {
  it("합이 100 ± 0.1 안이면 경고하지 않는다", () => {
    expect(validateBase(celadon)).toBeNull();
    expect(validateBase([{ materialId: "a", pct: 99.9, isAddition: false }])).toBeNull();
    expect(validateBase([{ materialId: "a", pct: 100.1, isAddition: false }])).toBeNull();
  });

  it("벗어나면 합계를 넣은 경고 문구를 돌려준다", () => {
    expect(validateBase([{ materialId: "a", pct: 99.8, isAddition: false }])).toBe(
      "기본 조성 합이 99.8입니다. 100이 되도록 맞춰 주세요."
    );
    expect(validateBase([])).toBe("기본 조성 합이 0입니다. 100이 되도록 맞춰 주세요.");
  });

  it("첨가물은 합계에 넣지 않는다", () => {
    expect(validateBase([...celadon, { materialId: "코발트", pct: 5, isAddition: true }])).toBeNull();
  });
});

describe("baseSignature", () => {
  it("원료 순서와 첨가물이 달라도 기본 조성이 같으면 같은 서명", () => {
    const reordered = [celadon[3], celadon[1], celadon[0], celadon[2]];
    const withCobalt = [...celadon.slice(0, 4), { materialId: "코발트", pct: 2, isAddition: true }];
    expect(baseSignature(reordered)).toBe(baseSignature(celadon));
    expect(baseSignature(withCobalt)).toBe(baseSignature(celadon));
  });

  it("비율이 하나라도 다르면 다른 서명", () => {
    const changed = celadon.map((l, i) => (i === 0 ? { ...l, pct: 41 } : l));
    expect(baseSignature(changed)).not.toBe(baseSignature(celadon));
  });
});
