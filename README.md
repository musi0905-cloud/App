# 쉼 Community

힘든 순간, 잠시 현실에서 거리를 두고 자기 자신에게 돌아가도록 돕는
Responsive Web / PWA 서비스.

## 제품 원칙

이 서비스는 **사용자를 오래 붙잡지 않는다.** 아래는 의도적으로 만들지 않는다.

- 댓글 / DM / 팔로우
- 인기글 / 랭킹
- 무한 스크롤

AI는 상담 챗봇이 아니다. 사용자의 상태와 글을 읽고 다음 구조로만 응답한다.

1. 짧은 공감
2. 지금 할 수 있는 쉼 행동 1개
3. 휴대폰을 내려놓도록 유도

“사용자를 가능한 빨리 현실의 쉼으로 돌려보낸다”가 핵심 지표다.

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run start
npm run typecheck
```

Node 20 이상, Next.js App Router, TypeScript strict.

## 구조

```
app/          layout / page / globals.css (design token)
components/
  layout/     AppShell, DesktopSidebar, MobileBottomNav, RightContextPanel
  ui/         SurfaceCard, PrimaryButton, StateCard
  home/       MoodStateSelector
lib/          platform.ts, constants.ts, types.ts
public/       manifest.webmanifest, icons/
docs/         ARCHITECTURE.md, SPRINTS.md
prototype.html  UX / Flow reference (구현 기준)
```

## 디자인 방향

Soft Green / Warm Beige / Off White. 넓은 여백, 낮은 정보 밀도, 최소한의 shadow.
명상 앱이나 심리상담 앱처럼 보이지 않는, 현대적이고 중립적인 웹 서비스.

색·간격·타이포는 전부 `app/globals.css`의 CSS 변수로만 정의한다.
컴포넌트에서 raw 색상값이나 magic number를 쓰지 않는다.

## 반응형 기준

375 / 390 / 768 / 1024 / 1440px

- Mobile(<1024px): Bottom Navigation, 1 column, touch target 44px 이상
- Desktop(≥1024px): 얇은 Left Sidebar + Main(최대 720px)
- ≥1280px: 선택적 Right Context Panel

## 현재 상태

Sprint 0 (Foundation) 완료. 상세는 `docs/SPRINTS.md` 참고.
