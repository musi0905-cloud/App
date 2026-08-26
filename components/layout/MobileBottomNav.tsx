"use client";

import { NAV_ITEMS } from "@/lib/constants";
import type { NavItemId } from "@/lib/types";
import { NavIcon } from "./NavIcon";
import styles from "./MobileBottomNav.module.css";

interface MobileBottomNavProps {
  activeId: NavItemId;
  onNavigate: (id: NavItemId) => void;
}

export function MobileBottomNav({ activeId, onNavigate }: MobileBottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="주요 메뉴">
      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === activeId;
          return (
            <li key={item.id} className={styles.item}>
              <button
                type="button"
                className={isActive ? `${styles.link} ${styles.active}` : styles.link}
                aria-current={isActive ? "page" : undefined}
                aria-label={`${item.label} — ${item.description}`}
                onClick={() => onNavigate(item.id)}
              >
                <NavIcon id={item.id} />
                <span className={styles.label}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
