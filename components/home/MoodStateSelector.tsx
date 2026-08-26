"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StateCard } from "@/components/ui/StateCard";
import { MOOD_STATES } from "@/lib/constants";
import type { MoodStateId } from "@/lib/types";
import styles from "./MoodStateSelector.module.css";

/**
 * 오늘의 상태를 하나 고른다.
 * Sprint 0에서는 저장/이동이 없다 — 선택 상태와 버튼 활성화까지만 담당한다.
 * 선택 결과는 onNext 로 넘겨, Sprint 1에서 라우팅/저장을 붙이기만 하면 되게 둔다.
 */
export function MoodStateSelector({
  onNext,
}: {
  onNext?: (id: MoodStateId) => void;
}) {
  const [selectedId, setSelectedId] = useState<MoodStateId | null>(null);

  return (
    <section className={styles.section} aria-labelledby="mood-legend">
      <p id="mood-legend" className={styles.legend}>
        하나만 골라주세요. 정확하지 않아도 괜찮아요.
      </p>

      <div className={styles.list}>
        {MOOD_STATES.map((state) => (
          <StateCard
            key={state.id}
            label={state.label}
            hint={state.hint}
            selected={state.id === selectedId}
            onSelect={() => setSelectedId(state.id)}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <PrimaryButton
          disabled={selectedId === null}
          onClick={() => {
            if (selectedId !== null) onNext?.(selectedId);
          }}
        >
          다음
        </PrimaryButton>
        <p className={styles.status} role="status">
          {selectedId === null
            ? "상태를 고르면 다음으로 넘어갈 수 있어요."
            : "천천히 눌러도 괜찮아요."}
        </p>
      </div>
    </section>
  );
}
