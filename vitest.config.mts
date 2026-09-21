import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // .env.local의 Supabase 값을 테스트에 넘깁니다 (Next.js는 테스트 모드에서 .env.local을 읽지 않음)
    env: loadEnv(mode, process.cwd(), ["NEXT_PUBLIC_SUPABASE_", "SUPABASE_"]),
  },
}));
