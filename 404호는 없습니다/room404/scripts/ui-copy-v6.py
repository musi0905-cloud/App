from pathlib import Path
import json
p=Path('dist/data/scenarios.json');cs=json.loads(p.read_text())
fixes={'같음 번호 없음':'등록된 번호가 없어요','일반 들어갈 수 없음':'일반 방문객은 들어갈 수 없어요','집 전화과 방문객 전화의 관계 불명':'집 전화가 왜 방문객 전화와 연결되는지 아직 몰라요','통화 상대 누구인지 확인 실패':'전화를 받은 사람이 누구인지 몰라요','명시적 응답':'분명한 답','등록 방법 이용을 거부함':'관리실에 적힌 번호로 전화하지 말라고 해요','방문 가려는 집':'가려는 집','보낸 곳 가능한 집 목록에 없음':'등록된 집 번호가 아니에요','신규 필기':'새로 적은 이름','해당 가려는 집 등록 없음':'이 집은 목록에 없어요','호출 주체 확인 불가':'누가 부르는지 알 수 없어요','이사 들어옴 상태':'이사 온 기록','이사 들어옴 처리 대기':'이사 온 기록을 정리하는 중','그 집 주민 미리 허락한 P-212':'주민이 미리 허락한 기록 P-212','동명이인':'이름이 같은 사람','허락 사용 가능시간은 아직 남음':'방문할 수 있는 시간이 아직 남아 있어요','출입 카드 만들어 줌':'카드 발급 기록','새로 만들어 줌 R-17로 연결':'새 카드 R-17을 받은 기록이 있어요','이름 한 글자 오기':'이름 한 글자가 잘못 적혀 있어요','착신 안내만 받은 내용':'다른 번호로 연결된다는 안내만 들었어요','변경 신청 N-518 신청':'번호를 바꿔 달라는 신청 N-518','관리소 관리실 확인 번호와 시행 시각 존재':'관리실이 확인한 번호와 시작 시간이 있어요','허락 담당자 목록에':'오늘 일하기로 한 담당자 목록에','그 집 주민와':'그 집 주민과','폐쇄 계단':'닫아 둔 계단','계단 폐쇄 · 우회 출입 공지':'계단을 닫아 다른 길로 오라는 공지','명칭 변경 · 주소 동일':'이름만 바뀌었고 주소는 같아요','통화 단절':'통화가 끊겼어요','신원':'누구인지','처리 대기':'정리 중','재배송':'다시 보내는 택배','반송':'돌려보냄'}
def clean(s):
 for a,b in fixes.items():s=s.replace(a,b)
 return s
for c in cs:
 for o in [c['document'],c['call']]:
  for k,v in o.items():o[k]=clean(v)
 for scene in c['scenes']:scene['note']=clean(scene['note'])
 c['call']['reply']=c['plain']['confirmed']
 c['claim']=clean(c['claim'])
