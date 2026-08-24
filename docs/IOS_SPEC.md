# docs/IOS_SPEC.md — 02_쉼 iOS 개발 명세서 v0.1 (동기화 사본)

> **원본**: Google Drive `02_쉼 iOS 개발 명세서 v0.1`
> **동기화일**: 2026-08-24 (Sprint 0)
> **우선순위**: `docs/PRODUCT.md` 다음. **제품 기준서와 충돌하면 제품 기준서를 따른다.**

---

## 1. 문서의 목적

이 문서는 「쉼 제품 기획 기준서 v0.1」을 실제 iOS 코드로 구현하기 위한 기술 명세다.

제품 기준서가 *무엇을 왜* 만드는지를 정의한다면, 이 문서는 *어떤 구조와 순서로* 구현할지를 정의한다.

**Claude Code는 이 문서를 제품 기준서보다 우선해서 해석해서는 안 된다. 충돌이 있으면 제품 기준서를 따른다.**

---

## 2. 첫 개발 목표

첫 목표는 완성형 앱 출시가 아니라, **실제 iPhone에서 핵심 쉼 실행 흐름이 동작하는 기술 PoC**를 만드는 것이다.

검증할 핵심 가설:
- 사용자는 최소 입력만으로 쉼을 시작할 수 있어야 한다.
- RestPlan 하나로 오디오, 타이머, 화면, 밝기, 알림을 일관되게 실행할 수 있어야 한다.
- 쉼 실행 중에는 사용자가 화면을 거의 보지 않아도 되어야 한다.
- 종료 후 한 번의 피드백만으로 다음 개인화의 기반 데이터를 남길 수 있어야 한다.

---

## 3. 기술 스택

| 항목 | 선택 |
|---|---|
| iOS | Swift, SwiftUI |
| 최소 지원 버전 | 프로젝트 생성 시 최신 안정 Xcode가 권장하는 현실적인 배포 타깃 사용, **실제 장비 테스트 가능성 우선** |
| 아키텍처 | 단순한 MVVM + Service Layer |
| 비동기 처리 | Swift Concurrency 우선 |
| 로컬 저장 | 초기 PoC는 UserDefaults 또는 경량 로컬 저장소 |
| 오디오 | AVFoundation 기반 자체 오디오를 먼저 검증, MusicKit은 별도 Sprint |
| 알림 | UserNotifications |
| 화면 밝기 | UIKit `UIScreen` 연동 |
| 향후 | WatchConnectivity, Core Location, HealthKit, MusicKit |
| AI | 초기 PoC는 Mock, 이후 Backend를 통해 OpenAI API 연결 |
| 보안 | **AI API Key를 앱 바이너리에 저장하지 않는다** |

> Sprint 0에서 확정한 실제 값(배포 타깃, Swift 버전 등)은 `docs/DECISIONS.md` 참고.

---

## 4. 목표 아키텍처

```
App
 → UI Layer
   → ViewModel
     → RestPlan / Domain Model
       → RestPlanExecutor
         → Services
           → iOS Frameworks
```

### 권장 디렉터리
```
App/
Features/Home/
Features/RestSession/
Features/RestResult/
Models/
Engine/
Services/Audio/
Services/Timer/
Services/Brightness/
Services/Notification/
Persistence/
Resources/
Tests/
```

### 4.1 핵심 책임 분리
- UI는 iOS 시스템 API를 직접 호출하지 않는다.
- ViewModel은 화면 상태와 사용자 이벤트를 관리한다.
- RestPlan은 *무엇을 실행할지*를 표현한다.
- RestPlanExecutor는 RestPlan을 해석해 필요한 Service를 호출한다.
- 각 Service는 하나의 시스템 기능만 책임진다.
- 향후 AI가 교체되어도 iOS 실행 계층은 영향을 최소화한다.

---

## 5. 핵심 데이터 모델

### RestPlan 필수 필드
`id` / `durationSeconds` / `restType` / `audioMode` / `movement` / `targetBrightness` / `screenMode` / `endCheckin` / `guidanceMessages`

```json
{
  "id": "mock-001",
  "durationSeconds": 600,
  "restType": "environment_reset",
  "audioMode": "calm",
  "movement": "slow_walk",
  "targetBrightness": 0.25,
  "screenMode": "minimal",
  "endCheckin": true,
  "guidanceMessages": ["휴대폰은 내려놓고 천천히 걸어보세요."]
}
```

- RestPlan은 **Codable**로 설계해 향후 Backend JSON 응답을 그대로 받을 수 있게 한다.
- 앱이 지원하지 않는 값이 들어오면 안전한 기본값으로 대체하거나 실행을 거부한다.

---

## 6. RestPlanExecutor

RestPlanExecutor는 쉼 시작과 종료의 **오케스트레이션**을 담당한다.

### `start(plan)`
1. 원래 화면 밝기 저장
2. 필요한 오디오 시작
3. 화면 밝기 변경
4. 타이머 시작
5. 종료 로컬 알림 예약
6. RestSession 상태 시작

### `finish(reason)`
1. 타이머 정리
2. 오디오 종료
3. 예약 알림 정리
4. 화면 밝기 복원
5. RestSession 상태 종료
6. 결과 화면으로 이동

### `cancel()`
`finish(reason: cancelled)`와 동일한 정리 규칙을 따른다.

> 앱이 비정상적인 상태 전환을 하더라도 **밝기와 오디오가 가능한 한 원상복구되도록 방어적으로 구현한다.**

