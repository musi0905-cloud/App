import { SurfaceCard } from "@/components/ui/SurfaceCard";
import styles from "./RightContextPanel.module.css";

/**
 * 데스크톱 넓은 화면에서만 보이는 선택적 패널.
 * 대시보드가 되지 않도록 정보는 한 덩어리만 둔다.
 */
export function RightContextPanel() {
  return (
    <aside className={styles.panel} aria-label="쉼 안내">
      <SurfaceCard tone="soft" padding="comfortable">
        <p className={styles.title}>오늘의 안내</p>
        <p className={styles.body}>
          여기서 오래 머물 필요는 없어요. 상태를 고르고, 짧게 적고, 화면을 덮어두면
          충분합니다.
        </p>
        <p className={styles.note}>
          쉼은 화면 안이 아니라 화면 밖에서 이어집니다.
        </p>
      </SurfaceCard>
    </aside>
  );
}
