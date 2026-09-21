/* 오튼 콘 온도표 (℃)
   출처: Orton Ceramic Foundation, "Pyrometric Cones, Cone Numbers 022-12",
         Temperature Equivalents (°C) — Self Supporting Cones, Regular (SSB),
         60°C/hr (Medium). ortonceramic.com/pyrometric-cones 의 "New Cone Chart" PDF.
   옛 사이트의 레시피 온도(콘 04 1063, 콘 6 1222, 콘 10 1285 등)도 같은 열을 따릅니다.
   값을 고칠 때는 원문 표와 대조하고, 손으로 추정한 값을 넣지 않습니다. */
export const CONE_TABLE_SOURCE =
  "Orton Pyrometric Cones 022-12, Self Supporting (SSB) 60°C/hr";

/* 표 순서 그대로 (낮은 콘 → 높은 콘) */
export const CONE_CHART: ReadonlyArray<readonly [cone: string, celsius: number]> = [
  ["022", 586],
  ["021", 600],
  ["020", 626],
  ["019", 678],
  ["018", 715],
  ["017", 738],
  ["016", 772],
  ["015", 791],
  ["014", 807],
  ["013", 837],
  ["012", 861],
  ["011", 875],
  ["010", 903],
  ["09", 920],
  ["08", 942],
  ["07", 976],
  ["06", 998],
  ["05½", 1015],
  ["05", 1031],
  ["04", 1063],
  ["03", 1086],
  ["02", 1102],
  ["01", 1119],
  ["1", 1137],
  ["2", 1142],
  ["3", 1152],
  ["4", 1162],
  ["5", 1186],
  ["5½", 1203],
  ["6", 1222],
  ["7", 1239],
  ["8", 1249],
  ["9", 1260],
  ["10", 1285],
  ["11", 1294],
  ["12", 1306],
];

/* 콘 번호로 찾아보기용 */
export const CONE_CELSIUS: Readonly<Record<string, number>> = Object.fromEntries(CONE_CHART);
