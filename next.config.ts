import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 옛 사이트(public/legacy/index.html)를 /legacy 주소로 엽니다 */
  rewrites() {
    return [{ source: "/legacy", destination: "/legacy/index.html" }];
  },
};

export default nextConfig;
