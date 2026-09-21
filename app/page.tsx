import { SITE } from "@/lib/site";
import styles from "./page.module.css";

/* M1 자리표시 화면. 화면 이식(1-4)에서 목록 화면으로 바뀝니다. */
export default function Home() {
  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>{SITE.name}</h1>
      <p>새 앱을 만드는 중입니다. 지금은 옛 사이트를 그대로 볼 수 있습니다.</p>
      <p>
        <a href="/legacy">옛 사이트 열기 →</a>
      </p>
    </main>
  );
}
