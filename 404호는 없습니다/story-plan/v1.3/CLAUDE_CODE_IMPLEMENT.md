# Claude Code 구현 지시 — 엔딩 조건 v1.3

1. 기존 엔진과 v1.2 JSON을 백업한다. 기존 E01~E06 실제 엔진 판정은 보존한다.
2. `ending_gates_30_simulated.json`을 현재 런타임의 조건 스키마로 변환하고, 원본 파일을 직접 덮어쓰지 않는다.
3. 이야기 상태에 `nightCompleted`, `completedScenes`, `evidenceAcquired`, `evidenceVerified`, `puzzlesSolved`, `sceneChoices`, `archiveEndingConfirmed`, `victimNamesPreserved`, `externalSubmission`, `finalChoice` 등을 저장. 각 필드는 실제 사건·화면 상호작용에서만 변경된다.
4. E07~E27은 문서 정리(archive) UI에서 해당 단서와 장면 선택을 만족한 후 '이 기록으로 마무리'를 **명시적으로 누를 때**만 트리거. 조건 불충족이면 필요한 근거를 스포일러 없이 알려준다. 자유 진행은 그대로 허용한다.
5. E28/E29/E30은 최종 선택 각각 seal_archive/resign/submit_verified_evidence로 분리, 선택별 분기. E30의 필수 증거가 누락되면 제출 선택을 비활성화하고 검증 가능한 조사 화면을 안내한다.
6. 오픈 중인 방문객 판정 화면에 엔딩 조건/범인 정보 선공개 금지. `selectedArchiveScene`으로 기록 결산 대상 장면을 지정하고, `archiveEndingConfirmed`는 선택 직후 리셋해 자동 종료 중복 방지.
7. `simulation_witnesses_30.json`을 유닛 테스트 픽스처로 사용하여 모든 엔딩 positive 30개와 mutation negative 테스트 최소 1개/필드 생성. 5야간 실제 플레이 시나리오 테스트 추가.
8. 저장 버전 업그레이드 시 기존 `404_active_v2` 사용자 기록 마이그레이션; 실패는 안전 복구. 소스 무단 배포/공개 금지.
9. 검증 완료라고 선언하기 전에 엔진 테스트, 실제 화면 클릭, 저장→재실행→엔딩 조건 유지, Android/iOS 실기기 여부를 각각 PASS/FAIL/SKIP로 기록.

## 우선 수정할 추가 데이터 결함
- v1.2 N2~N5 사건 일부의 `story_contact_*` 대사는 상투적인 문장이다. 적어도 주요 단서 사건의 대사를 실제 획득 행동·동선과 맞춰 검수해야 한다.
- E07~E27의 줄거리와 v1.1 컷신은 사건의 성격을 가리키지만 각 엔딩의 4컷 완성도는 플레이 테스트로 검증되지 않았다.
- 현재 패키지는 실행 엔진 소스를 포함하지 않으므로 '코드 구현 완료'로 보고하지 말 것.
