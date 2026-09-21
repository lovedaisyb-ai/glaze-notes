/* 개발용 Supabase 데이터베이스 접속 (SUPABASE_DB_URL, .env.local).
   터미널에서 돌리는 스크립트 전용입니다. 앱 코드에서 가져다 쓰지 않습니다. */
import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error: console.error });

export async function connect() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error(".env.local에 SUPABASE_DB_URL이 없습니다.");
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}
