/* 사이트 이름과 기본 정보는 여기 한 곳에서만 바꿉니다.
   페이지 제목(app/layout.tsx)과 PWA 이름(1-9에서 만들 manifest)이 모두 이 값을 씁니다. */
export const SITE = {
  name: "유약 노트",
  shortName: "유약 노트",
  description: "도자기 유약 레시피와 시편 기록을 모아 두는 노트",
  lang: "ko",
  themeColor: "#33564C",
} as const;
