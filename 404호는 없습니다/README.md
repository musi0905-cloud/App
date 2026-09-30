# 404호는 없습니다

아파트 야간 경비원이 방문객을 들여보낼지 판단하는 한국어 공포 게임입니다. 한 번 구매하면 계속 쓰고, 광고와 추가 결제는 없습니다.

## 현재 상태 (2026-09-30)

| 항목 | 상태 |
|---|---|
| 운영 사이트 | v0.5.0 (ChatGPT Sites, 소유자 전용) |
| 최신 작업본 | v0.9.0 — `room404/` (운영 미배포). 쉬운 대사, 전화 목소리, 넘기는 기록부, 이미지·모션 v2, CCTV 카메라 바꾸기, 원근법·연출·효과음 |
| iOS 앱 | Capacitor 8.5.2 Xcode 프로젝트 초안 (v0.2 기준, 최신 코드와 동기화 필요) |
| Android 앱 | 아직 없음 |
| 스토어 등록 | 아직 안 함. Google Play 먼저 진행 (앱 ID `com.musi0905.room404`, 3,300원) |

## 폴더 구성

| 폴더 | 내용 |
|---|---|
| `room404/` | 게임 소스 (dist, tests, scripts, 인수인계 문서, 검사 결과) |
| `character-motion-v1/` | V001 걷기 캐릭터 원본 자료 (v0.6.1, v0.8에서 v2 걷기 그림으로 교체) |
| `visual-motion-v2/` | 이미지·모션 v2 원본 117개 (배경, 걷기 프레임, 소품, 영상 23개, 제작 코드·문서). 게임에는 WebP로 줄여 적용 |
| `docs/` | 정리 문서 |

## 문서

| 문서 | 내용 |
|---|---|
| [docs/CODE_GUIDE.md](docs/CODE_GUIDE.md) | 코드 구조를 섹션별로 정리한 문서. 코드가 바뀔 때마다 함께 갱신 |
| [docs/GOOGLE_PLAY_GUIDE.md](docs/GOOGLE_PLAY_GUIDE.md) | Google Play 출시 단계별 안내 |
| [docs/STORE_RELEASE_PLAN.md](docs/STORE_RELEASE_PLAN.md) | 같은 코드로 App Store와 Google Play에 함께 출시하는 방법 |
| [docs/WRITING_GUIDE.md](docs/WRITING_GUIDE.md) | 게임 문구·대사 작성 기준 (쉬운 말) |
| [docs/CCTV_ANGLE_IMAGE_SPEC.md](docs/CCTV_ANGLE_IMAGE_SPEC.md) | CCTV 여러 각도용 그림 규격 |
| [docs/WORKLOG.md](docs/WORKLOG.md) | 작업 기록과 남은 일 |

## 원본 자료 위치

- Drive 폴더: https://drive.google.com/drive/folders/1lsBgozxM3Ac3rGedzehYRwTkBtvo5Obl
- 인수인계서: `404호는_없습니다_v0.6.0_Claude_Code_인수인계.md`
- v0.6 작업본: `404호는_없습니다_v0.6.0_코드_검사결과_Claude인수인계.zip` (17MB)
