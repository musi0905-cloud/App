import type { NavItemId } from "@/lib/types";

const PATHS: Record<NavItemId, string> = {
  home: "M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3v-4H7v4H4a1 1 0 0 1-1-1V9.5Z",
  write: "M4 16h12M5.5 12.5 13 5a1.8 1.8 0 0 1 2.5 2.5L8 15l-3 .5.5-3Z",
  "shared-day": "M4 15v-1a3 3 0 0 1 3-3h1a3 3 0 0 1 3 3v1M7.5 5a2.2 2.2 0 1 1 0 4.5 2.2 2.2 0 0 1 0-4.5ZM13 15v-1a3.4 3.4 0 0 0-1-2.4M13 5.3a2.2 2.2 0 0 1 0 4.2",
  "my-rest": "M10 16s-5.5-3.3-5.5-7A2.9 2.9 0 0 1 10 7a2.9 2.9 0 0 1 5.5 2c0 3.7-5.5 7-5.5 7Z",
  "short-rest": "M10 4.5a5.5 5.5 0 1 0 5.5 5.5M10 6.8V10l2.2 1.6",
};

/** 단순한 stroke 아이콘. 장식이므로 항상 aria-hidden. */
export function NavIcon({ id }: { id: NavItemId }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[id]} />
    </svg>
  );
}
