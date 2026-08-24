# docs/SPRINTS.md — 04_쉼 Sprint Backlog v0.1 (동기화 사본)

> **원본**: Google Drive `04_쉼 Sprint Backlog v0.1`
> **동기화일**: 2026-08-24 (Sprint 0)
> **우선순위**: 저장소 문서 중 최하위. 제품 기준서 > iOS 명세서 > 운영규칙 > 이 문서.

---

## 운영 상태

각 Sprint는 `TODO` / `READY` / `IN PROGRESS` / `BLOCKED` / `DONE` 중 하나의 상태를 가진다.
**한 번에 하나의 Sprint만 `IN PROGRESS`가 될 수 있다.**

### 현재 상태 요약 (2026-08-24)

| Sprint | 이름 | 상태 |
|---|---|---|
| 0 | 개발 환경 및 저장소 기초 | **BLOCKED** — Mac에서 AC-1/AC-2/AC-6 검증 대기 + `shim-ios` 저장소 생성 대기 |
| 1 | Foundation & RestPlan | TODO |
| 2 | Timer Engine | TODO |
| 3 | Audio PoC | TODO |
| 4 | Brightness & Minimal Screen | TODO |
| 5 | Local Notification | TODO |
| 6 | RestPlanExecutor 통합 | TODO |
| 7 | Feedback & Local Personalization Base | TODO |
| 8 | Backend Skeleton | TODO |
| 9 | OpenAI Rest Director | TODO |
| 10 | Minimal AI UX | TODO |
| 11 | Apple Watch PoC | TODO |
| 12 | Context Awareness PoC | TODO |
| 13 | Screen Time Shield Feasibility | TODO |

> Sprint 0이 `DONE`이 되기 전에는 Sprint 1 코드를 구현하지 않는다. (Product Owner 결정, 2026-08-24)
> Sprint 0 BLOCKED 사유와 해제 조건은 `docs/DECISIONS.md` D-001 / D-002 / D-009 참고.

---

## Sprint 0 — 개발 환경 및 저장소 기초

**상태: BLOCKED (부분 완료)**

### 목표
Claude Code가 실제 iOS 개발을 수행할 수 있는 환경과 프로젝트 저장소 기준을 확정한다.

### 작업
- [x] macOS 여부 확인 → **Linux (Ubuntu 24.04). macOS 아님**
- [x] Xcode 설치 및 버전 확인 → **미설치, 설치 불가**
- [x] Swift 버전 확인 → **툴체인 미설치**
- [x] Apple Developer 설정 필요 여부 확인 → **필요. 실기기 배포 시 Team ID 필수 (D-004)**
- [x] Git repository 생성 또는 기존 repository 점검 → **기존 `musi0905-cloud/App` 점검 완료 (D-002)**
- [x] 기본 `.gitignore`
- [x] `README.md`
- [x] `CLAUDE.md`
- [x] `docs` 디렉터리 구성
- [x] 제품 기준 문서의 핵심을 repository용 문서로 옮김
- [x] 빈 SwiftUI 앱 생성 → **코드 및 Xcode 프로젝트 작성 완료 / 빌드 미검증**
- [ ] Simulator 빌드 확인 → **BLOCKED: macOS·Xcode 없음**

### Acceptance Criteria

Product Owner 결정으로 **AC-6(Unit Test 성공)이 추가**되어 총 6개다 (D-009).

| # | 기준 | 상태 |
|---|---|---|
| AC-1 | 프로젝트가 Xcode에서 열린다 | ⏳ **Mac 검증 대기** |
| AC-2 | iOS Simulator 대상 build 성공 | ⏳ **Mac 검증 대기** |
| AC-3 | repository에 비밀정보가 없다 | ✅ 충족 — `scripts/verify_repo.py` 시크릿 스캔 통과 |
| AC-4 | `CLAUDE.md`가 운영규칙을 포함한다 | ✅ 충족 |
| AC-5 | 현재 프로젝트 구조와 빌드 방법이 README에 기록된다 | ✅ 충족 |
| AC-6 | **Unit Test 성공** (D-009 추가) | ⏳ **Mac 검증 대기** |

