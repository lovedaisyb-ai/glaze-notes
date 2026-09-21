/* supabase/migrations/*.sql 중 아직 적용하지 않은 것을 순서대로 적용합니다.
   적용 기록은 Supabase CLI와 같은 표(supabase_migrations.schema_migrations)에 남깁니다.
   실행: npm run db:migrate            — 적용
         npm run db:migrate -- --dry-run — 한 트랜잭션에서 실행해 보고 되돌림 (아무것도 바뀌지 않음) */
import { readdirSync, readFileSync } from "node:fs";
import { connect } from "./db.mjs";

const dryRun = process.argv.includes("--dry-run");
const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

const db = await connect();
try {
  await db.query(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations
      (version text primary key, statements text[], name text)`);
  const done = new Set((await db.query("select version from supabase_migrations.schema_migrations")).rows.map((r) => r.version));
  const pending = files.filter((f) => !done.has(f.slice(0, 14)));
  if (!pending.length) {
    console.log("적용할 마이그레이션이 없습니다.");
  } else {
    await db.query("begin");
    for (const f of pending) {
      const sql = readFileSync(new URL(f, dir), "utf8");
      await db.query(sql);
      await db.query("insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)",
        [f.slice(0, 14), [sql], f.slice(15, -4)]);
      console.log(`${dryRun ? "실행해 봄" : "적용"}: ${f}`);
    }
    await db.query(dryRun ? "rollback" : "commit");
    console.log(dryRun ? "dry run 끝 — 모두 되돌렸습니다." : `${pending.length}개를 적용했습니다.`);
  }
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error("실패, 모두 되돌렸습니다:", e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
