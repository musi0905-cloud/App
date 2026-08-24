# docs/DECISIONS.md — 기술 결정 기록

> 각 Sprint에서 확정된 중요한 기술 결정을 기록한다.
> 상태: `제안` = PO 승인 대기 / `확정` = 승인됨 / `보류` = 조건 충족 시 재검토

---

## D-001. 개발 환경: 현재 세션은 Linux이며 iOS 빌드가 불가능하다

- **Sprint**: 0
- **상태**: 확정 (사실 확인) / 대응 방안은 **PO 결정 필요**
- **문제 구분**: C — 개발 환경 제약

### 확인된 사실 (2026-08-24)

| 확인 항목 | 명령 | 결과 |
|---|---|---|
| OS | `uname -a` | `Linux vm 6.18.44-fc-v21 ... x86_64` |
| 배포판 | `/etc/os-release` | `Ubuntu 24.04.4 LTS (Noble Numbat)` |
| macOS 여부 | `sw_vers` | **명령 없음 → macOS 아님** |
| Xcode | `xcodebuild -version` | **명령 없음 → 미설치** |
| Swift | `swift --version` | **명령 없음 → 툴체인 미설치** |
| Xcode CLI | `xcrun --version` | **명령 없음** |

### 결과

- Xcode, iOS Simulator, `xcodebuild`는 **macOS 전용**이며 Linux에 설치할 수 없다. 우회 수단은 없다.
- SwiftUI / UIKit / AVFoundation / UserNotifications는 Apple 플랫폼 전용 프레임워크이므로
  Linux용 Swift 툴체인을 설치하더라도 **이 프로젝트의 컴파일 검증에는 쓸 수 없다.**
- 따라서 이 환경에서 Sprint 0 Acceptance Criteria 중 **AC-1(Xcode에서 열림)**, **AC-2(Simulator 빌드 성공)** 는
  **검증 불가**이며, 충족했다고 보고해서는 안 된다.

### 이 환경에서 할 수 있는 것 / 없는 것

| 가능 | 불가능 |
|---|---|
| Swift 소스 작성 | Swift 컴파일 |
| `.xcodeproj` 파일 작성 | Xcode로 열어 확인 |
| 프로젝트 구조·참조 정합성 정적 검증 (`scripts/verify_repo.py`) | Simulator 빌드 |
| 문서 작성 및 동기화 | 유닛 테스트 실행 |
| 시크릿 스캔 | 실기기 검증 |

### 대응 옵션 (PO 결정 필요)

**1안 — macOS + Xcode 로컬 환경에서 검증 (권장)**
- PO가 Mac에서 저장소를 clone하고 `ios/Shim.xcodeproj`를 열어 Simulator 빌드를 실행한다.
- 장점: 즉시 확인 가능, 추가 비용 없음, 실기기 검증까지 같은 환경에서 이어진다.
- 단점: 매 Sprint마다 PO의 수동 확인이 필요하다.

**2안 — GitHub Actions macOS 러너로 CI 자동 검증**
- `.github/workflows/ios.yml`에서 `runs-on: macos-latest` + `xcodebuild build test` 실행.
- 장점: Claude Code가 PR/푸시마다 실제 빌드·테스트 결과를 객관적으로 확인할 수 있다. 회귀 방지.
- 단점: GitHub Actions macOS 러너는 분당 과금 배수가 높다. 초기 설정 시간이 필요하다.
- **B-002로 Backlog에 등록됨.**

**3안 — 1안 + 2안 병행**
- CI로 Simulator 빌드/유닛 테스트를 상시 검증하고, 실기기 검증만 PO가 수동 수행.
- 장점: 실기기가 필요한 항목(Sprint 3·5)과 그 외를 깔끔히 분리할 수 있다.
- 단점: 비용과 설정 부담이 가장 크다.

### 채택 (Product Owner 결정, 2026-08-24)

**1안 — PO의 Mac 로컬 환경에서 검증.** 2안(macOS CI)은 Sprint 0의 필수 조건에서 제외하고
Backlog(B-002)로 유지한다. 근거와 감수 리스크는 **D-008** 참고.

검증 부담을 줄이기 위해 `scripts/mac_verify.sh`를 제공한다.
Mac에서 한 줄로 AC-1 / AC-2 / AC-6을 순서대로 검증하고 로그를 남긴다.

> **Sprint 0은 AC-1 / AC-2 / AC-6이 Mac에서 확인되기 전까지 `DONE`이 아니다.** (D-009)

