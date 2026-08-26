"use client";

import styles from "./StateCard.module.css";

interface StateCardProps {
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}

/**
 * 오늘의 상태 하나.
 * 한 번에 하나만 선택되므로 aria-pressed 로 토글 상태를 노출한다.
 * 선택 상태는 색 + 왼쪽 선 + 체크 아이콘, 세 가지로 함께 표시한다.
 */
export function StateCard({ label, hint, selected, onSelect }: StateCardProps) {
  return (
    <button
      type="button"
      className={selected ? `${styles.card} ${styles.selected}` : styles.card}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
      <span className={styles.check} aria-hidden="true">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      </span>
    </button>
  );
}