p.write_text(json.dumps(cs,ensure_ascii=False,indent=2))
p=Path('dist/game.js');s=p.read_text()
s=s.replace("const $=id=>", "const TOOL_NAMES={CCTV:'CCTV 보기',명부:'주민·방문 기록',통화:'집에 전화하기',재확인:'한 번 더 확인'};\nconst $=id=>")
s=s.replace('clue:pack.clue,verify:pack.verificationDetail,question:pack.question','clue:pack.plain.what,verify:pack.plain.confirmed,question:pack.plain.check')
s=s.replace('방문 접수','방문객 도착').replace('호 방문 주장','호에 간다고 해요').replace('호 주장','호 방문')
s=s.replace('`확인 ${i+1} · ${t}`','`확인 ${i+1} · ${TOOL_NAMES[t]}`')
s=s.replace('마지막 · 다른 자료로 재확인','마지막 · 한 번 더 확인').replace('앞의 단서가 맞는지 다른 카메라·관리실 원본·등록 연락처로 확인합니다.','다른 카메라를 보거나, 관리실에 적힌 번호로 전화해 다시 물어봐요.')
s=s.replace('`다음 할 일: ${next} 확인`','`다음 할 일: ${TOOL_NAMES[next]}`').replace('다음 할 일: 다른 자료로 재확인','다음 할 일: 한 번 더 확인').replace('조사가 끝났습니다. 시간 순서대로 읽고 출입을 결정하세요.','확인을 마쳤어요. 이 사람을 들여보낼지 결정하세요.')
s=s.replace('`${next}부터 확인하기`','TOOL_NAMES[next]').replace('마지막 재확인 하기','한 번 더 확인하기')
s=s.replace("'오판 '","'틀린 판단 '").replace("'오판했습니다'","'다시 생각해 보세요'")
s=s.replace("${a.safe?'허용':'거부'}가 타당했습니다. ${guide().clue}","${a.safe?'들여보내도 되는 사람이었어요.':'문을 열어 주면 안 되는 사람이었어요.'} ${guide().clue}")
s=s.replace('모든 방문객의 증거를 확인하고 독립 재확인을 마쳤습니다.','모든 방문객의 기록을 보고, 다른 자료로 한 번 더 확인했어요.')
a=s.index('function clueFor(tool)');b=s.index('function inspected()',a)
s=s[:a]+'''function clueFor(tool){const {v,a,pack}=current();if(tool===a.channel)return pack.plain.what;if(tool==='명부')return `관리실 기록에서 ${v.name} 님의 ${v.unit}호 방문을 찾았어요. 들어와도 되는지는 그 집에 한 번 더 물어봐야 해요.`;if(tool==='통화')return `${fill(pack.call.line,v)} ${pack.call.detail}`;return `${sourceTime(-1)}에 현관으로 왔고, ${TIMES[run.index]}에 문을 열어 달라고 했어요. ${a.channel==='명부'?'가져온 종이와 관리실 기록':'그 집에 전화한 내용'}도 확인하세요.`}
''' +s[b:]
replacements={'조회 시각':'기록을 확인한 시간','<th>성명</th>':'<th>이름</th>','<th>목적지</th>':'<th>가려는 집</th>','① 방문객이 제출한 내용':'① 이 사람이 말하거나 보여 준 것','② 관리실 원본에서 조회한 내용':'② 관리실에 적혀 있는 것','같은 사람·호수의 기록인지, 변경·취소 이력이 있는지 비교하세요. 이 자료만으로 최종 승인 여부가 결정되지 않을 수 있습니다.':'두 내용이 같은지 보세요. 이름·호수·예약이 바뀌었거나 취소된 기록도 확인하세요.','원본 조회를 누르면 제출 자료와 등록 기록을 나란히 확인할 수 있습니다.':'기록 보기를 누르면 이 사람이 가져온 것과 관리실 기록을 함께 볼 수 있어요.','앞선 기록을 다른 원본으로 대조해 주세요.':'앞에서 확인한 내용이 맞는지 한 번 더 봐 주세요.','호 방문을 요청합니다. 신원과 방문 승인을 확인할 수 있나요?':'호에 가려고 왔어요. 아는 사람인가요? 들어가도 되나요?',"'수신 기록'":"'들은 내용'","'경비원 기록'":"'경비원의 메모'",'대조 완료':'다시 확인했어요','기록 열람 대기':'아직 확인하지 않았어요','아래 버튼으로 기록을 열면 연결 경로와 대화 내용을 확인할 수 있습니다.':'아래 버튼을 누르면 어디로 전화했는지, 무슨 말을 들었는지 볼 수 있어요.',"'명부':'명부 · 제출 자료 대조'":"'명부':'주민·방문 기록 보기'","'통화':'연결 경로 · 통화 기록'":"'통화':'집에 전화한 내용'","'재확인':'다른 원본으로 최종 확인'":"'재확인':'한 번 더 확인한 결과'",' / 접수 ':' / 도착 ','기록 열람 중':'확인한 내용','조회 대기':'아래 버튼을 눌러 주세요','보관 영상':'저장된 영상','이 사건의 이전 기록과 현재 화면을 조회합니다.':'이 사람이 오기 전과 지금의 모습을 볼 수 있어요.','조회 전에는 사건 단서를 표시하지 않습니다.':'아래의 영상 보기 버튼을 눌러 주세요.','대조 출처':'다시 확인한 곳','기준 화면과 다시 비교':'영상도 다시 보기','열람한 자료는 사건 기록에 저장됩니다. 각 구간의 시각과 출처를 함께 비교하세요.':'확인한 내용은 경비실에 메모해 두었어요.','조회 버튼을 누르면 이 사건의 자료가 열립니다.':'아래 버튼을 눌러 확인하세요.',"CCTV:'사건 영상 조회','명부':'원본 기록 조회','통화':'연결·대화 기록 열기','재확인':'다른 원본 대조하기'":"CCTV:'영상 보기','명부':'기록 보기','통화':'통화 내용 보기','재확인':'한 번 더 확인하기'",'`${next} 확인하기`':'TOOL_NAMES[next]',"'v0.5.0'":"'v0.6.0'"}
for a,b in replacements.items():s=s.replace(a,b)
a=s.index(' if(done)body+=`<aside');b=s.index(" $('toolBody').innerHTML",a)
s=s[:a]+''' if(done){const summary=activeTool==='재확인'?pack.plain.confirmed:clueFor(activeTool);const question=activeTool===a.channel?pack.plain.check:({CCTV:'이 사람이 언제 왔는지 먼저 보세요.',명부:'말한 이름·호수와 적힌 내용이 같은지 보세요.',통화:'그 집 주민이 누구인지, 들어와도 된다고 했는지 확인하세요.'})[activeTool];body=`<aside class="plain-brief"><h3>${activeTool==='재확인'?'다시 알아보니':'지금 알게 된 것'}</h3><p>${e(summary)}</p>${question?`<h3>다음에는 이것을 확인하세요</h3><p>${e(question)}</p>`:''}</aside>`+body;}
''' +s[b:]
p.write_text(s)
p=Path('dist/index.html');s=p.read_text().replace('명부, CCTV, 확인 통화가 서로 다를 때 누구를 들여보낼지 결정하십시오.','당신은 야간 경비원이에요. 찾아온 사람이 누구인지 확인하고, 문을 열어 줄지 결정하세요.')
s=s.replace('<button data-tool="명부">② 명부</button><button data-tool="CCTV">① CCTV</button><button data-tool="통화">③ 확인 통화</button><button id="verify">④ 마지막 재확인</button>','<button data-tool="CCTV">① CCTV 보기</button><button data-tool="명부">② 주민·방문 기록</button><button data-tool="통화">③ 집에 전화하기</button><button id="verify">④ 한 번 더 확인</button>')
s=s.replace('출입 거부','문 열지 않기').replace('출입 허용','들여보내기').replace('① CCTV → ② 명부 → ③ 통화 → ④ 재확인 순서로 진행하면 됩니다. 외모만으로 판단하지 마세요.','① 영상 보기 → ② 기록 보기 → ③ 집에 전화하기 → ④ 한 번 더 확인. 얼굴만 보고 결정하지 마세요.').replace('경비실에서 판단','돌아가서 결정하기').replace('판정 결과','내 선택의 결과')
s=s.replace('<p class="small">8건 · 광고·추가 결제 없음</p>','<p class="small">방문객 8명 · 광고·추가 결제 없음</p><details class="how-to"><summary>처음이라면? 이렇게 하면 돼요</summary><ol><li>CCTV로 언제 왔고 몇 명인지 봐요.</li><li>이름과 호수가 관리실 기록과 같은지 봐요.</li><li>그 집에 전화해 들어와도 되는지 물어봐요.</li><li>이상한 점이 있으면 다른 카메라나 연락처로 한 번 더 확인해요.</li></ol><p>마지막에 “들여보내기” 또는 “문 열지 않기”를 고르세요.</p></details>')
p.write_text(s)
p=Path('dist/sw.js');p.write_text(p.read_text().replace('v0.5.0','v0.6.0'))
with Path('dist/style.css').open('a') as f:f.write('\n.plain-brief{border-left:3px solid #d7bf7b;background:#223529;padding:16px 18px;margin-bottom:20px}.plain-brief h3{font-size:14px;color:#e3cb8a;margin:0 0 8px}.plain-brief h3:not(:first-child){margin-top:20px}.plain-brief p{font-size:17px;line-height:1.75;color:#f0f0df;margin:0}.how-to{margin:20px 0;border:1px solid #596d5d;padding:14px}.how-to summary{min-height:34px;font-size:16px;cursor:pointer}.how-to li{margin:10px 0;line-height:1.7}\n')
