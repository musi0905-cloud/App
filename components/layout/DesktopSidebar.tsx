"use client";

import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import type { NavItemId } from "@/lib/types";
import { NavIcon } from "./NavIcon";
import styles from "./DesktopSidebar.module.css";

interface DesktopSidebarProps {
  activeId: NavItemId;
  onNavigate: (id: NavItemId) => void;
}

export function DesktopSidebar({ activeId, onNavigate }: DesktopSidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="주요 메뉴">
      <div className={styles.brand}>
        <span className={styles.brandName}>{APP_NAME}</span>
        <span className={styles.brandNote}>잠시 멈추는 곳</span>
      </div>

      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                className={isActive ? `${styles.link} ${styles.active}` : styles.link}
                aria-current={isActive ? "page" : undefined}
                aria-label={`${item.label} — ${item.description}`}
                onClick={() => onNavigate(item.id)}
              >
                <NavIcon id={item.id} />
                <span>{item.label}</span>
                <span className={styles.marker} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      <p className={styles.footer}>오래 머물지 않아도 괜찮아요.</p>
    </nav>
  );
}
