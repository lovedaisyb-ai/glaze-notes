import type { RecipeLine, ScaledLine } from "./types";

/* 기본 조성 합이 100에서 이만큼까지 벗어나도 괜찮다고 봅니다 */
export const BASE_TOLERANCE = 0.1;

/* 소수 첫째 자리 반올림 (옛 사이트의 fmt와 같은 규칙) */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/* 비율(소수 둘째 자리까지)을 더할 때 생기는 부동소수 오차를 걷어 냅니다 */
const tidy = (n: number): number => Math.round(n * 1e6) / 1e6;

/* 만들 양(g)에 맞춰 원료별 계량 g을 계산합니다.
   첨가물도 같은 식(만들 양 × 비율 ÷ 100)으로, 기본 조성 위에 더해 씁니다. */
export function scaleRecipe(lines: RecipeLine[], batchGrams: number): ScaledLine[] {
  if (!Number.isFinite(batchGrams) || batchGrams <= 0) {
    throw new RangeError("만들 양은 0보다 큰 숫자여야 합니다.");
  }
  return lines.map((line) => ({ ...line, grams: round1((batchGrams * line.pct) / 100) }));
}

export function baseTotal(lines: RecipeLine[]): number {
  return tidy(lines.filter((l) => !l.isAddition).reduce((sum, l) => sum + l.pct, 0));
}

export function additionTotal(lines: RecipeLine[]): number {
  return tidy(lines.filter((l) => l.isAddition).reduce((sum, l) => sum + l.pct, 0));
}

/* 기본 조성 합이 100 ± 0.1을 벗어나면 경고 문구를, 괜찮으면 null을 돌려줍니다.
   경고일 뿐 저장을 막지는 않습니다. */
export function validateBase(lines: RecipeLine[]): string | null {
  const total = baseTotal(lines);
  if (Math.abs(total - 100) <= BASE_TOLERANCE + 1e-9) return null;
  return `기본 조성 합이 ${round1(total)}입니다. 100이 되도록 맞춰 주세요.`;
}

/* 같은 기본 조성끼리 묶기 위한 서명. 첨가물은 빼고, "원료:비율"을 정렬해 잇습니다 */
export function baseSignature(lines: RecipeLine[]): string {
  return lines
    .filter((l) => !l.isAddition)
    .map((l) => `${l.materialId}:${l.pct}`)
    .sort()
    .join("|");
}
