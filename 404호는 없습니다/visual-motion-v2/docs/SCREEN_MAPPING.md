# 기존 화면과 에셋 대응

| 기존 게임 화면/위치 | 이미지 | 모션 |
|---|---|---|
| home | title-night.png | 02-title-rain.mp4 |
| game / 경비 데스크 | guard-office.png | 01-office-ambient.mp4 |
| CCTV / lobby | cctv-lobby.png | 03-lobby-monitor.mp4 |
| CCTV / lobbySide | cctv-lobby-side.png | 04-lobby-side-monitor.mp4 |
| CCTV / hall | cctv-hall.png | 05-hall-monitor.mp4 |
| CCTV / elevator | cctv-elevator.png | 06-elevator-monitor.mp4 |
| CCTV / stairs | cctv-stairs.png | 07-stairs-monitor.mp4 |
| CCTV / parking | cctv-parking.png | 08-parking-monitor.mp4 |
| door / 닫힘 | door-closed.png | 09-door-comparison.mp4는 상태 비교 전용 |
| door / 열림 | door-open.png | 23-door-open-ambient.mp4 |
| 명부·주민 기록 | ledger-desk.png | 10-ledger-inspection.mp4 |
| 주민 확인 통화 | intercom-desk.png | 11-intercom-ring.mp4 |
| 재확인·기록 대조 | ledger-desk.png 또는 해당 CCTV | 판단 자료에 맞춰 개별 선택 |
| feedback | guard-office.png | 답변 텍스트는 기존 게임 유지 |
| result | ending-dawn.png | 12-ending-dawn.mp4 |
| 공유 결과 카드 | ending-dawn.png | 정지 이미지 사용 |
| 방문객 외형 1~4 | visitor-01~04/walk-01~08.png | 13~16 방문객별 이동 |
| 그림자 지연 | cctv-hall.png + visitor-01 | 17-delayed-shadow.mp4 |
| 중복 방문객 | cctv-lobby.png + visitor-02 | 18-duplicate-visitors.mp4 |
| 반사 지연 | cctv-elevator.png + visitor-03 | 19-reflection-lag.mp4 |
| 신호 끊김 | cctv-lobby.png | 20-signal-loss.mp4 |
| 적외선 표현 | cctv-parking.png + visitor-04 | 21-infrared-view.mp4 |
| 비·유리창 잔상 | cctv-lobby.png + visitor-01 | 22-rain-double-image.mp4 |

모션 파일명 번호는 게임 사건 번호와 관계없습니다. MP4는 재사용·검수용 23종이며 100개 사건을 각각 촬영한 영상이 아닙니다. 특정 사건에 이상 현상 영상을 적용할 때 원본 scenarios.json의 location, mode, offset, prop을 먼저 확인해야 합니다.