### Sprint 0 DONE 조건

Mac에서 아래를 실행해 3개 항목이 모두 통과해야 한다.

```bash
./scripts/mac_verify.sh
```

절차와 수동 대안은 `README.md`의 「Mac 검증 절차」 참고.
XcodeGen이 있으면 `ios/project.yml` 기준으로 재생성한 프로젝트를 검증 대상으로 삼는다 (D-006).

### 추가 미완 항목

- **`musi0905-cloud/shim-ios` 저장소 생성 및 파일 이전** (D-002)
  세션의 GitHub App 통합에 저장소 생성 권한이 없어 (`403 Resource not accessible by integration`)
  Product Owner가 빈 저장소를 만들어야 진행된다. 절차는 `MIGRATION.md` 참고.

---

## Sprint 1 — Foundation & RestPlan

**상태: TODO**

### 목표
쉼 실행을 표현하는 Domain 모델과 최소 화면 뼈대를 만든다.

### 작업
- RestPlan 모델 / RestType / AudioMode / MovementType / ScreenMode / RestSessionState
- MockRestPlanFactory
- HomeView / RestSessionView / RestResultView
- 기본 Navigation 흐름
- RestPlan JSON decoding test

### Acceptance Criteria
- Mock RestPlan을 생성할 수 있다.
- JSON에서 RestPlan decoding이 가능하다.
- Home → RestSession → RestResult → Home 흐름이 동작한다.
- 아직 실제 오디오, 타이머, 밝기 기능은 붙이지 않는다.
- 빌드 및 관련 테스트가 성공한다.

---

## Sprint 2 — Timer Engine

**상태: TODO**

### 목표
백그라운드 전환에도 시간 오차가 누적되지 않는 쉼 타이머를 만든다.

### 작업
- TimerService protocol / DefaultTimerService
- startDate/endDate 기반 계산
- remaining time publish
- pause가 필요한지 제품 기준에 맞춰 검토
- 앱 foreground/background 재계산
- 짧은 duration 테스트 주입
- Timer unit tests
- RestSessionView 연동

### Acceptance Criteria
- 10분 계획을 시작할 수 있다.
- 앱을 백그라운드에 두었다 돌아와도 남은 시간이 실제 경과시간 기준으로 맞다.
- 중복 타이머가 생성되지 않는다.
- 테스트가 통과한다.

---

## Sprint 3 — Audio PoC

**상태: TODO**

### 목표
쉼 시작 시 로컬 오디오가 자동 재생되고 종료 시 확실히 정리되게 한다.

### 작업
- AudioService protocol / AVFoundation 구현
- 저작권 문제 없는 테스트 오디오 리소스
- play/pause/stop
- AVAudioSession 설정
- Background Audio capability 검토 및 적용
- 오디오 오류 처리
- RestPlan audioMode 연동

### Acceptance Criteria
- 실제 iPhone에서 쉼 시작 시 오디오가 재생된다.
- 앱이 백그라운드로 가도 의도된 정책대로 동작한다.
- 정상 종료/취소 시 오디오가 멈춘다.
- 다른 오디오와 충돌 시 동작이 보고된다.
- **실기기 미검증이면 DONE 처리하지 않는다.**

---

## Sprint 4 — Brightness & Minimal Screen

**상태: TODO**

### 목표
쉼 시작 시 시각적 자극을 줄이고 종료 시 시스템 상태를 안전하게 복원한다.

### 작업
- BrightnessService protocol
- 현재 밝기 저장 / targetBrightness 적용 / 범위 clamp
- 종료·취소 시 복원
- 앱 lifecycle에서 복원 전략
- Minimal RestSession UI / 중단 버튼 / 오류 시 fallback

