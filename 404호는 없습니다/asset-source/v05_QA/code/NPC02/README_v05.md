# NPC02 손·소품 경계 수정 v05

REVISE. 엔진 적용 0. 최종 애니메이션 아님.

수정: 허벅지·종아리 위쪽 경계의 투명도 겹침. 팔·소품 원화는 v04 유지. 다른 인물의 새 소품 부품을 이 인물에 재사용하지 않음.

sprites/: 방향별48장, 720×1280 RGBA. MP4는 합성 검토용. assets/는 기존 소스와 새 소스(해당 인물만). config.json에서 실제 rig_path를 확인. 원본 v04는 보존했다. 얼굴·배경·발 궤적 변경 없음.

Node.js, @napi-rs/canvas 0.1.100, Python, ffmpeg/ffprobe 필요. npm install 후 npm run render → npm run qa → npm run encode. 배경합성 전체PNG는 재출력 가능하며 이 ZIP은 방향별 첫 프레임과 합성 영상 포함. 루트 이동이 있어 마지막 프레임을 첫 프레임으로 위치까지 초기화하는 단순 반복은 순간 이동함.

원화 생성 여부와 검수 범위는 QA_v05.json 참고. 형식 검사 PASS는 품질 PASS를 뜻하지 않음.
