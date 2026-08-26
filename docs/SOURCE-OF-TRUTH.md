# Source of Truth — 쉼 Community

이 문서는 "무엇을 제품 기준으로 삼는가"만 정의한다. 기준 자체를 여기서 새로 만들지 않는다.

## 우선순위

충돌하면 위가 이긴다.

| 순위 | 문서 | 위치 | 상태 |
| --- | --- | --- | --- |
| 1 | 쉼 제품 기획 기준서 v0.1 | Google Drive (원본) | **원본이 최상위** |
| 2 | `docs/PRODUCT.md` | 이 저장소 (동기화 사본) | 1번의 사본. 원본과 다르면 원본을 따른다 |
| 3 | 쉼 Community 기획/UX/기술 정의 | **아직 제공되지 않음** | 웹 Community 전용 기준. 제공되면 이 표에 추가한다 |
| 4 | `docs/ARCHITECTURE.md` | 이 저장소 | 기술 구조 결정 |
| 5 | `docs/SPRINTS.md` | 이 저장소 | 작업 순서 |

## 공식 기준이 아닌 것

- **`prototype.sprint0-reference.html`** — Sprint 0에서 원본 UX Reference를 찾지 못한 상태로
  Claude가 임시 생성한 산출물이다. 제품 UX 기준이 아니다. "Sprint 0에 무엇을 만들었는가"의
  기록으로만 쓴다. 공식 기준과 충돌하면 언제나 공식 기준을 따른다.
- Sprint 0에서 구현한 Home 화면의 상태 카드 문구·순서·hint 텍스트 역시 확정된 카피가 아니다.
  공식 UX 정의가 도착하면 교체 대상이다.

## 아직 확정되지 않은 것 (Product Owner 결정 필요)

`docs/PRODUCT.md`는 iOS 앱 기준으로 작성되어 있고, 웹 Community의 위치를 명시하지 않는다.
아래는 Claude가 임의로 결정하지 않는다.

1. **웹 Community와 iOS 앱의 관계.** `docs/PRODUCT.md` §8은 "첫 개발 플랫폼은 iOS로 한다.
   웹은 아이디어 검증이나 관리 도구에는 사용할 수 있다"고 정의한다. 쉼 Community가
   독립 제품인지, iOS의 보조 채널인지 명시가 필요하다.
2. **Community 기능의 범위.** `docs/PRODUCT.md` §15 "당장 만들지 않을 것"에는
   "처음부터 복잡한 커뮤니티"와 "SNS형 피드"가 포함되어 있다. 쉼 Community가 이 항목의
   예외인지, 아니면 §15를 갱신해야 하는지 확인이 필요하다.
3. **AI Rest 응답 구조의 정합성.** 웹 Community 지시는 "짧은 공감 → 쉼 행동 1개 →
   휴대폰 내려놓기"이고, `docs/PRODUCT.md` §5는 구조화된 Rest Plan JSON을 반환하는
   AI Rest Director를 정의한다. 방향은 일치하지만 출력 형식이 다르다.
   웹에서 Rest Plan 스키마를 공유할지 결정이 필요하다.

## 확정되어 이 프로젝트에도 적용되는 것

`docs/PRODUCT.md`에서 플랫폼과 무관하게 유지되는 원칙:

- 사용자를 오래 붙잡지 않는다. 쉼이 끝나면 현실로 돌려보낸다.
- 조언보다 실행이 먼저다.
- 의료·상담·치료 서비스가 아니다. (§13 안전 경계)
- 체류시간을 핵심 KPI로 삼지 않는다. (§14)
- 금지: 댓글 / DM / Follow / 인기순 / 랭킹 / View Count 경쟁 / Infinite Scroll

## 관련 저장소

- `musi0905-cloud/shim-ios` — 쉼 iOS 앱. `docs/PRODUCT.md`의 동기화 원본이 있는 곳.
  해당 저장소의 `docs/DECISIONS.md` D-002가 저장소 분리 원칙을 기록하고 있다.
- `musi0905-cloud/App` — **무관한 Google Apps Script 프로젝트.** 쉼 파일을 넣지 않는다.
