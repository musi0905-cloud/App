import type { ElementType, ReactNode } from "react";
import styles from "./SurfaceCard.module.css";

type Padding = "none" | "snug" | "comfortable" | "roomy";

const PADDING_CLASS: Record<Padding, string | undefined> = {
  none: styles.paddingNone,
  snug: styles.paddingSnug,
  comfortable: styles.paddingComfortable,
  roomy: styles.paddingRoomy,
};

interface SurfaceCardProps {
  children: ReactNode;
  /** section, li, article 등 문맥에 맞는 태그로 바꿔 쓴다. */
  as?: ElementType;
  /** soft: 배경만 살짝 다른, 테두리 없는 면. */
  tone?: "surface" | "soft";
  padding?: Padding;
  className?: string;
}

/** 모든 면(面)의 기본 단위. shadow 는 최소로 유지한다. */
export function SurfaceCard({
  children,
  as: Tag = "div",
  tone = "surface",
  padding = "comfortable",
  className,
}: SurfaceCardProps) {
  const classes = [
    styles.card,
    tone === "soft" ? styles.soft : null,
    PADDING_CLASS[padding],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <Tag className={classes}>{children}</Tag>;
}