---

## D-002. 저장소 분리: 「쉼」 iOS는 `musi0905-cloud/shim-ios`로 분리한다

- **Sprint**: 0
- **상태**: **확정** (Product Owner 결정, 2026-08-24) / 이전 작업 **진행 중**
- **문제 구분**: D — 제품 결정 필요 → 해결됨

### 배경

작업 대상으로 지정됐던 `musi0905-cloud/App`에는 「쉼」과 **무관한 Google Apps Script 프로젝트**가 있었다.

```
Code.gs (105 KB) / Index.html / Scripts.html / Styles.html / appsscript.json
```

기본 브랜치는 `claude/ai-business-webapp-u1xuwo`이고 커밋 이력도 전부 해당 웹앱 관련이다.

### 결정 (Product Owner)

1. 「쉼」 iOS 프로젝트는 기존 Apps Script 저장소와 **분리한다.**
2. 새 저장소 이름: **`shim-ios`** (`musi0905-cloud/shim-ios`)
3. 기존 Apps Script 파일은 **이동하거나 수정하지 않는다.**
4. 「쉼」 관련 파일만 새 저장소로 이전한다.

### 이전 대상 파일

```
CLAUDE.md  README.md  .gitignore
docs/{PRODUCT,IOS_SPEC,SPRINTS,DECISIONS}.md
scripts/{verify_repo.py,mac_verify.sh}
ios/**                    (project.yml, Shim.xcodeproj, Shim/, ShimTests/)
```

**이전하지 않는 파일** (`musi0905-cloud/App`에 그대로 둔다):
`Code.gs` `Index.html` `Scripts.html` `Styles.html` `appsscript.json`

### 현재 진행 상태 — BLOCKED

**`shim-ios` 저장소가 아직 생성되지 않았다.**

Claude Code 세션의 GitHub App 통합은 저장소 생성 권한이 없다.

```
POST https://api.github.com/user/repos
→ 403 Resource not accessible by integration
```

이 세션의 GitHub 접근 범위는 `musi0905-cloud/app` 하나로 한정돼 있고,
`create_repository` 호출은 통합 권한 부족으로 거부된다. 우회 방법은 없다.

**해제 조건**: Product Owner가 빈 저장소 `musi0905-cloud/shim-ios`를 생성한다.
생성 후 세션에 알려주면 해당 저장소를 세션에 연결(`add_repo`)해 곧바로 push한다.

`scripts/` 밖에 준비된 이전 절차는 `MIGRATION.md` 참고.

### 이전 완료 전까지의 원칙

- 「쉼」 파일은 `musi0905-cloud/App`의 `claude/shim-ios-sprint-0-setup-aalbvo` 브랜치에 임시로 유지한다.
  이 브랜치는 기본 브랜치에 병합되지 않았으므로 App 저장소의 실제 내용에는 영향이 없다.
- **새 저장소에 push가 확인된 뒤에만** 이 브랜치에서 「쉼」 파일을 제거한다.
  (먼저 지우면 작업물이 어디에도 남지 않는다.)
- 기존 Apps Script 파일은 어떤 경우에도 건드리지 않는다.

## D-003. iOS 배포 타깃: iOS 17.0

- **Sprint**: 0
- **상태**: **확정** (Product Owner 결정, 2026-08-24 — "현재대로 iOS 17.0을 유지한다")
- **문제 구분**: B — 플랫폼 제약

### 근거

`docs/IOS_SPEC.md` §3은 "최신 안정 Xcode가 권장하는 현실적인 배포 타깃을 사용하고 **실제 장비 테스트 가능성을 우선**한다"고 규정한다.

- iOS 17.0은 이 프로젝트가 필요로 하는 API(`Observation`, SwiftUI `NavigationStack`, `AVAudioSession`, `UNUserNotificationCenter`, `UIScreen.brightness`)를 모두 포함한다.
- 최신 최소버전으로 올리면 PO가 보유한 실기기가 대상에서 빠질 위험이 있다. iOS 17.0은 그 위험이 낮다.

### 확정

Product Owner가 iOS 17.0 유지를 결정했다. 변경하지 않는다.

향후 변경이 필요해지면 두 곳을 함께 고쳐야 한다 (`scripts/verify_repo.py`가 불일치를 검출한다):
`ios/project.yml`의 `deploymentTarget` / `ios/Shim.xcodeproj/project.pbxproj`의 `IPHONEOS_DEPLOYMENT_TARGET`.

---

