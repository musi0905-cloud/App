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

### 결정 사항 (사용자 답변)
- 스토어 계정 없음, Mac 없음, 가격 3,300원. `STORE_RELEASE_PLAN.md` 5~6장에 반영했습니다.
- 앱 ID는 아직 정하지 않았습니다.
- 앱 ID `com.musi0905.room404` 확정. Google Play만 먼저 진행하기로 했습니다(`GOOGLE_PLAY_GUIDE.md` 작성).

### 코드 전달 시도
- 나눈 ZIP(01 소스코드 7.3MB, 02 이미지·검사자료 9.7MB)을 Drive 도구로 받으려 했으나, 큰 파일은 연결이 끊겨 실패했습니다(작은 파일은 정상). 이 환경은 네트워크 정책상 drive.google.com에 직접 접속할 수도 없습니다.
- 대안: GitHub 웹에서 ZIP 두 개를 이 폴더에 직접 업로드 → Claude가 압축을 풀어 커밋.
