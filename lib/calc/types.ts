/* 레시피 한 줄. pct는 기본 조성 100에 대한 비율(%)이고,
   isAddition이 true면 기본 조성 위에 더하는 첨가물(착색제·유탁제 등)입니다. */
export type RecipeLine = {
  materialId: string;
  pct: number;
  isAddition: boolean;
};

export type ScaledLine = RecipeLine & { grams: number };

export type TemperatureBand = "high" | "low" | "unclassified";
