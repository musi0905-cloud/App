"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./PrimaryButton.module.css";

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** quiet: 같은 화면에서 두 번째 선택지일 때. */
  variant?: "solid" | "quiet";
  fullWidth?: boolean;
}

/**
 * 화면당 하나의 주요 행동.
 * disabled 는 색뿐 아니라 실제 button[disabled] 로 표현해 키보드에서도 막힌다.
 */
export function PrimaryButton({
  children,
  variant = "solid",
  fullWidth = false,
  type = "button",
  className,
  ...rest
}: PrimaryButtonProps) {
  const classes = [
    styles.button,
    variant === "quiet" ? styles.quiet : null,
    fullWidth ? styles.fullWidth : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
