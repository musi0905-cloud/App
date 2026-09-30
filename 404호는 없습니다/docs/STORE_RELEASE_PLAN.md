# App Store · Google Play 동시 출시 계획

조사일: 2026-09-30. 스토어 정책은 자주 바뀌므로 제출 직전에 공식 문서로 다시 확인합니다.

## 1. 결론: Capacitor로 코드 하나를 두 앱에 넣는다

게임은 이미 HTML/CSS/JS로 된 웹 앱(PWA)입니다. **Capacitor**를 쓰면 같은 `dist/` 웹 코드를 iOS 앱과 Android 앱에 그대로 넣을 수 있습니다.

- v0.2 때 이미 Capacitor 8.5.2로 iOS 프로젝트를 만들어 두었습니다. `@capacitor/android`만 추가하면 됩니다.
- 게임 코드·JSON·이미지는 앱 안에 포함됩니다. 원격 사이트를 불러오는 방식이 아니므로 오프라인에서도 동작합니다.
- 게임 로직은 한 곳(`dist/`)에서만 고칩니다. `npx cap sync`가 두 플랫폼에 복사합니다.

```
dist/ (게임 코드 하나)
  ├─ npx cap sync ios     → ios/App      → Xcode → App Store
  └─ npx cap sync android → android/     → Android Studio → Google Play
```

### 다른 방법과 비교

| 방법 | 장점 | 단점 | 판단 |
|---|---|---|---|
| **Capacitor** | 지금 코드를 그대로 씀. iOS 초안이 이미 있음 | 웹뷰 기반이라 Apple 심사 4.2 대비 필요 | **채택** |
| React Native / Flutter | 네이티브 UI | 게임 전체를 다시 작성해야 함 | 제외 |
| Unity / Godot | 게임 엔진 기능 | 전면 재작성, 앱 용량 증가 | 제외 |
| PWA만 배포 | 가장 간단 | 스토어에 올릴 수 없음(Play의 TWA는 Android만 해당) | 보조 수단 |

## 2. 코드 쪽에서 할 일

1. `capacitor.config.json`의 `webDir`를 현재 빌드 폴더(`dist`)로 맞춥니다. v0.2 설정은 `www`로 되어 있습니다.
2. `npm i @capacitor/android@8` 후 `npx cap add android`를 실행합니다.
3. Android 설정은 Capacitor 8 기준 `minSdk 24 / compileSdk 36 / targetSdk 36`입니다. Android Studio 2025.2.1(Otter) 이상, Java 21을 권장합니다.
4. 서비스워커(`sw.js`)는 앱 안에서는 필요 없습니다. 파일이 이미 앱에 들어 있기 때문입니다. 앱에서 실행될 때는 등록하지 않도록 분기합니다(`Capacitor.isNativePlatform()`).
5. 저장 방식을 확인합니다. 현재는 `localStorage`(`404_active_v2`, `404_last_run`)를 씁니다. 앱 안에서도 동작하지만, OS가 저장 공간을 정리할 때 지워질 수 있습니다. 그래서 `@capacitor/preferences`로 옮기는 방안을 검토합니다.
6. 결과 PNG 공유는 `@capacitor/share`, `@capacitor/filesystem`으로 바꿉니다. 웹의 `navigator.share`는 Android 웹뷰에서 동작하지 않을 수 있습니다.
7. Android 뒤로가기 버튼을 처리합니다(`@capacitor/app`의 `backButton` 이벤트). 조사 화면이면 게임 화면으로, 홈이면 종료 확인을 띄웁니다.
8. 아이콘과 시작 화면은 `@capacitor/assets`로 두 플랫폼용을 한 번에 생성합니다.
9. 앱 ID는 `com.room404.nightwatch`를 그대로 쓸지 정합니다. **한 번 출시하면 바꿀 수 없습니다.**

## 3. 스토어별 요건

### Google Play
- **대상 API**: 2026-08-31부터 새 앱과 업데이트는 **Android 16(API 36)** 이상을 대상으로 해야 합니다. Capacitor 8 기본값이 36이므로 충족합니다.
- **개인 개발자 계정의 테스트 의무**: 2023-11-13 이후 만든 개인 계정은 정식 출시 전에 **테스터 12명 이상이 14일 연속 참여한 비공개 테스트**를 거쳐야 합니다. 2026년부터는 테스터가 실제로 앱을 썼는지도 확인합니다. 출시 일정에 최소 2~3주를 더해야 합니다.
- 업로드 형식은 AAB이고, Play 앱 서명을 사용합니다.
- 등록비는 1회 25달러입니다.

### Apple App Store
- **심사 지침 4.2(최소 기능)**: 웹사이트를 감싸기만 한 앱은 거절됩니다. 이 게임은 콘텐츠가 앱 안에 있고 오프라인으로 동작합니다. 여기에 햅틱, 네이티브 공유, 가로·세로 대응 등을 넣으면 "웹사이트 재포장"이 아님을 보여 줄 수 있습니다.
- 빌드·서명·제출에는 Mac과 Xcode가 필요합니다. Mac이 없으면 클라우드 빌드(예: Ionic Appflow, Codemagic, GitHub Actions macOS 러너)를 쓸 수 있습니다.
- Apple Developer Program은 연 99달러입니다.

### 공통: "한 번 구매, 광고·추가 결제 없음"
- 가장 단순한 방법은 **양쪽 모두 유료 앱(선불 가격)** 으로 등록하는 것입니다. 인앱 결제 코드가 필요 없습니다.
- "무료 체험 후 전체 해금" 방식을 원하면 비소모성 인앱 상품이 필요합니다. 이 경우 두 스토어의 결제 연동(예: RevenueCat)을 추가해야 합니다.
- 공포 게임이므로 연령 등급 설문(Play는 IARC, Apple은 자체 설문)에 공포 표현 수준을 정확히 적습니다.

## 4. 진행 순서 제안

1. v0.6 코드를 이 폴더에 올리고 테스트를 통과시킵니다. (진행 중)
2. `webDir` 정리, Android 플랫폼 추가, 네이티브 플러그인 적용
3. Android 에뮬레이터와 실기기에서 확인한 뒤 Play 비공개 테스트 시작 (14일 대기가 시작됨)
4. 그동안 Mac 또는 클라우드 빌드로 iOS를 빌드해 TestFlight에 올립니다.
5. 스토어 등록정보(스크린샷, 설명, 개인정보처리방침, 연령 등급)를 준비합니다.
6. Play 정식 출시를 신청하고 App Store 심사에 제출합니다.

## 5. 사용자 결정이 필요한 것

- [ ] 개발자 계정 보유 여부: Apple(연 99달러), Google Play(1회 25달러), 개인 계정인지 법인 계정인지
- [ ] Mac 사용 가능 여부. 없으면 클라우드 빌드를 씁니다.
- [ ] 가격 모델: 유료 앱으로 할지, 무료 다운로드 후 1회 해금으로 할지
- [ ] 앱 ID 확정 (`com.room404.nightwatch`)
- [ ] Play 비공개 테스트에 참여할 테스터 12명 확보 방법

## 출처
- [Google Play 대상 API 요건](https://developer.android.com/google/play/requirements/target-sdk)
- [Play Console 도움말: 대상 API 수준](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [신규 개인 개발자 계정 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Capacitor 8.0 업데이트 안내](https://capacitorjs.com/docs/updating/8-0)
- [Capacitor Android 대상 SDK 설정](https://capacitorjs.com/docs/android/setting-target-sdk)
- [웹뷰 앱과 App Store 심사 지침](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper/)
