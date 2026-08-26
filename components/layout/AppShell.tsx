"use client";

import { useState, type ReactNode } from "react";
import { usePlatformCapabilities } from "@/lib/usePlatformCapabilities";
import type { NavItemId } from "@/lib/types";
import { DesktopSidebar } from "./DesktopSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { RightContextPanel } from "./RightContextPanel";
import styles from "./AppShell.module.css";

interface AppShellProps {
  children: ReactNode;
  /** 현재 화면. Sprint 1에서 실제 route 와 연결한다. */
  initialActiveId?: NavItemId;
  /** 넓은 화면의 선택적 우측 패널. */
  showContextPanel?: boolean;
}

/**
 * 반응형 Shell.
 * - Mobile(<1024px): 하단 Bottom Navigation
 * - Desktop(>=1024px): 얇은 좌측 Sidebar
 * - >=1280px: 선택적 우측 Context Panel
 *
 * Sprint 0에서는 실제 페이지 전환이 없으므로 active state 만 로컬에서 관리한다.
 */
export function AppShell({
  children,
  initialActiveId = "home",
  showContextPanel = false,
}: AppShellProps) {
  const [activeId, setActiveId] = useState<NavItemId>(initialActiveId);
  const { isStandalonePWA } = usePlatformCapabilities();

  return (
    // 설치형(standalone)에서는 브라우저 주소창이 없어 위 여백을 조금 더 준다.
    <div className={styles.shell} data-standalone={isStandalonePWA || undefined}>
      <DesktopSidebar activeId={activeId} onNavigate={setActiveId} />

      <div className={styles.contentArea}>
        <main className={styles.main} id="main-content">
          {children}
        </main>
        {showContextPanel ? <RightContextPanel /> : null}
      </div>

      <MobileBottomNav activeId={activeId} onNavigate={setActiveId} />
    </div>
  );
}
