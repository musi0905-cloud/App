# 5야간 흐름과 저장 상태 v1.2

`TITLE → NIGHT_INTRO → VISITOR → INVESTIGATION → DECISION → FEEDBACK → NEXT_VISITOR → NIGHT_RECAP → (NEXT_NIGHT | ARCHIVE_ENDING | CONTINUE_LATER) → FINAL_BOARD → ENDING`

저장 포맷 예제 (기존 404_active_v2 키를 직접 오염시키지 않도록 `404_story_v3` 신규 키):
```json
{"schemaVersion":3,"runId":"uuid","night":1,"slot":1,"phase":"VISITOR","completedScenes":[],"accessHistory":[],"evidenceFound":[],"evidenceVerified":[],"puzzlesSolved":[],"archiveChoices":[],"endingUnlocked":[],"victimNamesPreserved":false,"externalSubmission":false,"migration":{"fromLegacy":null}}
```

- 신규 유저: N1_01에서 시작. 각 사건 결과 완료 때 저장(원자적 쓰기). 완료된 scene ID는 집합처럼 중복 방지.
- 기존 저장 유저: 구 버전 데이터는 읽기만. 현행 엔진의 완료/진행 중 8건을 재현해 N1 대응 scene ID를 계산하되 부분 저장의 현재 방문객 `evidence-open` 상태는 별도로 보존. 검증할 수 없는 부분은 자동 변환하지 말고 원본 백업 후 N1 이어하기.
- 슬롯 8 종료: `NIGHT_RECAP`, 다음 야간 진입은 명시적 버튼. 재진입 시 이전 결과가 중복 적용되지 않음.
- N5 완료: 최종 퍼즐 보드 개방. 부족한 필수 EV는 기록 보관함에서 재검증.
- `archive_resolution_selected`는 모든 야간 종료 후 기록 메뉴의 명시적 분기이며 메인 진행 상태를 지우지 않는 복제된 결말 리플레이로 처리.
- 긴급 신고와 출입 판단 버튼은 별도. 최종 엔딩 조건은 UI에서 근거를 설명하며 가려진 정답 누설 금지.
- 저장 복구 테스트: 매 장면 3단계(조사 전, 조사 중, 선택 직후) 종료→재시작 120회; N1 기존 저장 테스트; 각 야간 반복 진입 차단.
