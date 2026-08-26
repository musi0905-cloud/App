import type { MoodState, NavItem } from "@/lib/types";

export const APP_NAME = "쉼 Community";
export const APP_SHORT_NAME = "쉼";
export const APP_DESCRIPTION =
  "힘든 순간, 잠시 현실에서 거리를 두고 자기 자신에게 돌아가도록 돕는 공간";

/** manifest / theme-color / 브라우저 UI와 globals.css 토큰을 한 곳에서 맞춘다. */
export const BRAND_COLORS = {
  background: "#f7f5f1",
  theme: "#3f6e57",
} as const;

/**
 * Shell 네비게이션.
 * Sprint 0에서는 href를 라우팅에 쓰지 않고 (아직 해당 페이지가 없다)
 * 구조와 active state만 잡는다. Sprint 1에서 Link로 교체한다.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "home",
    label: "홈",
    href: "/",
    description: "오늘의 상태를 고르는 곳",
  },
  {
    id: "write",
    label: "글쓰기",
    href: "/write",
    description: "마음에 남은 말을 적는 곳",
  },
  {
    id: "shared-day",
    label: "함께한 하루",
    href: "/shared-day",
    description: "같은 하루를 보낸 사람들의 기록",
  },
  {
    id: "my-rest",
    label: "내 쉼",
    href: "/my-rest",
    description: "내가 지나온 쉼의 기록",
  },
  {
    id: "short-rest",
    label: "짧은 쉼",
    href: "/short-rest",
    description: "지금 바로 할 수 있는 짧은 쉼",
  },
] as const;

/** 홈의 상태 카드. 순서는 프로토타입 기준을 그대로 따른다. */
export const MOOD_STATES: readonly MoodState[] = [
  {
    id: "long_day",
    label: "오늘 너무 길었어요",
    hint: "하루가 끝났는데도 아직 안 끝난 것 같을 때",
  },
  {
    id: "tired_of_people",
    label: "사람에게 지쳤어요",
    hint: "말을 많이 한 날, 마음이 더 조용해질 때",
  },
  {
    id: "too_many_thoughts",
    label: "생각이 많아요",
    hint: "머릿속이 좀처럼 정리되지 않을 때",
  },
  {
    id: "no_energy",
    label: "아무것도 하기 싫어요",
    hint: "해야 할 일이 멀게 느껴질 때",
  },
  {
    id: "want_quiet",
    label: "그냥 조용히 있고 싶어요",
    hint: "아무 설명도 하고 싶지 않을 때",
  },
  {
    id: "okay_today",
    label: "오늘은 괜찮아요",
    hint: "괜찮은 날에도 쉼은 필요하니까",
  },
] as const;

/** 로그인이 붙기 전까지 홈 상단에 보여줄 임시 이름. */
export const PLACEHOLDER_NICKNAME = "이름 없는 사람";