### Acceptance Criteria
- 쉼 시작 시 목표 밝기가 적용된다.
- 정상 종료 시 원래 밝기가 복원된다.
- 중간 취소 시 원래 밝기가 복원된다.
- 지원하지 않는/잘못된 값이 들어와도 앱이 크래시하지 않는다.

---

## Sprint 5 — Local Notification

**상태: TODO**

### 목표
화면을 보지 않고 있어도 쉼 종료 시점을 알려준다.

### 작업
- NotificationService
- 권한 상태 확인 / 권한 요청 UX
- 종료 알림 예약 / 정상 종료 시 예약 정리
- 권한 거부 fallback
- 실기기 알림 테스트

### Acceptance Criteria
- 권한 허용 시 종료 알림을 받을 수 있다.
- 권한 거부 상태에서도 쉼은 정상 작동한다.
- 불필요한 중복 알림이 남지 않는다.

---

## Sprint 6 — RestPlanExecutor 통합

**상태: TODO**

### 목표
하나의 RestPlan이 여러 iOS 기능을 일관된 순서로 실행하고 정리하게 만든다.

### 작업
- RestPlanExecutor / RestPlanValidator
- start / finish / cancel / 오류 처리
- Service 의존성 주입
- 중복 실행 방지
- 통합 테스트

### Acceptance Criteria
- 하나의 Mock RestPlan으로 타이머, 오디오, 밝기, 알림이 함께 시작된다.
- 정상 종료 시 모든 리소스가 정리된다.
- 취소 시 모든 리소스가 정리된다.
- 부분 실패가 앱 크래시나 시스템 상태 방치로 이어지지 않는다.

---

## Sprint 7 — Feedback & Local Personalization Base

**상태: TODO**

### 목표
쉼 후 한 번의 피드백을 저장해 개인화 기반을 만든다.

### 작업
- RestFeedback 모델 (better / same / worse)
- RestHistory 모델 / 로컬 저장 / 최근 쉼 기록
- 피드백 저장 테스트
- 개인정보 최소 저장 검토

### Acceptance Criteria
- 쉼 종료 후 세 가지 중 하나를 선택할 수 있다.
- 선택 결과가 해당 RestPlan과 함께 로컬 저장된다.
- 앱 재실행 후에도 기록이 유지된다.
- 원본 자유입력 전체를 불필요하게 장기 저장하지 않는다.

---

## Sprint 8 — Backend Skeleton

**상태: TODO**

### 목표
OpenAI Key를 앱에 넣지 않는 서버 구조를 만든다.

### 작업
- Backend 프로젝트 결정
- REST API 기본 구조 / `POST /rest-plan`
- 환경변수·secret 관리
- request/response schema
- Mock AI Provider / 에러 응답 규격
- iOS API client / 네트워크 실패 fallback

### Acceptance Criteria
- iOS 앱이 Backend의 Mock RestPlan을 받을 수 있다.
- **API Key나 secret이 iOS 앱 또는 Git에 노출되지 않는다.**
- 네트워크 실패 시 로컬 기본 RestPlan으로 fallback 가능하다.

---

## Sprint 9 — OpenAI Rest Director

**상태: TODO**

### 목표
사용자의 짧은 상태 입력을 구조화된 RestPlan으로 변환한다.

### 작업
- AI Provider interface / OpenAI Provider
- 상태 입력 schema / Structured Output
- RestPlan schema validation
- Safety pre-check / Rest Engine rule validation
- 비정상 출력 fallback
- 요청·응답 로그 최소화

### Acceptance Criteria
- 짧은 입력으로 유효한 RestPlan을 생성할 수 있다.
- 자유 텍스트 대신 schema에 맞는 구조화 출력만 앱으로 전달된다.
- 허용되지 않은 값은 Validator에서 차단된다.
- OpenAI 장애 시 서비스가 완전히 멈추지 않는다.

---

## Sprint 10 — Minimal AI UX

**상태: TODO**