## D-004. 코드 서명: Team ID를 저장소에 커밋하지 않는다

- **Sprint**: 0
- **상태**: 확정
- **문제 구분**: B/C

### 결정

- `CODE_SIGN_STYLE = Automatic`, `DEVELOPMENT_TEAM = ""` (빈 값)으로 커밋한다.
- 실기기 배포가 필요한 시점(Sprint 3 이후)에 PO가 Xcode의 Signing & Capabilities에서 자신의 Team을 선택한다.
- Xcode가 `project.pbxproj`에 Team ID를 기록할 수 있으므로, 커밋 전 `git diff`로 확인한다.
- `.p12`, `.mobileprovision`, `AuthKey_*.p8` 등 서명 관련 파일은 `.gitignore`에서 차단된다.

### Apple Developer Program 필요 여부

| 목적 | 유료 프로그램 필요 |
|---|---|
| Simulator 빌드·실행 | **불필요** |
| 실기기 설치 (개인 개발자 계정, 7일 만료) | 불필요 |
| Background Audio 등 capability 실기기 검증 | 실기기 설치가 되면 가능 |
| TestFlight 배포, App Store 심사 | **필요 (연 $99)** |

> Sprint 3(Audio PoC)의 실기기 검증부터는 최소한 무료 개인 계정으로 기기 등록이 필요하다.

---

## D-005. Swift 언어 모드: Swift 5 모드로 시작

- **Sprint**: 0
- **상태**: 제안
- **문제 구분**: C

### 결정

`SWIFT_VERSION = 5.0`으로 시작한다.

- Swift 6 언어 모드의 엄격한 동시성 검사는 Sprint 2~6(타이머·오디오·밝기 Service의 액터 경계 설계)에서 대량의 컴파일 오류를 유발할 수 있다.
- 운영규칙 §4 "현재 필요하지 않은 과도한 추상화 도입을 피한다"에 따라, 실행 흐름이 안정화된 뒤 Swift 6 모드 전환을 별도로 검토한다.
- `docs/IOS_SPEC.md` §3의 "Swift Concurrency 우선" 원칙은 언어 모드와 무관하게 유지한다 (`async/await`, `Task`, `actor` 사용).

---

## D-006. 프로젝트 정의의 기준은 `ios/project.yml` (XcodeGen)

- **Sprint**: 0
- **상태**: **확정** (Product Owner 결정, 2026-08-24)
- **문제 구분**: C — 개발 환경 제약

### 배경

이 개발 세션에는 Xcode가 없어 `.xcodeproj`를 Xcode로 생성할 수 없다 (D-001).
Sprint 0에서는 `project.pbxproj`를 수기로 작성했다.

### 결정 (Product Owner)

> "`project.pbxproj` 수기 작성본보다 `ios/project.yml`을 기준으로 XcodeGen 재생성을 우선 검토한다.
> Mac에서 XcodeGen 사용 가능 시 `xcodegen generate` 후 생성 프로젝트를 기준으로 검증한다.
> 기존 수기 pbxproj에 문제가 있으면 억지로 유지하지 않는다."

따라서:

1. **`ios/project.yml`이 프로젝트 정의의 기준(source of truth)이다.**
2. Mac 검증 시 XcodeGen이 있으면 `cd ios && xcodegen generate`로 **재생성한 프로젝트를 기준으로 검증한다.**
   `scripts/mac_verify.sh`가 이 순서를 자동으로 따른다.
3. 커밋된 `ios/Shim.xcodeproj`는 **XcodeGen이 없는 환경을 위한 fallback**이다.
4. 수기 pbxproj에 문제가 발견되면 유지하려 시도하지 않고, **생성된 프로젝트로 교체하고 커밋한다.**

### 두 정의를 모두 커밋하는 이유

`.xcodeproj`를 gitignore하면 XcodeGen 없이는 아무도 프로젝트를 열 수 없다.
따라서 둘 다 커밋하되 **우선순위를 위와 같이 명시**한다.

`scripts/verify_repo.py`가 두 정의의 핵심 설정(배포 타깃 / Swift 버전 / 번들 ID) 일치를 검사한다.

### 재생성 시 주의 — 파일 추가 방식이 달라진다

| | 수기 pbxproj (현재 커밋본) | XcodeGen 생성본 |
|---|---|---|
| 파일 참조 방식 | `PBXFileSystemSynchronizedRootGroup` — 디렉터리 전체 동기화 | 파일을 명시적으로 나열 |
| 소스 추가 시 | 프로젝트 파일 수정 불필요 | **`xcodegen generate` 재실행 필요** |

