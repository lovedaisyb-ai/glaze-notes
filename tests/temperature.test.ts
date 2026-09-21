import { describe, expect, it } from "vitest";
import { CONE_CHART, coneToCelsius, parseCone, temperatureBand } from "@/lib/calc";
import { readLegacy } from "../scripts/legacy.mjs";

describe("temperatureBand — 콘 번호만 적힌 경우", () => {
  it("콘 6은 오튼 표 1222℃ → 고화도", () => {
    expect(coneToCelsius("6")).toBe(1222);
    expect(temperatureBand("콘 6")).toBe("high");
    expect(temperatureBand("콘6 산화")).toBe("high");
    expect(temperatureBand("cone 6")).toBe("high");
  });

  it("콘 06은 0이 붙은 콘 → 저화도", () => {
    expect(parseCone("콘 06")).toBe("06");
    expect(temperatureBand("콘 06")).toBe("low");
    expect(temperatureBand("Cone 06")).toBe("low");
  });

  it("콘 10은 오튼 표 1285℃ → 고화도", () => {
    expect(coneToCelsius("10")).toBe(1285);
    expect(temperatureBand("콘 10 환원")).toBe("high");
  });

  it("0이 없는 콘은 표의 온도로 판정: 콘 1·2는 저화도, 콘 3부터 고화도", () => {
    expect(temperatureBand("콘 1")).toBe("low"); // 1137℃
    expect(temperatureBand("콘 2")).toBe("low"); // 1142℃
    expect(temperatureBand("콘 3")).toBe("high"); // 1152℃
  });

  it("반 콘(5½, 05½)도 표에서 찾는다", () => {
    expect(parseCone("콘 5½")).toBe("5½");
    expect(parseCone("콘 5.5")).toBe("5½");
    expect(temperatureBand("콘 5½")).toBe("high"); // 1203℃
    expect(temperatureBand("콘 05½")).toBe("low");
  });

  it("표에 없는 콘은 미분류", () => {
    expect(temperatureBand("콘 13")).toBe("unclassified");
    expect(temperatureBand("콘 023")).toBe("unclassified");
    expect(temperatureBand("콘 0")).toBe("unclassified");
  });
});

describe("temperatureBand — ℃·숫자·빈 값", () => {
  it("℃가 적혀 있으면 콘보다 ℃를 먼저 본다", () => {
    expect(temperatureBand("1222℃ · 콘 6")).toBe("high");
    expect(temperatureBand("1063℃ · 콘 04")).toBe("low");
    expect(temperatureBand("1150℃")).toBe("high");
    expect(temperatureBand("1149℃")).toBe("low");
    expect(temperatureBand("1230도 산화")).toBe("high");
  });

  it("℃ 없이 세·네 자리 숫자만 있으면 그 숫자로 판정 (옛 사이트와 같음)", () => {
    expect(temperatureBand("1250 환원")).toBe("high");
    expect(temperatureBand("980 저화도")).toBe("low");
  });

  it("온도도 콘도 없으면 미분류", () => {
    expect(temperatureBand("")).toBe("unclassified");
    expect(temperatureBand("산화 소성")).toBe("unclassified");
  });
});

describe("오튼 콘 표", () => {
  it("022부터 12까지 36칸, 콘 번호가 올라갈수록 온도도 오른다", () => {
    expect(CONE_CHART[0]).toEqual(["022", 586]);
    expect(CONE_CHART.at(-1)).toEqual(["12", 1306]);
    const temps = CONE_CHART.map(([, c]) => c);
    expect(temps).toHaveLength(36);
    temps.slice(1).forEach((t, i) => expect(t).toBeGreaterThan(temps[i]));
  });
});

describe("옛 사이트 35종과 같은 결과", () => {
  /* 옛 사이트의 rangeOf: 처음 나오는 세·네 자리 숫자가 1150 이상이면 고화도 */
  const legacyRange = (temp: string) => {
    const m = temp.match(/\d{3,4}/);
    return m && parseInt(m[0], 10) >= 1150 ? "high" : "low";
  };

  it("℃와 콘을 함께 적은 레시피는 오튼 표와 맞는다 (\"부근\"이면 가장 가까운 콘)", () => {
    const nearestCone = (celsius: number) =>
      CONE_CHART.reduce((best, cur) => (Math.abs(cur[1] - celsius) < Math.abs(best[1] - celsius) ? cur : best))[0];
    for (const r of readLegacy().recipes) {
      const m = /(\d{3,4})℃ · 콘 (\S+)( 부근)?$/.exec(r.temp);
      if (!m) continue;
      const celsius = parseInt(m[1], 10);
      const expected = m[3] ? nearestCone(celsius) : m[2];
      expect([r.id, m[2]]).toEqual([r.id, expected]);
      if (!m[3]) expect([r.id, coneToCelsius(m[2])]).toEqual([r.id, celsius]);
    }
  });

  it("35종 모두 고화도·저화도 판정이 옛 사이트와 같다", () => {
    const { recipes } = readLegacy();
    expect(recipes).toHaveLength(35);
    for (const r of recipes) {
      expect([r.id, temperatureBand(r.temp)]).toEqual([r.id, legacyRange(r.temp)]);
    }
  });
});
