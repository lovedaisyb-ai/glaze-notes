import { CONE_CELSIUS } from "./cones";
import type { TemperatureBand } from "./types";

/* 고화도로 보는 기준 온도 (옛 사이트의 rangeOf와 같음) */
export const HIGH_FIRE_MIN_C = 1150;

const CELSIUS_RE = /(\d{3,4})\s*(?:℃|°\s*C|도)/i;
const CONE_RE = /(?:콘|cone|△)\s*(0?\d{1,2})\s*(½|\.5)?/gi;
const BARE_NUMBER_RE = /\d{3,4}/;

/* "콘 6", "cone 06", "콘 5½", "콘 05.5" 같은 표기에서 콘 번호를 꺼냅니다.
   표의 키 모양("6", "06", "5½", "05½")으로 맞춰 돌려주고, 없으면 null */
export function parseCone(tempText: string): string | null {
  const m = new RegExp(CONE_RE.source, "i").exec(tempText);
  if (!m) return null;
  return m[1] + (m[2] ? "½" : "");
}

/* 콘 번호를 오튼 표의 온도(℃)로 바꿉니다. 표에 없으면 null */
export function coneToCelsius(cone: string): number | null {
  return CONE_CELSIUS[cone] ?? null;
}

/* 온도 문자열을 고화도(high)·저화도(low)·미분류(unclassified)로 나눕니다.
   1) "1222℃"처럼 ℃가 붙은 숫자가 있으면 그 온도로 판정
   2) 없으면 콘 번호로 판정: 06·04처럼 0이 붙은 콘은 저화도,
      6·10처럼 0이 없는 콘은 오튼 표의 온도로 판정, 표에 없는 콘은 미분류
   3) 둘 다 없으면 세·네 자리 숫자를 온도로 봄 (옛 사이트와 같은 방식)
   4) 그래도 없으면 미분류 */
export function temperatureBand(tempText: string): TemperatureBand {
  const text = String(tempText ?? "");

  const c = CELSIUS_RE.exec(text);
  if (c) return bandOf(parseInt(c[1], 10));

  const cone = parseCone(text);
  if (cone !== null) {
    const celsius = coneToCelsius(cone);
    if (celsius === null) return "unclassified";
    if (cone.startsWith("0")) return "low";
    return bandOf(celsius);
  }

  const bare = BARE_NUMBER_RE.exec(text.replace(CONE_RE, ""));
  if (bare) return bandOf(parseInt(bare[0], 10));

  return "unclassified";
}

const bandOf = (celsius: number): TemperatureBand =>
  celsius >= HIGH_FIRE_MIN_C ? "high" : "low";