⚠️ **XcodeGen 경로로 전환한 뒤에는 `ios/Shim/`에 파일을 추가할 때마다 `cd ios && xcodegen generate`를 다시 실행해야 한다.**
Sprint 1부터 파일이 늘어나므로 이 점을 `README.md`에 명시했다.

### 알려진 제약

- 수기 pbxproj는 `objectVersion = 77`이라 **Xcode 16 이상에서만 열린다.**
  Xcode 15 이하라면 XcodeGen 재생성이 사실상 필수다.
- 수기 pbxproj는 **Xcode로 열어 확인하기 전까지 정상 동작을 보장할 수 없다** (D-001).
  `scripts/verify_repo.py`는 구조·참조 정합성만 정적 검사하며 빌드 검증이 아니다.

## D-007. 테스트 프레임워크: XCTest

- **Sprint**: 0
- **상태**: 제안
- **문제 구분**: C

### 결정

유닛 테스트는 **XCTest**로 작성한다.

- Swift Testing(`import Testing`)은 Xcode 16+ 전용이다. XCTest는 모든 Xcode 버전과 CI에서 동작한다.
- D-006의 Xcode 15 이하 fallback 경로에서도 테스트 타깃이 그대로 동작해야 한다.
- Swift Testing 전환은 Xcode 버전이 확정된 뒤 별도로 검토한다.

---

## D-008. GitHub Actions macOS CI는 Sprint 0의 필수 조건이 아니다

- **Sprint**: 0
- **상태**: **확정** (Product Owner 결정, 2026-08-24)
- **문제 구분**: C — 개발 환경 제약

### 결정 (Product Owner)

> "GitHub Actions macOS CI는 현재 Sprint 0 완료의 필수 조건으로 만들지 않는다.
> MVP 초기 기능이 안정화된 이후 도입할 Backlog로 유지한다."

### 결과

- D-001의 대응 옵션 중 **1안(PO의 Mac 로컬 검증)** 을 채택한다.
- 2안(macOS CI)은 폐기하지 않고 **B-002로 Backlog에 유지**한다. 도입 시점은 MVP 초기 기능 안정화 이후.
- Sprint 0의 AC-1 / AC-2 / AC-6은 **Product Owner의 Mac 환경에서 수동 검증**으로 충족한다.
- 검증 부담을 줄이기 위해 `scripts/mac_verify.sh`를 제공한다. Mac에서 한 줄로 3개 항목을 검증하고 로그를 남긴다.

### 감수하는 리스크

CI가 없으므로 **회귀를 자동으로 잡지 못한다.** Sprint가 진행될수록 "Linux에서 작성 → Mac에서 검증" 왕복 비용이 커진다.
Sprint 2~3쯤 이 비용이 체감되면 B-002 도입 시점을 다시 논의한다.

---

## D-009. Sprint 0 Acceptance Criteria에 Unit Test 성공(AC-6)을 추가한다

- **Sprint**: 0
- **상태**: **확정** (Product Owner 결정, 2026-08-24)
- **문제 구분**: D — 제품 결정 필요

### 배경

원본 `04_쉼 Sprint Backlog v0.1`의 Sprint 0 Acceptance Criteria는 5개였고 Unit Test 항목이 없었다.

### 결정 (Product Owner)

> "Mac/Xcode 환경에서 다음 검증이 완료된 이후 Sprint 0을 DONE 처리한다.
> Xcode에서 프로젝트 열기 / iOS Simulator 대상 build 성공 / **Unit Test 성공**"

### 결과

Sprint 0의 Acceptance Criteria에 **AC-6 — Unit Test 성공**을 추가한다. 총 6개가 된다.

`ios/ShimTests/ShimSmokeTests.swift`의 스모크 테스트 2개가 통과해야 한다.
이 테스트는 제품 로직을 검증하지 않고, **테스트 타깃이 앱을 host로 로드하고 실행되는지**만 확인한다.
실제 Domain 테스트(RestPlan decoding 등)는 Sprint 1부터 추가한다.

`docs/SPRINTS.md`의 Sprint 0 AC 표에 반영했다.

> Google Drive 원본 문서가 최상위 기준이므로, `04_쉼 Sprint Backlog v0.1`의 Sprint 0 항목에도
> 이 변경을 반영하는 것이 좋다. (운영규칙 §13 — 제품 결정이 바뀌면 구현보다 문서를 먼저 갱신한다)
