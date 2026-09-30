# 0.4.0 — 인물과 시간 순서 안내

2026-09-29

- 생성된 성인 방문객 4종을 인터폰과 CCTV에 표시. 인물 외형은 방문객 ID에 고정되며 안전 여부와 무관.
- CCTV의 이전/현재 비교: 첫 근무 두 번째 사건의 00:37 입장과 00:47 현재 현관을 전환해 확인.
- 첫 사건의 7분 카메라 시간 차이, 마지막 사건의 인원 불일치를 시각적으로 표시.
- 이전 기록 → 현재 방문 → CCTV/명부/통화 → 마지막 확인 순서의 사건 정리.
- 미조회 증거와 재확인 결과는 열람 전 공개하지 않음. 다음 행동 버튼과 비교 질문 추가.
- 첫 근무 8개 사건의 설명을 쉬운 문장으로 교체. 기존 저장 데이터 호환 유지.
- CCTV는 정지 캐릭터로 재구성한 장면이며 걷기/표정 변화 애니메이션은 없음.

검증: 엔진 7개 통과, Chromium 시나리오 9개 통과(인물 표시, 미조회 단서 비공개, 순서 안내, 과거/현재 시각 전환, 기존 전체 근무/저장/오프라인 회귀 검사 포함). 실제 iPhone 실행은 미검증.

이미지: built-in imagegen. 프롬프트: Korean night security mystery game, four separate full-body adult Korean visitors in equal columns, neutral standing, realistic illustrated muted green/gray, woman short hair coat / man light jacket / woman long hair cardigan / older man coat, transparent background, no text. 저장 위치: dist/assets/visitors.png (1536x1024 RGBA).