### 목표
사용자가 최소한의 입력으로 AI 기반 쉼을 시작하게 한다.

### 작업
- 현재 상태 Quick Select / 한 줄 입력
- 사용 가능 시간 선택 또는 자동값
- loading 최소화
- AI RestPlan 생성 / "쉼 시작" CTA
- 오류 시 즉시 기본 쉼 제공

### Acceptance Criteria
- 사용자가 앱 실행 후 최소 조작으로 쉼을 시작할 수 있다.
- AI 응답을 기다리며 긴 화면을 보게 하지 않는다.
- AI 실패 시에도 기본 쉼을 시작할 수 있다.
- 앱 체류시간을 늘리는 추가 콘텐츠가 없다.

---

## Sprint 11 — Apple Watch PoC

**상태: TODO**

### 목표
쉼 중 휴대폰을 보지 않아도 되는 경험을 강화한다.

### 작업
- watchOS target / WatchConnectivity
- 남은 시간 동기화 / 짧은 안내 / 햅틱 / 종료 신호
- 연결 실패 fallback

### Acceptance Criteria
- 지원되는 Watch에서 쉼 시작 상태를 확인할 수 있다.
- 핵심 안내를 Watch에서 받을 수 있다.
- Watch가 없어도 iPhone 기능은 동일하게 동작한다.

---

## Sprint 12 — Context Awareness PoC

**상태: TODO**

### 목표
위치, 시간, 날씨 등 환경 맥락을 추천에 제한적으로 활용한다.

### 작업
- Core Location 권한 전략 / 정밀 좌표 최소화
- 시간대 context / 날씨 provider 검토
- 실내·외 또는 이동 가능성 context 설계
- AI payload에 최소 정보 전달

### Acceptance Criteria
- 필요 이상의 위치를 저장하지 않는다.
- 권한 거부 시에도 서비스가 정상 작동한다.
- context가 RestPlan 품질 개선에 사용되지만 필수 의존성이 아니다.

---

## Sprint 13 — Screen Time Shield Feasibility

**상태: TODO**

### 목표
방해 앱 일시 제한 기능의 기술 및 App Store 정책 적합성을 검증한다.

### 작업
- FamilyControls / ManagedSettings / DeviceActivity
- entitlement 필요조건 조사
- 성인 자기관리 use case 적합성 검토
- 테스트 앱 PoC
- App Store 리스크 기록

### Acceptance Criteria
- 가능/불가를 문서로 명확히 결론낸다.
- 정책 리스크가 크면 제품 핵심에서 제외한다.
- 검증 전에는 제품에서 작동한다고 가정하지 않는다.

---

## Sprint 종료 게이트

다음 Sprint로 넘어가기 전 반드시 확인한다.

1. Acceptance Criteria 충족
2. 빌드 결과 기록
3. 테스트 결과 기록
4. 실기기 필요 항목 결과 기록
5. 기술 부채 기록
6. 문서 갱신
7. 사용자에게 Sprint 보고
8. **사용자 승인 또는 명시적 계속 지시**

---

## Backlog 후보 (Sprint 범위 밖에서 발견된 항목)

| ID | 내용 | 발견 Sprint | 상태 |
|---|---|---|---|
| B-001 | 저장소 분리 — 「쉼」 iOS를 `musi0905-cloud/shim-ios`로 분리 | Sprint 0 | ✅ **결정 완료** (D-002) — 저장소 생성 대기 중 |
| B-002 | GitHub Actions macOS CI 도입 (Simulator 빌드·테스트 자동 검증) | Sprint 0 | 📌 **Backlog 유지** — MVP 초기 기능 안정화 이후 도입 (D-008) |
| B-003 | App Icon 실제 에셋 제작 (현재 빈 AppIcon 슬롯) | Sprint 0 | 대기 — 디자인 필요 |
| B-004 | 저장소 라이선스 결정 | Sprint 0 | 대기 — Product Owner 결정 필요 |
