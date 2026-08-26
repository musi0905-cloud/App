# Architecture

> 제품 기준은 `docs/SOURCE-OF-TRUTH.md`를 따른다. 이 문서는 기술 구조만 다룬다.

## 스택

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | RSC 기본, PWA/metadata 지원, 이후 서버 액션으로 Supabase 연결 용이 |
| Language | TypeScript (strict) | `noUncheckedIndexedAccess` 포함 |
| Styling | CSS Modules + CSS 변수 | 추가 의존성 0. 토큰을 한 곳에서 통제 |
| State | React local state | Sprint 0 범위에서 전역 상태가 필요 없다 |

의존성은 `next`, `react`, `react-dom` 셋뿐이다. UI 라이브러리를 넣지 않은 이유는
generic한 대시보드 느낌을 피하고 여백·밀도를 직접 통제하기 위해서다.

## 레이어

```
app/            라우팅 + 페이지 조립 (서버 컴포넌트 기본)
components/ui/      상태 없는 표현 단위
components/layout/  화면 골격
components/home/    화면별 조합
lib/            도메인 타입 / 상수 / 플랫폼 감지 (React 비의존)
```

규칙:

- `lib/`는 React를 import하지 않는다. (`usePlatformCapabilities`만 예외적으로
  `lib/usePlatformCapabilities.ts`에 분리)
- `components/ui/`는 도메인을 모른다. label과 상태를 props로만 받는다.
- 문구·목록 등 데이터는 `lib/constants.ts`에 모은다. 이후 DB로 옮길 때
  이 파일만 교체하면 된다.
- 서버 컴포넌트를 기본으로 두고, 상호작용이 필요한 곳만 `"use client"`를 붙인다.
  (`app/page.tsx`는 서버 컴포넌트, `AppShell`/`MoodStateSelector`는 클라이언트)

## Design Token

`app/globals.css`의 `:root`가 단일 출처다.

- Color: `--background`, `--surface`, `--surface-soft`, `--text-primary`,
  `--text-secondary`, `--primary`, `--primary-hover`, `--primary-soft`,
  `--border`, `--danger`
- Radius: `--radius-sm|md|lg|xl`
- Spacing: `--space-1`~`--space-9` (4/8/12/16/20/24/32/40/48)
- Typography: page title / section title / body / caption / button label
- Layout: `--layout-main-max`, `--layout-sidebar-width`,
  `--layout-context-width`, `--bottom-nav-height`, `--touch-target-min`
- Nav: `--font-size-nav-label` (12px 하한), `--safe-bottom`

색 조합은 모두 WCAG AA(4.5:1) 이상을 만족하도록 골랐다.

## Shell

```
<AppShell>
  DesktopSidebar     (>=1024px)
  contentArea
    main             (max 720px)
    RightContextPanel(>=1280px, optional)
  MobileBottomNav    (<1024px)
```

Sprint 0에는 실제 라우트가 하나(`/`)뿐이므로, 네비게이션은 `<button>`으로 두고
active state만 로컬에서 관리한다. Sprint 1에서 `next/link`의 `<Link>`와
`usePathname()`으로 교체한다 — `NAV_ITEMS`에 `href`는 이미 들어 있다.

## Platform Capability

`lib/platform.ts`는 feature detection을 우선한다.

- `supportsPush`는 `PushManager` **와** `serviceWorker`가 모두 있을 때만 true
- iPadOS는 `MacIntel` + `maxTouchPoints > 1`로 함께 판별
- OS 플래그(`isIOS`/`isAndroid`/`isDesktop`)는 기능 판단이 아니라
  **안내 문구 분기**에만 쓴다
- 권한 요청은 하지 않는다. 순수 조회 함수다.
- SSR에서는 `DEFAULT_CAPABILITIES`(전부 false)를 반환하고,
  `usePlatformCapabilities`가 hydration 이후 실제 값으로 교체한다.

## PWA

`public/manifest.webmanifest`를 `app/layout.tsx`의 `metadata.manifest`로 연결한다.
`viewport.themeColor`와 manifest의 `theme_color`는 `lib/constants.ts`의
`BRAND_COLORS`와 같은 값을 쓴다.

Service Worker와 실제 Push 발송은 Sprint 7 범위다. 현재는 PWA-ready 구조만 있다.
아이콘은 placeholder(단색 원)이며 디자인 확정 후 교체한다.

## 이후 Supabase 연결 지점

- `lib/types.ts`의 `MoodStateId`가 저장 key가 된다. UI 문구가 바뀌어도 유지한다.
- `MoodStateSelector`는 선택 결과를 `onNext(id)`로 위로 넘긴다.
  저장/라우팅은 상위(페이지 또는 서버 액션)에서 붙인다.
- 데이터 접근은 `lib/` 아래 별도 모듈로 추가하고, 컴포넌트가 직접 client를
  만들지 않게 한다.
