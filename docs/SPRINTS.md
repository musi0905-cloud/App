# Sprints

각 Sprint는 앞 Sprint의 승인 후에만 시작한다.

## Sprint 0 — Foundation ✅

프로젝트 기반 + 디자인 시스템 + 반응형 Shell + PWA 기본 구조.

- [x] Next.js App Router + TypeScript strict 정상화 (`install` / `build` / `dev`)
- [x] Design Token (color / radius / spacing / typography)
- [x] Responsive App Shell (Mobile Bottom Nav, Desktop Sidebar, optional Context Panel)
- [x] Home 화면 (닉네임 placeholder, 상태 카드 6종, 단일 선택, [다음] 활성/비활성)
- [x] `lib/platform.ts` capability detection
- [x] PWA manifest 연결 (placeholder icon)
- [x] 접근성 기본 (semantic button, focus visible, 색 외 단서, AA 대비)

범위 밖(의도적으로 미구현): Supabase, Auth, DB, AI API, Web Push 발송,
Service Worker, Geolocation 권한 요청, 지도/장소 API, Premium/결제, 관리자 페이지,
실제 Post 저장.

## Sprint 0.1 — Repository & Source-of-Truth Correction ✅

- [x] 쉼 Community를 `musi0905-cloud/App`(Apps Script)과 분리된 독립 project root로 이전
- [x] 기존 Apps Script 5개 파일 무변경 확인 (blob hash 동일)
- [x] `prototype.html` → `prototype.sprint0-reference.html` 로 이름 변경 + 비공식 표기
- [x] `docs/SOURCE-OF-TRUTH.md` 신설, `docs/PRODUCT.md` 동기화
- [x] Bottom Navigation label 11px → 12px (padding/gap 조정으로 375px 수용)
- [x] `env(safe-area-inset-bottom)` 실제 반영 검증

미해결 (Product Owner 결정 필요) — `docs/SOURCE-OF-TRUTH.md` 참고:
웹 Community와 iOS 앱의 관계, `docs/PRODUCT.md` §15와 Community 범위의 충돌,
AI Rest 응답 형식(자연어 3단 구조 vs Rest Plan JSON)의 정합성.

## Sprint 1 — Routing & 쉼 Flow

- 5개 라우트 실제 연결 (`/`, `/write`, `/shared-day`, `/my-rest`, `/short-rest`)
- Bottom Nav / Sidebar를 `<Link>` + `usePathname()`으로 교체
- 상태 선택 → 다음 화면으로 이어지는 흐름 (mock 데이터)
- 글쓰기 화면 기본 UI

> ⚠️ Sprint 1 착수 전에 `docs/SOURCE-OF-TRUTH.md`의 미해결 항목을 먼저 확정해야 한다.
> 공식 UX 정의 없이 Home/Write/AI Rest/Feed/My Rest를 재설계하지 않는다.

## Sprint 2 — Auth & 익명성

- Supabase Auth 연결, 닉네임 placeholder 교체
- 익명성 경계 정의

## Sprint 3 — Post 저장

- 스키마 정의, 글 저장/조회, `MoodStateId` 영속화

## Sprint 4 — 함께한 하루

- 같은 상태를 고른 사람들의 기록 (랭킹·인기순 없음)

## Sprint 5 — AI 쉼 응답

- 짧은 공감 → 쉼 행동 1개 → 화면 내려놓기 유도. 대화형 아님.

## Sprint 6 — 짧은 쉼 / 내 쉼

- 짧은 쉼 콘텐츠, 지나온 기록

## Sprint 7 — PWA 완성

- Service Worker, Web Push subscription/발송, 설치 유도, 아이콘 확정
