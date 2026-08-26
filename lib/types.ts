/**
 * 도메인 타입.
 * Sprint 0에서는 저장소가 없으므로 순수 타입만 둔다.
 * 이후 Sprint에서 Supabase row 타입을 이 shape에 맞춰 매핑한다.
 */

/** 홈에서 고르는 오늘의 상태. */
export interface MoodState {
  /** 저장 시 사용할 안정적인 key. UI 문구가 바뀌어도 이 값은 유지한다. */
  id: MoodStateId;
  label: string;
  /** 카드 아래 한 줄. 판단하지 않고, 설명하지 않는다. */
  hint: string;
}

export type MoodStateId =
  | "long_day"
  | "tired_of_people"
  | "too_many_thoughts"
  | "no_energy"
  | "want_quiet"
  | "okay_today";

/** Shell 네비게이션 항목. */
export interface NavItem {
  id: NavItemId;
  label: string;
  /** Sprint 1에서 실제 route로 연결된다. */
  href: string;
  /** 아이콘 전용 표현이 아닐 때도 스크린리더 문맥을 보강한다. */
  description: string;
}

export type NavItemId = "home" | "write" | "shared-day" | "my-rest" | "short-rest";
