import { MoodStateSelector } from "@/components/home/MoodStateSelector";
import { AppShell } from "@/components/layout/AppShell";
import { PLACEHOLDER_NICKNAME } from "@/lib/constants";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <AppShell initialActiveId="home" showContextPanel>
      <div className={styles.page}>
        {/* 로그인 전 placeholder. Sprint 2에서 실제 닉네임으로 교체된다. */}
        <div className={styles.greeting}>
          <span className={styles.avatar} aria-hidden="true">
            쉼
          </span>
          <span>
            <span className={styles.nickname}>{PLACEHOLDER_NICKNAME}</span>
            <span className={styles.nicknameNote}> 님, 안녕하세요</span>
          </span>
        </div>

        <header className={styles.intro}>
          <h1 className={styles.title}>오늘은 어떤 하루였나요?</h1>
          <p className={styles.description}>
            지금 마음에 가장 가까운 하나를 골라주세요. 고르고 나면, 지금 할 수 있는
            짧은 쉼 하나를 안내해드릴게요.
          </p>
        </header>

        <MoodStateSelector />
      </div>
    </AppShell>
  );
}