---

## 7. Service 명세

### 7.1 TimerService
- 실제 남은 시간을 Timer tick 누적으로 계산하지 **않는다.**
- 시작 시각과 목표 종료 시각을 저장하고 **현재 시각과의 차이**로 남은 시간을 계산한다.
- 앱이 백그라운드에 갔다 돌아와도 시간이 틀어지지 않아야 한다.
- 테스트에서는 짧은 duration을 주입할 수 있어야 한다.

### 7.2 AudioService
- PoC에서는 **저작권 문제가 없는 로컬 테스트 오디오**를 사용한다.
- 재생, 일시정지, 정지 기능을 분리한다.
- 다른 시스템 오디오와의 충돌을 고려해 `AVAudioSession` 정책을 명시한다.
- Background Audio 검증은 별도 Sprint에서 실제 기기로 확인한다.

### 7.3 BrightnessService
- 쉼 시작 직전 현재 밝기를 저장한다.
- RestPlan의 `targetBrightness`를 적용한다.
- 종료, 취소, 실패 시 저장된 밝기를 복원한다.
- `0.0 ~ 1.0` 범위를 벗어난 값은 clamp한다.
- 밝기 변경 실패가 전체 쉼 실행 실패로 이어지지 않도록 한다.

### 7.4 NotificationService
- 사용자 권한 요청은 명확한 시점에 **한 번만** 한다.
- 쉼 종료 시점의 로컬 알림을 예약한다.
- 쉼이 앱 안에서 정상 종료된 경우 불필요한 예약 알림을 정리한다.
- **권한 거부 상태에서도 쉼 자체는 실행 가능해야 한다.**

---

## 8. 화면 명세

### 8.1 Home
제품 철학상 복잡한 대시보드를 만들지 않는다.
- 짧은 상태 선택 영역
- 한 줄 자유 입력은 후속 Sprint에서 추가 가능
- 대표 CTA: **"쉼 시작"**
- 개발 초기에는 "10분 쉼 시작" Mock 버튼 사용 가능

### 8.2 RestSession
화면은 최대한 단순해야 한다.
- 남은 시간
- 한 문장 안내
- 중단 버튼
- **불필요한 네비게이션, 피드, 추천 콘텐츠 금지**
- 기본적으로 어두운 화면을 사용한다.

### 8.3 RestResult
질문은 **한 번만** 한다 — "조금 나아졌나요?"
- 조금 나아졌어요
- 그대로예요
- 더 불편해요

선택 후 즉시 홈으로 복귀한다.

---

## 9. 상태 모델

최소 상태: `idle` / `preparing` / `running` / `finishing` / `completed` / `cancelled` / `failed`

- 상태 전이는 한 곳에서 관리한다.
- 중복 `start`가 발생하지 않도록 막는다.
- `running` 중 다시 시작 버튼이 눌려도 두 개의 Timer나 AudioSession이 생성되지 않아야 한다.

---

## 10. 테스트 전략

### 유닛 테스트
- RestPlan decoding
- RestPlan validation
- TimerService 시간 계산
- Brightness clamp
- RestPlanExecutor start/finish/cancel 상태 전이

### 수동 실기기 테스트
- 쉼 시작 시 오디오 재생
- 밝기 감소
- 홈 화면으로 나갔다 돌아왔을 때 남은 시간 정확성
- 화면 잠금 후 종료 알림
- 정상 종료 후 밝기 복원
- 중간 취소 후 밝기 복원
- 알림 권한 거부 상태에서 쉼 실행
- 앱 재진입 시 중복 실행 없음

---

## 11. 현재 금지 범위

Phase 1 ~ 초기 MVP에서 임의로 구현하지 않는다.

OpenAI 직접 호출 / 로그인·회원가입 / 결제 / Apple Watch / HealthKit / 위치·날씨 /
Screen Time Shield / Focus 강제 제어 / 커뮤니티 / SNS / 긴 AI 상담 채팅 / 광고 / 복잡한 관리자 기능

---

## 12. 완료의 정의

**코드가 존재하는 것만으로 완료가 아니다.**

- 빌드가 성공해야 한다.
- 가능한 테스트가 통과해야 한다.
- 실제 iPhone 검증이 필요한 항목은 실제 테스트 전에는 **"구현 완료 / 실기기 미검증"** 으로 표시한다.
- Mock이나 임시 구현은 명시한다.
- 기술적 제약을 숨기지 않는다.
- 각 Sprint의 Acceptance Criteria를 모두 충족해야 완료다.

---

## 13. 향후 AI 연결 원칙

- iOS 앱은 OpenAI API를 직접 호출하지 않는다.
- Backend API가 AI Provider와 통신한다.
- AI 응답은 구조화된 RestPlan JSON으로 제한한다.
- AI가 반환한 RestPlan을 앱이 그대로 맹신하지 않고 Rest Engine/Validator를 통과시킨다.
- AI Provider는 추상화해 향후 다른 모델로 교체 가능하게 한다.

---

## 14. 개발 우선순위

1. 쉼 시작부터 종료까지 깨지지 않는 실행 흐름
2. 화면을 보지 않아도 되는 경험
3. iOS 시스템 기능의 안정적 복원
4. AI 연결
5. 개인화
6. Watch 및 위치/날씨

> **디자인 완성도보다 실행 안정성을 먼저 검증한다.**
