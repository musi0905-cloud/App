# 404호는 없습니다

아파트 야간 경비원이 방문객을 들여보낼지 판단하는 한국어 공포 게임입니다. 한 번 구매하면 계속 쓰고, 광고와 추가 결제는 없습니다.

## 현재 상태 (2026-10-08)

| 항목 | 상태 |
|---|---|
| 운영 사이트 | v0.5.0 (ChatGPT Sites, 소유자 전용) |
| 최신 작업본 | v0.14.0 — `room404/` (운영 미배포). 5야간 이야기·증거·퍼즐·엔딩 30개 조건 연결(v0.14). 쉬운 대사, 전화 목소리, 넘기는 기록부, 이미지 v2·v3, 장소별 2대 카메라, 원근법·연출·효과음, 휴대폰 지적 수정, 인터폰 모니터+말풍선, 방문객 8명·소품 14종 |
| 웹 테스트 링크 | https://claude.ai/artifact/5SGZeeX8wAE1mDyaYGG48B (최신 작업본을 그대로 올림. 결과 이미지 저장 버튼은 이 뷰어에서 동작하지 않음) |
| iOS 앱 | Capacitor 8.5.2 Xcode 프로젝트 초안 (v0.2 기준, 최신 코드와 동기화 필요) |
| Android 앱 | 아직 없음 |
| 스토어 등록 | 아직 안 함. Google Play 먼저 진행 (앱 ID `com.musi0905.room404`, 3,300원) |

## 폴더 구성

| 폴더 | 내용 |
|---|---|
| `room404/` | 게임 소스 (dist, tests, scripts, 인수인계 문서, 검사 결과) |
| `character-motion-v1/` | V001 걷기 캐릭터 원본 자료 (v0.6.1, v0.8에서 v2 걷기 그림으로 교체) |
| `visual-motion-v2/` | 이미지·모션 v2 원본 117개 (배경, 걷기 프레임, 소품, 영상 23개, 제작 코드·문서). 게임에는 WebP로 줄여 적용 |
| `character-v4/` | 캐릭터 v4 보행 수정 원본 (앞모습 걷기 시트 8장, 렌더러 수정안, 검수 문서). v0.12에서 적용 |
| `visual-v3/` | 이미지 v3 원본 41개 + 검수 문서 (배경 6, 방문객 8명 그림, 소품 8, 화면 3). v0.10~v0.11에서 적용 |
| `story-plan/v1.1/` | 스토리 개발기획 v1.1 패키지 원본(문서 20종, 데이터 JSON/CSV, 프로토타입 SVG). 점검·연결 상태는 `docs/STORY_IMPORT_REPORT.md` |
| `story-plan/v1.2/` | S2~S5 기획결정 v1.2 원본(저장·야간 흐름, 40슬롯, 엔딩 조건 초안) + ZIP |
| `story-plan/v1.3/` | 엔딩 시뮬레이션 v1.3 원본(구현 지시, 조건 30개, 증인 30개, 시뮬레이션 보고서) |
| `docs/` | 정리 문서 |

## 문서

| 문서 | 내용 |
|---|---|
| [docs/CODE_GUIDE.md](docs/CODE_GUIDE.md) | 코드 구조를 섹션별로 정리한 문서. 코드가 바뀔 때마다 함께 갱신 |
| [docs/GOOGLE_PLAY_GUIDE.md](docs/GOOGLE_PLAY_GUIDE.md) | Google Play 출시 단계별 안내 |
| [docs/STORE_RELEASE_PLAN.md](docs/STORE_RELEASE_PLAN.md) | 같은 코드로 App Store와 Google Play에 함께 출시하는 방법 |
| [docs/WRITING_GUIDE.md](docs/WRITING_GUIDE.md) | 게임 문구·대사 작성 기준 (쉬운 말) |
| [docs/CCTV_ANGLE_IMAGE_SPEC.md](docs/CCTV_ANGLE_IMAGE_SPEC.md) | CCTV 여러 각도용 그림 규격 |
| [docs/GPT_ASSET_PROMPT.md](docs/GPT_ASSET_PROMPT.md) | GPT에 그림(배경·인물·사물)을 요청하는 복사용 프롬프트 |
| [docs/STORY_IMPORT_REPORT.md](docs/STORY_IMPORT_REPORT.md) | 스토리 v1.1 패키지 점검 결과, 연결한 것/안 한 것 |
| [docs/ENDING_VERIFICATION_REPORT.md](docs/ENDING_VERIFICATION_REPORT.md) | 엔딩 E01~E30 조건 구현과 검증 결과(PASS/FAIL/SKIP), 해결되지 않은 기획 모순 |
| [docs/WORKLOG.md](docs/WORKLOG.md) | 작업 기록과 남은 일 |

## 원본 자료 위치

- Drive 폴더: https://drive.google.com/drive/folders/1lsBgozxM3Ac3rGedzehYRwTkBtvo5Obl
- 인수인계서: `404호는_없습니다_v0.6.0_Claude_Code_인수인계.md`
- v0.6 작업본: `404호는_없습니다_v0.6.0_코드_검사결과_Claude인수인계.zip` (17MB)
