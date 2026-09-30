# 작업 기록

## 2026-09-30

### 한 일
- Drive의 v0.6.0 인수인계서를 확인했습니다.
- GitHub에 `404호는 없습니다/` 폴더를 만들었습니다.
- App Store와 Google Play에 같은 코드로 출시하는 방법을 조사했습니다. 결론은 Capacitor입니다(`STORE_RELEASE_PLAN.md`).
- 코드 가이드 뼈대를 작성했습니다(`CODE_GUIDE.md`).

### 막힌 점
- v0.6 ZIP이 17MB라 Drive 도구 한도(10MB)를 넘어 받지 못했습니다. 10MB 이하로 나눠 Drive에 올려 주시기로 했습니다.

### 다음 할 일
1. 나눈 ZIP을 받아 이 폴더에 코드를 올립니다. `SHA256SUMS.txt`로 무결성을 확인합니다.
2. 테스트를 실행합니다(`npm test` → `test:ui` → `test:all-cases`).
3. 코드를 읽고 `CODE_GUIDE.md`를 실제 내용으로 채우고, 개선 사항을 적용합니다.
4. Capacitor Android 플랫폼을 추가합니다.
