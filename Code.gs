const SHEET_ID = '1A86zHegF2MRKS0EiqToKvBR7LKiOSMBOcXGsC8tcpvg';
const CONTEXT_VERSION = '2.0';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('AI 사업 운영')
    .addItem('1. 한글 화면 적용', 'configureKoreanUI')
    .addItem('2. API 키 설정', 'setApiKeys')
    .addItem('2-1. Claude 안정 모델 설정', 'setStableClaudeModels')
    .addSeparator()
    .addItem('3. 승인 선택 처리', 'processApprovals')
    .addItem('4. 다음 작업 실행', 'processNextCommand')
    .addItem('5. 선택한 작업 다시 실행', 'retrySelectedCommand')
    .addItem('6. 승인 처리 + 다음 작업 실행', 'processAutomationCycle')
    .addSeparator()
    .addItem('7. 5분 자동 실행 설치', 'installFiveMinuteTrigger')
    .addItem('8. 자동 실행 제거', 'removeAutomationTriggers')
    .addToUi();
}

function setStableClaudeModels() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('CONFIG');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idx = indexMap(headers);

  upsertConfigRow(sheet, values, idx, {
    config_key: 'CLAUDE_MODEL',
    config_value: 'claude-sonnet-5',
    category: 'MODEL',
    description: 'Claude 기본 개발·검토 모델',
    secret: false,
    active: true,
    updated_at: new Date(),
    notes: '최종 텍스트가 없으면 자동 폴백'
  });

  const refreshed = sheet.getDataRange().getValues();
  const refreshedIdx = indexMap(refreshed[0]);

  upsertConfigRow(sheet, refreshed, refreshedIdx, {
    config_key: 'CLAUDE_FALLBACK_MODEL',
    config_value: 'claude-sonnet-4-6',
    category: 'MODEL',
    description: 'Claude 자동 폴백 모델',
    secret: false,
    active: true,
    updated_at: new Date(),
    notes: 'Claude 5가 thinking만 반환할 때 자동 사용'
  });

  SpreadsheetApp.getUi().alert(
    'Claude 안정 모델 설정 완료',
    '기본: claude-sonnet-5\n폴백: claude-sonnet-4-6',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function upsertConfigRow(sheet, values, idx, record) {
  const key = record.config_key;
  let targetRow = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.config_key] || '') === key) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) {
    const headers = values[0];
    sheet.appendRow(headers.map(h => record[canonicalHeader(String(h).trim())] ?? record[String(h).trim()] ?? ''));
    return;
  }

  Object.entries(record).forEach(([field, value]) => {
    if (idx[field] !== undefined) {
      sheet.getRange(targetRow, idx[field] + 1).setValue(value);
    }
  });
}

function setApiKeys() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const openai = ui.prompt('OpenAI API Key', 'API 키를 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (openai.getSelectedButton() === ui.Button.OK && openai.getResponseText().trim()) {
    props.setProperty('OPENAI_API_KEY', openai.getResponseText().trim());
  }
  const anthropic = ui.prompt('Anthropic API Key', 'API 키를 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (anthropic.getSelectedButton() === ui.Button.OK && anthropic.getResponseText().trim()) {
    props.setProperty('ANTHROPIC_API_KEY', anthropic.getResponseText().trim());
  }
  ui.alert('API 키를 Script Properties에 저장했습니다.');
}

function installFiveMinuteTrigger() {
  removeAutomationTriggers();
  ScriptApp.newTrigger('processAutomationCycle').timeBased().everyMinutes(5).create();
  SpreadsheetApp.getUi().alert('5분 자동 실행 트리거를 설치했습니다.');
}

function removeAutomationTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['processNextCommand', 'processAutomationCycle'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
}


function configureKoreanUI() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('COMMANDS');

  const koreanHeaders = [
    '작업번호', '생성일시', '프로젝트번호', '작업유형', '요청내용', '우선순위',
    '진행상태', '담당AI', '승인필요', '결과요약', '실행기록번호', '처리일시',
    '오류내용', '승인선택', '수정의견', '승인처리일시'
  ];
  sheet.getRange(1, 1, 1, koreanHeaders.length).setValues([koreanHeaders]);

  const lastRow = Math.max(sheet.getLastRow(), 2);
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['AI 협의', '기획', '검토', '개발', '최종판단', '상태조회'], true)
    .setAllowInvalid(false).build();
  const priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['높음', '보통', '낮음'], true)
    .setAllowInvalid(false).build();
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['실행 대기', '처리 중', '승인 대기', '승인 완료', '수정 요청', '폐기', '완료', '오류', '보류'], true)
    .setAllowInvalid(false).build();
  const modelRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['GPT', '클로드', '없음'], true)
    .setAllowInvalid(false).build();
  const boolRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['예', '아니오'], true)
    .setAllowInvalid(false).build();
  const approvalRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['승인', '수정', '폐기'], true)
    .setAllowInvalid(false).build();

  sheet.getRange(2, 4, lastRow - 1, 1).setDataValidation(typeRule);
  sheet.getRange(2, 6, lastRow - 1, 1).setDataValidation(priorityRule);
  sheet.getRange(2, 7, lastRow - 1, 1).setDataValidation(statusRule);
  sheet.getRange(2, 8, lastRow - 1, 1).setDataValidation(modelRule);
  sheet.getRange(2, 9, lastRow - 1, 1).setDataValidation(boolRule);
  sheet.getRange(2, 14, lastRow - 1, 1).setDataValidation(approvalRule);

  const values = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  values.forEach(row => {
    row[3] = displayCommandType(row[3]);
    row[5] = displayPriority(row[5]);
    row[6] = displayStatus(row[6]);
    row[7] = displayModel(row[7]);
    row[8] = displayBoolean(row[8]);
    row[13] = displayApproval(row[13]);
  });
  sheet.getRange(2, 1, lastRow - 1, 16).setValues(values);

  SpreadsheetApp.getUi().alert('한글 화면 적용이 완료되었습니다.');
}

function canonicalHeader(header) {
  const map = {
    '작업번호': 'command_id',
    '생성일시': 'created_at',
    '프로젝트번호': 'project_id',
    '작업유형': 'command_type',
    '요청내용': 'request',
    '우선순위': 'priority',
    '진행상태': 'status',
    '담당AI': 'assigned_model',
    '승인필요': 'approval_required',
    '결과요약': 'result_summary',
    '실행기록번호': 'result_ref',
    '처리일시': 'processed_at',
    '오류내용': 'error',
    '승인선택': 'approval_decision',
    '수정의견': 'approval_note',
    '승인처리일시': 'approval_processed_at'
  };
  return map[header] || header;
}

function normalizeCommandType(value) {
  const v = String(value || '').trim().toUpperCase();
  const map = {
    '기획': 'PLAN', 'PLAN': 'PLAN',
    '검토': 'REVIEW', 'REVIEW': 'REVIEW',
    '개발': 'DEVELOP', 'DEVELOP': 'DEVELOP',
    '최종판단': 'DECISION', 'DECISION': 'DECISION',
    '상태조회': 'STATUS', 'STATUS': 'STATUS',
    'AI 협의': 'DISCUSSION', 'DISCUSSION': 'DISCUSSION'
  };
  return map[String(value || '').trim()] || map[v] || v;
}

function normalizeStatus(value) {
  const v = String(value || '').trim().toUpperCase();
  const map = {
    '실행 대기': 'READY', 'READY': 'READY',
    '처리 중': 'PROCESSING', 'PROCESSING': 'PROCESSING',
    '승인 대기': 'AWAITING_APPROVAL', 'AWAITING_APPROVAL': 'AWAITING_APPROVAL',
    '승인 완료': 'APPROVED', 'APPROVED': 'APPROVED',
    '수정 요청': 'REVISION_REQUESTED', 'REVISION_REQUESTED': 'REVISION_REQUESTED',
    '폐기': 'REJECTED', 'REJECTED': 'REJECTED',
    '완료': 'DONE', 'DONE': 'DONE',
    '오류': 'ERROR', 'ERROR': 'ERROR',
    '보류': 'HOLD', 'HOLD': 'HOLD'
  };
  return map[String(value || '').trim()] || map[v] || v;
}

function displayCommandType(value) {
  return ({PLAN:'기획', REVIEW:'검토', DEVELOP:'개발', DECISION:'최종판단', STATUS:'상태조회', DISCUSSION:'AI 협의'})[normalizeCommandType(value)] || value;
}
function displayStatus(value) {
  return ({READY:'실행 대기', PROCESSING:'처리 중', AWAITING_APPROVAL:'승인 대기', APPROVED:'승인 완료',
    REVISION_REQUESTED:'수정 요청', REJECTED:'폐기', DONE:'완료', ERROR:'오류', HOLD:'보류'})[normalizeStatus(value)] || value;
}
function displayPriority(value) {
  const v = String(value || '').trim().toUpperCase();
  return ({HIGH:'높음', MEDIUM:'보통', LOW:'낮음'})[v] || value;
}
function displayModel(value) {
  const v = String(value || '').trim().toUpperCase();
  return ({GPT:'GPT', CLAUDE:'클로드', NONE:'없음'})[v] || (value === '클로드' ? '클로드' : value);
}
function displayBoolean(value) {
  return truthy(value) ? '예' : (String(value || '').trim() ? '아니오' : '');
}
function displayApproval(value) {
  const v = normalizeApproval(value);
  return ({APPROVE:'승인', REVISE:'수정', REJECT:'폐기'})[v] || value;
}

function retrySelectedCommand() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('COMMANDS');
  const activeSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const activeRange = activeSheet.getActiveRange();

  if (activeSheet.getName() !== 'COMMANDS' || !activeRange || activeRange.getRow() < 2) {
    throw new Error('COMMANDS 시트에서 다시 실행할 작업 행의 아무 셀이나 선택하세요.');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = indexMap(headers);
  const rowNumber = activeRange.getRow();

  updateCommand(sheet, rowNumber, idx, {
    status: '실행 대기',
    result_summary: '',
    result_ref: '',
    processed_at: '',
    error: '',
    approval_decision: '',
    approval_note: '',
    approval_processed_at: ''
  });

  processNextCommand();
}

function processAutomationCycle() {
  processApprovals();
  processNextCommand();
}

function processApprovals() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return [];

  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('COMMANDS');
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return [];

    const headers = values[0];
    const idx = indexMap(headers);

    if (idx.approval_decision === undefined) {
      throw new Error('COMMANDS 시트에 approval_decision 열이 없습니다.');
    }

    const targets = values.slice(1)
      .map((row, i) => ({ row, sheetRow: i + 2, command: rowToObject(headers, row) }))
      .filter(x => normalizeStatus(x.command.status) === 'AWAITING_APPROVAL')
      .filter(x => String(x.command.approval_decision || '').trim() !== '');

    // 각 행을 처리한 결과(어떤 후속 작업이 새로 생성됐는지)를 반환한다.
    // processAutomationCycle()이나 메뉴 3번처럼 반환값을 쓰지 않는 기존 호출부는 그대로 동작하고,
    // 웹앱의 webApproveAndContinue()는 이 배열에서 자신이 승인한 행의 결과만 찾아 후속 작업을 실행한다.
    const results = [];

    for (const item of targets) {
      const command = item.command;
      const decision = normalizeApproval(command.approval_decision);
      const note = String(command.approval_note || '').trim();
      let nextCommandId = null;

      if (!decision) {
        updateCommand(sheet, item.sheetRow, idx, {
          error: 'approval_decision은 APPROVE, REVISE, REJECT 중 하나여야 합니다.'
        });
        results.push({ commandId: command.command_id, decision: null, nextCommandId: null });
        continue;
      }

      if (decision === 'APPROVE') {
        nextCommandId = handleApprovedCommand(ss, command);
        updateCommand(sheet, item.sheetRow, idx, {
          status: '승인 완료',
          approval_processed_at: new Date(),
          error: ''
        });
      } else if (decision === 'REVISE') {
        nextCommandId = createRevisionCommand(ss, command, note);
        updateCommand(sheet, item.sheetRow, idx, {
          status: '수정 요청',
          approval_processed_at: new Date(),
          error: ''
        });
      } else if (decision === 'REJECT') {
        updateCommand(sheet, item.sheetRow, idx, {
          status: '폐기',
          approval_processed_at: new Date(),
          error: ''
        });
      }

      results.push({ commandId: command.command_id, decision, nextCommandId });
    }

    return results;
  } finally {
    lock.releaseLock();
  }
}

// 승인 시 다음 단계로 자동 생성할 작업 유형. 기획→검토→최종판단→개발로 이어지고 개발 승인에서 끝난다.
const APPROVAL_CHAIN_STEPS_ = {
  PLAN: {
    nextType: '검토',
    nextModel: '클로드',
    idPrefix: 'CMD-REVIEW',
    buildRequest: (command, fullResult) =>
      `다음 GPT 기획안을 기술·UX·정책·보안·수익 실행 가능성 관점에서 검토하라.\n\n` +
      `[원 요청]\n${command.request}\n\n[GPT 기획안]\n${fullResult}`
  },
  REVIEW: {
    nextType: '최종판단',
    nextModel: 'GPT',
    idPrefix: 'CMD-DECISION',
    buildRequest: (command, fullResult) =>
      `다음 Claude 검토 결과를 반영해 최종 판단(진행/수정/중단)과 다음 행동을 결정하라.\n\n` +
      `[원 요청]\n${command.request}\n\n[Claude 검토 결과]\n${fullResult}`
  },
  DECISION: {
    nextType: '개발',
    nextModel: '클로드',
    idPrefix: 'CMD-DEVELOP',
    buildRequest: (command, fullResult) =>
      `다음 최종 결정을 개발 가능한 요구사항으로 구체화해 개발 명세, 파일 구조, 구현 순서, 테스트 기준을 작성하라.\n\n` +
      `[원 요청]\n${command.request}\n\n[최종 결정]\n${fullResult}`
  },
  // AI 협의(5단계) 최종보고서를 승인하면 개발명세(개발 타입) 작업을 만들고 즉시 실행한다.
  // DEVELOP(개발/개발명세)은 이 표에 다음 단계가 없으므로 승인해도 체인이 여기서 멈춘다 —
  // "개발명세 승인 단계에서 반드시 멈춘다"는 요구사항은 이 표에 DEVELOP 항목을 추가하지 않는 것으로 지킨다.
  DISCUSSION: {
    nextType: '개발',
    nextModel: '클로드',
    idPrefix: 'CMD-DEVSPEC',
    buildRequest: (command, fullResult) =>
      `다음은 승인된 AI 협의 최종보고서다. 이 보고서를 바탕으로 실제 코딩 착수 직전의 개발명세를 작성하라. ` +
      `이 단계에서는 개발명세만 작성하고 실제 제품 코드는 작성하지 마라.\n\n` +
      `[원 주제]\n${command.request}\n\n[승인된 최종보고서]\n${fullResult}`
  }
};

function handleApprovedCommand(ss, command) {
  const type = normalizeCommandType(command.command_type);
  const step = APPROVAL_CHAIN_STEPS_[type];
  if (!step) return null;

  const fullResult = getAiLogResult(command.result_ref) || command.result_summary || '';
  const newCommandId = makeId(step.idPrefix);

  appendCommand(ss, {
    command_id: newCommandId,
    created_at: new Date(),
    project_id: command.project_id,
    command_type: step.nextType,
    request: step.buildRequest(command, fullResult),
    priority: command.priority || '높음',
    status: '실행 대기',
    assigned_model: step.nextModel,
    approval_required: '예',
    result_summary: '',
    result_ref: '',
    processed_at: '',
    error: '',
    approval_decision: '',
    approval_note: '',
    approval_processed_at: ''
  });

  return newCommandId;
}

function createRevisionCommand(ss, command, note) {
  const fullResult = getAiLogResult(command.result_ref) || command.result_summary || '';
  const type = normalizeCommandType(command.command_type || 'PLAN');
  const assigned = ['REVIEW', 'DEVELOP'].includes(type) ? 'CLAUDE' : 'GPT';
  const newCommandId = makeId('CMD-REVISION');

  appendCommand(ss, {
    command_id: newCommandId,
    created_at: new Date(),
    project_id: command.project_id,
    command_type: type,
    request:
      `기존 결과를 사용자 수정 요청에 따라 다시 작성하라.\n\n` +
      `[원 요청]\n${command.request}\n\n[기존 결과]\n${fullResult}\n\n[사용자 수정 요청]\n${note || '사용자 요청에 맞게 개선하라.'}`,
    priority: command.priority || '높음',
    status: '실행 대기',
    assigned_model: assigned,
    approval_required: true,
    result_summary: '',
    result_ref: '',
    processed_at: '',
    error: '',
    approval_decision: '',
    approval_note: '',
    approval_processed_at: ''
  });

  return newCommandId;
}

function appendCommand(ss, record) {
  const sheet = ss.getSheetByName('COMMANDS');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(h => record[canonicalHeader(String(h).trim())] ?? ''));
}

function getAiLogResult(runId) {
  if (!runId) return '';
  const row = findOne('AI_LOG', r => String(r.run_id) === String(runId));
  return row ? String(row.result_summary || '') : '';
}

function normalizeApproval(value) {
  const v = String(value || '').trim().toUpperCase();
  if (['APPROVE', 'APPROVED', '승인'].includes(v)) return 'APPROVE';
  if (['REVISE', 'REVISION', '수정'].includes(v)) return 'REVISE';
  if (['REJECT', 'REJECTED', '폐기', '거절'].includes(v)) return 'REJECT';
  return '';
}

function processNextCommand() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('COMMANDS');
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    const headers = data[0];
    const idx = indexMap(headers);
    const ready = data.slice(1)
      .map((row, i) => ({ row, sheetRow: i + 2 }))
      .filter(x => normalizeStatus(x.row[idx.status]) === 'READY')
      .sort((a, b) => priorityRank(b.row[idx.priority]) - priorityRank(a.row[idx.priority]));

    if (!ready.length) return;

    const item = ready[0];
    const command = rowToObject(headers, item.row);
    executeCommandRow_(sheet, headers, idx, item.sheetRow, command);
  } finally {
    lock.releaseLock();
  }
}

// processNextCommand()에서 그대로 옮겨온 "행 하나 실행" 로직. 동작은 이전과 완전히 동일하며,
// 시트 전체에서 우선순위가 가장 높은 실행 대기 행을 고르는 책임은 processNextCommand()에 남기고,
// 이 함수는 이미 정해진 특정 행만 실행한다. processCommandById_()가 이 함수를 그대로 재사용해
// "지금 막 생성된 이 작업만" 실행하도록 한다 (다른 프로젝트의 실행 대기 작업을 잘못 실행하지 않기 위함).
// 개발(DEVELOP) 타입 실행 시 Claude에게 요구하는 개발명세 항목. 실제 제품 코드는 생성하지 않는다.
const DEV_SPEC_INSTRUCTIONS_ = `

이 결과물은 "개발명세"다. 실제 제품 코드는 작성하지 말고, 아래 항목을 모두 포함한 개발명세 문서만 작성하라.
개발명세는 사용자 승인을 받는 마지막 단계이며, 승인 이후에도 이 시스템은 실제 코딩을 자동으로 시작하지 않는다.

## 확정 MVP와 제외 범위
## 사용자 역할
## 사용자 흐름
## 화면별 요구사항
## 상태 정의
## 데이터 모델
## 개인정보 최소화 설계
## 서버 함수/API 명세
## 파일 구조
## 구현 순서
## 테스트 시나리오
## 완료 기준
## 보안·정책 체크
## 예상 개발 단계
## 실제 코딩 전 사용자 확인사항

각 항목을 위 순서의 소제목(##)으로 나누어 작성하라.`;

// AI 협의 5단계의 마지막 단계(GPT 최종 통합보고서)에 요구하는 구조.
const FINAL_REPORT_INSTRUCTIONS_ = `

이것은 5단계 AI 협의의 마지막 단계(GPT 최종 통합보고서)다.
지금까지의 기획과 Claude의 반론·최종 게이트 판정을 종합해 아래 16개 항목을 각각 소제목(##)으로 나누어 작성하라.
사용자는 이 보고서만 보고 승인·수정·폐기를 결정하므로 중간 협의 과정을 반복 설명하지 말고 결론 위주로 작성하라.

## 한 줄 결론
## 최종 판정
## 해결할 문제
## 목표 고객
## 확정 MVP
## 제외 기능
## 수익 가능성
## 가장 위험한 가설
## 검증 실험
## 성공 기준
## 중단 기준
## 예상 비용과 기간
## 개발 전 필수 확인사항
## AI 간 주요 이견
## 다음 단계
## 사용자 승인 요청`;

function executeCommandRow_(sheet, headers, idx, sheetRow, command) {
  updateCommand(sheet, sheetRow, idx, { status: '처리 중', error: '' });

  let result = '';
  let modelsCalled = '';
  const started = new Date();
  const runId = makeId('RUN');

  try {
    const projectId = command.project_id || getConfig('DEFAULT_PROJECT_ID') || 'PRJ-001';
    const context = buildContext(projectId);
    const type = normalizeCommandType(command.command_type);

    if (type === 'PLAN') {
      modelsCalled = 'GPT';
      result = callOpenAI(context.gpt, command.request);
    } else if (type === 'REVIEW') {
      modelsCalled = 'CLAUDE';
      result = callClaude(context.claude, command.request);
    } else if (type === 'DEVELOP') {
      modelsCalled = 'CLAUDE';
      result = callClaude(context.claude + DEV_SPEC_INSTRUCTIONS_, command.request);
    } else if (type === 'DECISION') {
      modelsCalled = 'GPT→CLAUDE→GPT';
      const first = callOpenAI(context.gpt, command.request);
      const review = callClaude(context.claude, `다음 GPT 초기안을 비판적으로 검토하라.\n\n[요청]\n${command.request}\n\n[GPT 초기안]\n${first}`);
      result = callOpenAI(context.gpt, `최종 의사결정안을 작성하라.\n\n[원 요청]\n${command.request}\n\n[GPT 초기안]\n${first}\n\n[Claude 검토]\n${review}`);
    } else if (type === 'DISCUSSION') {
      // 5단계 AI 협의: GPT 1차 기획 → Claude 반론 → GPT 수정 기획 → Claude 최종 게이트 → GPT 최종 통합보고서.
      // 사용자에게는 마지막 통합보고서(result)만 승인 화면에 보이고, 1~4단계는 AI_LOG에만 남는다.
      modelsCalled = 'GPT→CLAUDE→GPT→CLAUDE→GPT';
      const topic = command.request;

      const step1 = callOpenAI(
        context.gpt + '\n\n이것은 5단계 AI 협의의 1단계(GPT 1차 기획)다. 사업 아이템, 목표 고객, 핵심 가치, 수익 가능성을 중심으로 초안을 작성하라.',
        topic
      );
      appendAiLog({
        run_id: `${runId}-S1`, timestamp: started, slack_user: '', command: 'AI 협의 1단계 · GPT 1차 기획',
        original_request: topic, models_called: 'GPT', result_summary: step1, token_or_cost: '',
        execution_status: 'SUCCESS', error: '', context_version: CONTEXT_VERSION
      });

      const step2 = callClaude(
        context.claude + '\n\n이것은 5단계 AI 협의의 2단계(Claude 반론)다. GPT 1차 기획의 기술·UX·정책·보안·수익 관점 허점과 위험을 비판적으로 지적하라.',
        `[주제]\n${topic}\n\n[GPT 1차 기획]\n${step1}`
      );
      appendAiLog({
        run_id: `${runId}-S2`, timestamp: started, slack_user: '', command: 'AI 협의 2단계 · Claude 반론',
        original_request: topic, models_called: 'CLAUDE', result_summary: step2, token_or_cost: '',
        execution_status: 'SUCCESS', error: '', context_version: CONTEXT_VERSION
      });

      const step3 = callOpenAI(
        context.gpt + '\n\n이것은 5단계 AI 협의의 3단계(GPT 수정 기획)다. Claude의 반론을 반영해 기획을 수정하라.',
        `[주제]\n${topic}\n\n[GPT 1차 기획]\n${step1}\n\n[Claude 반론]\n${step2}`
      );
      appendAiLog({
        run_id: `${runId}-S3`, timestamp: started, slack_user: '', command: 'AI 협의 3단계 · GPT 수정 기획',
        original_request: topic, models_called: 'GPT', result_summary: step3, token_or_cost: '',
        execution_status: 'SUCCESS', error: '', context_version: CONTEXT_VERSION
      });

      const step4 = callClaude(
        context.claude + '\n\n이것은 5단계 AI 협의의 4단계(Claude 최종 게이트)다. 수정 기획이 개발 착수 가능한 수준인지 진행/수정/중단 중 하나로 판정하고 근거를 제시하라.',
        `[주제]\n${topic}\n\n[GPT 수정 기획]\n${step3}`
      );
      appendAiLog({
        run_id: `${runId}-S4`, timestamp: started, slack_user: '', command: 'AI 협의 4단계 · Claude 최종 게이트',
        original_request: topic, models_called: 'CLAUDE', result_summary: step4, token_or_cost: '',
        execution_status: 'SUCCESS', error: '', context_version: CONTEXT_VERSION
      });

      result = callOpenAI(
        context.gpt + FINAL_REPORT_INSTRUCTIONS_,
        `[주제]\n${topic}\n\n[GPT 수정 기획]\n${step3}\n\n[Claude 최종 게이트 판정]\n${step4}`
      );
    } else if (type === 'STATUS') {
      modelsCalled = 'NONE';
      result = buildStatusReport(projectId);
    } else {
      throw new Error(`지원하지 않는 command_type: ${type}`);
    }

    appendAiLog({
      run_id: runId,
      timestamp: started,
      slack_user: '',
      command: command.command_type,
      original_request: command.request,
      models_called: modelsCalled,
      result_summary: result,
      token_or_cost: '',
      execution_status: 'SUCCESS',
      error: '',
      context_version: CONTEXT_VERSION
    });

    const needsApproval = truthy(command.approval_required);
    updateCommand(sheet, sheetRow, idx, {
      status: needsApproval ? '승인 대기' : '완료',
      result_summary: truncate(result, 45000),
      result_ref: runId,
      processed_at: new Date(),
      error: ''
    });
  } catch (err) {
    const message = err && err.stack ? err.stack : String(err);
    appendAiLog({
      run_id: makeId('RUN-ERROR'),
      timestamp: started,
      slack_user: '',
      command: command.command_type,
      original_request: command.request,
      models_called: modelsCalled,
      result_summary: '',
      token_or_cost: '',
      execution_status: 'FAILED',
      error: truncate(message, 45000),
      context_version: CONTEXT_VERSION
    });
    updateCommand(sheet, sheetRow, idx, {
      status: '오류',
      processed_at: new Date(),
      error: truncate(message, 45000)
    });
    throw err;
  }
}

function buildContext(projectId) {
  const project = findOne('PROJECTS', r => String(r.project_id) === String(projectId)) || {};
  const rules = readTable('RULES')
    .filter(r => truthy(r.active))
    .filter(r => ['ALL', String(projectId)].includes(String(r.project_id || 'ALL')))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

  const decisions = readTable('DECISIONS')
    .filter(r => String(r.project_id) === String(projectId))
    .map(r => r.final_decision || r.issue).filter(Boolean).slice(-10);

  const hypotheses = readTable('HYPOTHESES')
    .filter(r => String(r.project_id) === String(projectId))
    .filter(r => ['대기', '실행', '진행'].includes(String(r.status)))
    .map(r => r.hypothesis).filter(Boolean).slice(0, 10);

  const gptRole = findOne('ROLE_PROMPTS', r => r.role_id === 'ROLE-GPT') || {};
  const claudeRole = findOne('ROLE_PROMPTS', r => r.role_id === 'ROLE-CLAUDE') || {};

  const base = `[공통 원칙]
${rules.map((r, i) => `${i + 1}. ${r.rule_text}`).join('\n')}

[프로젝트]
- ID: ${project.project_id || ''}
- 이름: ${project.project_name || ''}
- 목표: ${project.objective || ''}
- 대상: ${project.target_user || ''}
- 수익 목표: ${project.revenue_goal || ''}
- 단계: ${project.current_stage || ''}

[확정 결정]
${decisions.length ? decisions.map((d, i) => `${i + 1}. ${d}`).join('\n') : '- 없음'}

[미검증 가설]
${hypotheses.length ? hypotheses.map((h, i) => `${i + 1}. ${h}`).join('\n') : '- 없음'}`;

  return {
    gpt: `${base}

[GPT 역할]
- 역할: ${gptRole.model_role || '총괄 기획자'}
- 책임: ${gptRole.responsibility || ''}
- 반드시 할 일: ${gptRole.must_do || ''}
- 금지: ${gptRole.must_not_do || ''}
- 출력 형식: ${gptRole.output_format || ''}

전략·사업·제품 관점에서 판단하고, 최종 결정은 사용자에게 요청하라.`,
    claude: `${base}

[Claude 역할]
- 역할: ${claudeRole.model_role || '검증자 및 개발 책임자'}
- 책임: ${claudeRole.responsibility || ''}
- 반드시 할 일: ${claudeRole.must_do || ''}
- 금지: ${claudeRole.must_not_do || ''}
- 출력 형식: ${claudeRole.output_format || ''}

기술 타당성, UX 이탈, 보안, 정책, 구현 난이도와 테스트 기준을 중심으로 검토하라.`
  };
}

function callOpenAI(instructions, input) {
  const key = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  const model = getConfig('OPENAI_MODEL') || 'gpt-5-mini';
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${key}` },
    payload: JSON.stringify({ model, instructions, input, max_output_tokens: 1800, store: false }),
    muteHttpExceptions: true
  });
  const body = JSON.parse(response.getContentText() || '{}');
  if (response.getResponseCode() >= 300) {
    throw new Error(`OpenAI API ${response.getResponseCode()}: ${body.error?.message || response.getContentText()}`);
  }
  if (body.output_text) return body.output_text;
  return (body.output || []).flatMap(x => x.content || [])
    .map(x => x.text || x.output_text || '').filter(Boolean).join('\n');
}

function callClaude(system, input) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');

  const primaryModel = getConfig('CLAUDE_MODEL') || 'claude-sonnet-5';
  const fallbackModel = getConfig('CLAUDE_FALLBACK_MODEL') || 'claude-sonnet-4-6';

  const primary = requestClaude(primaryModel, system, input, 5000, key);
  if (primary.text) return primary.text;

  // Claude 5가 thinking 블록만 반환하거나 출력 한도에 도달한 경우 자동 폴백
  if (primaryModel !== fallbackModel) {
    const fallbackSystem =
      system +
      '\n\n중요: 내부 추론 과정은 출력하지 말고, 사용자가 읽을 수 있는 최종 검토 결과만 명확한 한국어로 작성하라.';
    const fallback = requestClaude(fallbackModel, fallbackSystem, input, 5000, key);
    if (fallback.text) return fallback.text;

    throw new Error(
      'Claude 기본 모델과 폴백 모델 모두 최종 텍스트를 반환하지 못했습니다. ' +
      `기본 모델=${primaryModel}, 기본 중지사유=${primary.stopReason || '없음'}, ` +
      `폴백 모델=${fallbackModel}, 폴백 중지사유=${fallback.stopReason || '없음'}`
    );
  }

  throw new Error(
    'Claude API 호출은 성공했지만 최종 텍스트가 없습니다. ' +
    `모델=${primaryModel}, 중지사유=${primary.stopReason || '없음'}`
  );
}

function requestClaude(model, system, input, maxTokens, key) {
  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{
        role: 'user',
        content:
          input +
          '\n\n최종 결과는 반드시 일반 텍스트로 작성하라. 내부 사고 과정이나 thinking 블록만 출력하지 마라.'
      }]
    }),
    muteHttpExceptions: true
  });

  const raw = response.getContentText() || '{}';
  let body;

  try {
    body = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Anthropic API 응답 JSON 해석 실패: ${raw.slice(0, 3000)}`);
  }

  if (response.getResponseCode() >= 300) {
    throw new Error(
      `Anthropic API ${response.getResponseCode()} (${model}): ` +
      `${body.error?.message || raw}`
    );
  }

  const blocks = Array.isArray(body.content) ? body.content : [];
  const text = blocks
    .filter(block => block && block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  return {
    text,
    stopReason: body.stop_reason || '',
    model: body.model || model,
    hasThinking: blocks.some(block => block && block.type === 'thinking')
  };
}

function buildStatusReport(projectId) {
  const project = findOne('PROJECTS', r => String(r.project_id) === String(projectId)) || {};
  const hypotheses = readTable('HYPOTHESES').filter(r => String(r.project_id) === String(projectId));
  const backlog = readTable('BACKLOG').filter(r => String(r.project_id) === String(projectId));
  const decisions = readTable('DECISIONS').filter(r => String(r.project_id) === String(projectId));
  return [
    `프로젝트: ${project.project_name || projectId}`,
    `현재 단계: ${project.current_stage || ''}`,
    `상태: ${project.status || ''}`,
    `열린 가설: ${hypotheses.filter(r => !['완료', '폐기'].includes(String(r.status))).length}개`,
    `진행 작업: ${backlog.filter(r => ['대기', '진행'].includes(String(r.status))).length}개`,
    `확정 결정: ${decisions.filter(r => r.final_decision).length}개`
  ].join('\n');
}

function appendAiLog(record) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('AI_LOG');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(h => record[canonicalHeader(String(h).trim())] ?? ''));
}

function readTable(sheetName) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetName);
  if (!sheet) throw new Error(`시트를 찾을 수 없습니다: ${sheetName}`);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row => rowToObject(headers, row));
}

function findOne(sheetName, predicate) { return readTable(sheetName).find(predicate); }
function getConfig(key) {
  const row = findOne('CONFIG', r => r.config_key === key && truthy(r.active));
  return row ? String(row.config_value) : '';
}
function updateCommand(sheet, rowNumber, idx, patch) {
  Object.entries(patch).forEach(([key, value]) => {
    if (idx[key] !== undefined) sheet.getRange(rowNumber, idx[key] + 1).setValue(value);
  });
}
function rowToObject(headers, row) {
  return headers.reduce((obj, h, i) => {
    obj[canonicalHeader(String(h).trim())] = row[i];
    return obj;
  }, {});
}
function indexMap(headers) {
  return headers.reduce((obj, h, i) => {
    obj[canonicalHeader(String(h).trim())] = i;
    return obj;
  }, {});
}
function truthy(value) { return ['TRUE', '1', 'YES', 'Y', '예'].includes(String(value).trim().toUpperCase()); }
function priorityRank(value) {
  return ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, '높음': 3, '보통': 2, '낮음': 1 })[String(value).trim()] || ({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 })[String(value).toUpperCase()] || 0;
}
function makeId(prefix) {
  return `${prefix}-${Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd-HHmmss')}-${Math.floor(Math.random() * 1000)}`;
}
function truncate(value, max) {
  const text = String(value || '');
  return text.length <= max ? text : text.slice(0, max) + '\n...[truncated]';
}

// ============================================================
// 웹앱 전용 함수 (이 아래부터 신규 추가)
//
// 위쪽 자동화 섹션에서 아래 6곳만 "주제만 입력 → AI 협의 → 최종보고서/개발명세만 승인" 요구사항을
// 위해 최소한으로 손을 댔고, 그 외 기존 함수는 그대로다:
//   1) normalizeCommandType() / displayCommandType() — 'AI 협의'(DISCUSSION) 매핑을 추가했다.
//                                 기존 기획/검토/개발/최종판단/상태조회 매핑은 그대로 남아 있어
//                                 예전 방식으로 만들어진 행도 계속 정상 동작한다.
//   2) configureKoreanUI()     — 작업유형 드롭다운 목록에 'AI 협의'를 추가했다 (기존 항목은 유지).
//   3) executeCommandRow_()    — DISCUSSION 타입 처리 분기(5단계 AI 협의: GPT→Claude→GPT→Claude→GPT)를
//                                 추가했고, DEVELOP 타입의 지시문을 개발명세 15개 항목 구조로 확장했다.
//                                 기존 PLAN/REVIEW/DECISION/STATUS 분기는 그대로다.
//   4) processApprovals()      — 각 행 처리 결과(어떤 후속 작업이 생성됐는지) 배열을 반환한다.
//                                 기존 호출부(메뉴 3번, processAutomationCycle())는 반환값을 쓰지
//                                 않으므로 동작 그대로다.
//   5) handleApprovedCommand() — 기획→검토→최종판단→개발 체인에 DISCUSSION→개발(개발명세) 체인을
//                                 추가했다. DEVELOP은 다음 단계가 없어 개발명세 승인에서 체인이 멈춘다.
//   6) createRevisionCommand() / webRetryCommand() — 새로 생성한 작업의 command_id를 반환하고,
//                                 processNextCommand() 대신 processCommandById_()를 호출하도록
//                                 바꿔 "그 작업 자신만" 실행되도록 했다 (원래는 시트에 우선순위가
//                                 더 높은 다른 실행 대기 작업이 있으면 그 작업이 대신 실행되는 버그가 있었다).
//
// 그 외 아래 함수들은 모두 위 함수(processApprovals, executeCommandRow_,
// appendCommand, updateCommand, readTable, findOne, getConfig,
// normalizeStatus, displayStatus 등)를 재사용만 한다.
//
// CLAUDE.md 9번 항목이 요구하는 함수명과 실제 이름이 다른 한 가지: processCommandById_ (밑줄 포함).
// processCommandById()와 완전히 같은 역할이라 별도 함수로 중복 작성하지 않고 이름만 GAS의 "비공개
// 헬퍼" 관례(끝에 밑줄)를 따랐다 — 밑줄이 있어도 다른 서버 함수에서 호출하는 데는 아무 제약이 없다.
// ============================================================

/**
 * 웹앱 진입점. Index.html을 렌더링해 반환한다.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('AI 사업 운영')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Index.html에서 Styles.html / Scripts.html을 삽입하기 위한 include 함수.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * commandId로 COMMANDS 시트의 행을 서버에서 직접 재조회한다.
 * 클라이언트가 보낸 행 번호는 신뢰하지 않는다.
 */
function findCommandRow_(commandId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('COMMANDS');
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = values[0];
  const idx = indexMap(headers);
  if (idx.command_id === undefined) return null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx.command_id] || '').trim() === String(commandId || '').trim()) {
      return { sheet, headers, idx, rowNumber: i + 1, row: values[i] };
    }
  }
  return null;
}

function toTime_(value) {
  return value instanceof Date ? value.getTime() : 0;
}

function formatDateTime_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
  }
  return String(value);
}

/**
 * COMMANDS 행(canonical 객체)을 클라이언트로 보낼 안전한 객체로 변환한다.
 * includeFull이 false(기본)면 카드 목록용 미리보기만, true면 상세 화면용 전문을 포함한다.
 */
function toWebCommand(c, includeFull) {
  const base = {
    commandId: c.command_id || '',
    commandType: displayCommandType(c.command_type),
    assignedModel: displayModel(c.assigned_model),
    status: displayStatus(c.status),
    priority: displayPriority(c.priority),
    createdAt: formatDateTime_(c.created_at)
  };

  if (!includeFull) {
    base.requestPreview = truncate(c.request, 160);
    base.resultPreview = truncate(c.result_summary, 220);
    return base;
  }

  base.request = String(c.request || '');
  base.result = String(c.result_summary || '');
  base.error = String(c.error || '');
  base.processedAt = formatDateTime_(c.processed_at);
  base.approvalNote = String(c.approval_note || '');
  base.resultRef = String(c.result_ref || '');
  return base;
}

/**
 * 홈 화면: 상단 요약 카운트 + 지금 확인할 작업(승인 대기) 목록.
 */
function webGetDashboard() {
  try {
    const rows = readTable('COMMANDS');
    const summary = { awaitingApproval: 0, ready: 0, processing: 0, error: 0 };

    rows.forEach(r => {
      const s = normalizeStatus(r.status);
      if (s === 'AWAITING_APPROVAL') summary.awaitingApproval++;
      else if (s === 'READY') summary.ready++;
      else if (s === 'PROCESSING') summary.processing++;
      else if (s === 'ERROR') summary.error++;
    });

    const pendingApprovals = rows
      .filter(r => normalizeStatus(r.status) === 'AWAITING_APPROVAL')
      .sort((a, b) => toTime_(b.created_at) - toTime_(a.created_at))
      .slice(0, 10)
      .map(r => toWebCommand(r, false));

    return { success: true, data: { summary, pendingApprovals } };
  } catch (err) {
    return { success: false, message: '데이터를 불러오지 못했습니다.' };
  }
}

/**
 * 작업 상세 조회. commandId 기준으로 서버에서 재조회한다.
 */
function webGetCommand(commandId) {
  try {
    const found = findCommandRow_(commandId);
    if (!found) return { success: false, message: '작업을 찾을 수 없습니다.' };
    const obj = rowToObject(found.headers, found.row);
    return { success: true, data: toWebCommand(obj, true) };
  } catch (err) {
    return { success: false, message: '작업 정보를 불러오지 못했습니다.' };
  }
}

/**
 * 'AI 협의' 작업의 5단계 내부 협의 기록(1~4단계 + 최종보고서)을 순서대로 반환한다.
 * result_ref에 저장된 세션 접두사(run_id 앞부분)로 AI_LOG를 찾는다.
 */
function getDiscussionLog(commandId) {
  try {
    const found = findCommandRow_(commandId);
    if (!found) return { success: false, message: '작업을 찾을 수 없습니다.' };

    const command = rowToObject(found.headers, found.row);
    const sessionId = String(command.result_ref || '').trim();
    if (!sessionId) return { success: true, data: [] };

    const stepOrder = {};
    stepOrder[sessionId] = 5;
    stepOrder[`${sessionId}-S1`] = 1;
    stepOrder[`${sessionId}-S2`] = 2;
    stepOrder[`${sessionId}-S3`] = 3;
    stepOrder[`${sessionId}-S4`] = 4;

    const logs = readTable('AI_LOG')
      .filter(r => Object.prototype.hasOwnProperty.call(stepOrder, String(r.run_id || '')))
      .sort((a, b) => stepOrder[String(a.run_id)] - stepOrder[String(b.run_id)]);

    return {
      success: true,
      data: logs.map(r => ({ label: String(r.command || ''), text: String(r.result_summary || '') }))
    };
  } catch (err) {
    return { success: false, message: '협의 기록을 불러오지 못했습니다.' };
  }
}

/**
 * commandId로 지정된 딱 한 행만 지금 바로 실행한다. processNextCommand()처럼
 * 시트 전체에서 우선순위가 가장 높은 실행 대기 작업을 고르지 않는다 — 그렇게 하면
 * 다른 프로젝트의 실행 대기 작업이 먼저 실행되어 버릴 수 있기 때문이다.
 * 승인 체인(아래 webApproveAndContinue)이 "방금 새로 생성된 그 작업만" 실행하기 위한 함수.
 */
function processCommandById_(commandId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('다른 처리가 진행 중입니다. 잠시 후 다시 시도해주세요.');
  }
  try {
    const found = findCommandRow_(commandId);
    if (!found) throw new Error('실행할 작업을 찾을 수 없습니다.');

    const currentStatus = normalizeStatus(found.row[found.idx.status]);
    if (currentStatus !== 'READY') {
      throw new Error('실행 대기 상태의 작업만 즉시 실행할 수 있습니다.');
    }

    const command = rowToObject(found.headers, found.row);
    executeCommandRow_(found.sheet, found.headers, found.idx, found.rowNumber, command);
  } finally {
    lock.releaseLock();
  }
}

/**
 * 승인 / 수정 요청 / 폐기 처리.
 * 셀 값만 바꾸고 끝내지 않고, 기존 processApprovals()를 그대로 호출해
 * 승인·수정 시 다음 작업(검토 → 최종판단 → 개발 등)이 자동 생성되도록 하고,
 * 그렇게 새로 생성된 작업이 있으면 그 작업만 곧바로 실행한 뒤 결과까지 함께 반환한다.
 *   승인 클릭 → 승인선택 저장 → processApprovals() → (생성됐다면) 그 작업만 즉시 실행 → 최신 상태 반환
 * 폐기는 다음 작업을 만들지 않으므로 이 체인이 발생하지 않는다.
 */
function webApproveAndContinue(commandId, decisionKey, note) {
  try {
    const decisionMap = { approve: '승인', revise: '수정', reject: '폐기' };
    const normalizedKey = String(decisionKey || '').trim().toLowerCase();
    const decisionText = decisionMap[normalizedKey];
    if (!decisionText) {
      return { success: false, message: '올바르지 않은 처리 유형입니다.' };
    }
    if (decisionText === '수정' && !String(note || '').trim()) {
      return { success: false, message: '수정 의견을 입력해주세요.' };
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      return { success: false, message: '다른 처리가 진행 중입니다. 잠시 후 다시 시도해주세요.' };
    }

    try {
      const found = findCommandRow_(commandId);
      if (!found) return { success: false, message: '작업을 찾을 수 없습니다.' };

      const currentStatus = normalizeStatus(found.row[found.idx.status]);
      if (currentStatus !== 'AWAITING_APPROVAL') {
        return { success: false, message: '이미 처리되었거나 승인 대기 상태가 아닙니다.' };
      }

      const existingDecision = String(found.row[found.idx.approval_decision] || '').trim();
      if (existingDecision) {
        return { success: false, message: '이미 처리 요청이 접수된 작업입니다.' };
      }

      updateCommand(found.sheet, found.rowNumber, found.idx, {
        approval_decision: decisionText,
        approval_note: decisionText === '수정' ? String(note || '').trim() : ''
      });
    } finally {
      lock.releaseLock();
    }

    // 기존 승인 처리 로직을 그대로 재사용 (승인/수정 시 후속 작업 자동 생성 포함).
    // 반환값에서 방금 우리가 처리한 행의 결과만 찾아 후속 작업 ID를 얻는다.
    const results = processApprovals();
    const myResult = (results || []).find(r => String(r.commandId) === String(commandId));
    const nextCommandId = myResult ? myResult.nextCommandId : null;

    if (nextCommandId) {
      try {
        // commandId를 지정해 "그 작업만" 실행한다 (processNextCommand()는 쓰지 않는다).
        processCommandById_(nextCommandId);
      } catch (execErr) {
        // 실행 실패는 executeCommandRow_ 내부에서 이미 해당 행에 '오류' 상태로 기록되었으므로
        // 여기서는 무시하고 최신 상태를 그대로 클라이언트에 반환한다.
      }
    }

    const messages = {
      approve: nextCommandId ? '승인 처리 후 다음 작업을 실행했습니다.' : '승인 처리가 완료되었습니다.',
      revise: nextCommandId ? '수정 요청을 등록하고 다시 실행했습니다.' : '수정 요청이 등록되었습니다.',
      reject: '작업이 폐기되었습니다.'
    };

    const currentResult = webGetCommand(commandId);
    const nextResult = nextCommandId ? webGetCommand(nextCommandId) : null;

    return {
      success: true,
      message: messages[normalizedKey] || '처리되었습니다.',
      currentCommand: currentResult.success ? currentResult.data : null,
      nextCommand: nextResult && nextResult.success ? nextResult.data : null
    };
  } catch (err) {
    return { success: false, message: '승인 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * 새 AI 협의 시작. 주제만 입력받아 'AI 협의' 작업을 등록하고, 그 자리에서 바로
 * 5단계 협의(executeCommandRow_의 DISCUSSION 분기)를 실행한 뒤 최종보고서를 반환한다.
 * 이 호출 하나가 GPT/Claude를 5번 순서대로 호출하므로 응답까지 시간이 걸릴 수 있다.
 */
function webStartDiscussion(payload) {
  try {
    payload = payload || {};
    const topic = String(payload.topic || '').trim();
    const priorityLabel = String(payload.priority || '보통').trim();
    const validPriorities = ['높음', '보통', '낮음'];

    if (!topic) {
      return { success: false, message: '주제를 입력해주세요.' };
    }
    if (validPriorities.indexOf(priorityLabel) === -1) {
      return { success: false, message: '우선순위를 선택해주세요.' };
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const projectId = String(payload.projectId || '').trim() || getConfig('DEFAULT_PROJECT_ID') || 'PRJ-001';
    const commandId = makeId('CMD-DISCUSSION');

    appendCommand(ss, {
      command_id: commandId,
      created_at: new Date(),
      project_id: projectId,
      command_type: 'AI 협의',
      request: topic,
      priority: priorityLabel,
      status: '실행 대기',
      assigned_model: 'GPT',
      approval_required: '예',
      result_summary: '',
      result_ref: '',
      processed_at: '',
      error: '',
      approval_decision: '',
      approval_note: '',
      approval_processed_at: ''
    });

    try {
      // 등록 직후 바로 5단계 협의를 실행한다 (다른 실행 대기 작업과 무관하게 이 작업만).
      processCommandById_(commandId);
    } catch (execErr) {
      // 실패해도 오류 내용은 executeCommandRow_ 내부에서 이미 기록되어 있으므로
      // 아래에서 webGetCommand()로 최신 상태(오류 상태 포함)를 그대로 반환한다.
    }

    return webGetCommand(commandId);
  } catch (err) {
    return { success: false, message: 'AI 협의 시작 중 오류가 발생했습니다.' };
  }
}

/**
 * "지금 실행" 버튼용. commandId로 지정한 그 작업만 실행한다 (processCommandById_ 재사용).
 * 다른 실행 대기 작업이 시트에 더 있어도 그 작업들은 건드리지 않는다.
 */
function runCommandNow(commandId) {
  try {
    processCommandById_(commandId);
    return webGetCommand(commandId);
  } catch (err) {
    const found = findCommandRow_(commandId);
    const status = found ? normalizeStatus(found.row[found.idx.status]) : '';
    if (status === 'ERROR') {
      // 실행은 시도됐고 실패 내용은 이미 해당 행에 기록되어 있으므로 최신 상태를 그대로 반환한다.
      return webGetCommand(commandId);
    }
    return { success: false, message: err.message || '작업 실행 중 오류가 발생했습니다.' };
  }
}

/**
 * 작업 기록 조회 (필터 + 검색).
 */
function webGetHistory(filter) {
  try {
    filter = filter || {};
    const statusFilter = filter.status ? normalizeStatus(filter.status) : '';
    const typeFilter = filter.type ? normalizeCommandType(filter.type) : '';
    const modelFilter = String(filter.model || '').trim().toUpperCase();
    const search = String(filter.search || '').trim().toLowerCase();

    let rows = readTable('COMMANDS');

    if (statusFilter) rows = rows.filter(r => normalizeStatus(r.status) === statusFilter);
    if (typeFilter) rows = rows.filter(r => normalizeCommandType(r.command_type) === typeFilter);
    if (modelFilter === 'GPT' || modelFilter === '클로드' || modelFilter === 'CLAUDE') {
      rows = rows.filter(r => {
        const m = String(r.assigned_model || '').trim().toUpperCase();
        if (modelFilter === 'GPT') return m === 'GPT';
        return m === 'CLAUDE' || r.assigned_model === '클로드';
      });
    }
    if (search) {
      rows = rows.filter(r =>
        String(r.command_id || '').toLowerCase().includes(search) ||
        String(r.request || '').toLowerCase().includes(search) ||
        String(r.result_summary || '').toLowerCase().includes(search)
      );
    }

    rows.sort((a, b) => toTime_(b.created_at) - toTime_(a.created_at));

    return { success: true, data: rows.slice(0, 200).map(r => toWebCommand(r, false)) };
  } catch (err) {
    return { success: false, message: '작업 기록을 불러오지 못했습니다.' };
  }
}

/**
 * 오류 작업 재실행. 상태를 실행 대기로 되돌린 뒤 그 작업만 processCommandById_()로 실행한다.
 */
function webRetryCommand(commandId) {
  try {
    const found = findCommandRow_(commandId);
    if (!found) return { success: false, message: '작업을 찾을 수 없습니다.' };

    const currentStatus = normalizeStatus(found.row[found.idx.status]);
    if (currentStatus !== 'ERROR') {
      return { success: false, message: '오류 상태의 작업만 다시 실행할 수 있습니다.' };
    }

    updateCommand(found.sheet, found.rowNumber, found.idx, {
      status: '실행 대기',
      result_summary: '',
      result_ref: '',
      processed_at: '',
      error: '',
      approval_decision: '',
      approval_note: '',
      approval_processed_at: ''
    });

    try {
      // 방금 실행 대기로 되돌린 이 작업만 실행한다 (processNextCommand()는 다른 실행 대기
      // 작업의 우선순위가 더 높으면 그 작업을 대신 실행해버릴 수 있어 여기서는 쓰지 않는다).
      processCommandById_(commandId);
    } catch (e) {
      // 실패해도 오류 내용은 executeCommandRow_ 내부에서 이미 시트에 기록됨
    }

    return webGetCommand(commandId);
  } catch (err) {
    return { success: false, message: '재실행 중 오류가 발생했습니다.' };
  }
}

/**
 * 설정 화면 상단의 "현재 프로젝트" 정보.
 */
function getProjectStatus() {
  try {
    const projectId = getConfig('DEFAULT_PROJECT_ID') || 'PRJ-001';
    const project = findOne('PROJECTS', r => String(r.project_id) === String(projectId)) || {};
    return {
      success: true,
      data: {
        projectId: project.project_id || '',
        projectName: project.project_name || '',
        currentStage: project.current_stage || '',
        status: project.status || ''
      }
    };
  } catch (err) {
    return { success: false, message: '프로젝트 정보를 불러오지 못했습니다.' };
  }
}

/**
 * 설정 화면. API 키 값은 절대 반환하지 않고 설정 여부만 반환한다.
 */
function getAppConfigForClient() {
  try {
    const props = PropertiesService.getScriptProperties();
    const triggers = ScriptApp.getProjectTriggers();
    const autoEnabled = triggers.some(t => t.getHandlerFunction() === 'processAutomationCycle');

    const logs = readTable('AI_LOG');
    const successLogs = logs.filter(r => String(r.execution_status) === 'SUCCESS' && r.timestamp);
    const errorLogs = logs.filter(r => String(r.execution_status) === 'FAILED' && r.timestamp);
    const lastSuccess = successLogs.length
      ? successLogs.reduce((a, b) => (toTime_(a.timestamp) > toTime_(b.timestamp) ? a : b))
      : null;
    const lastError = errorLogs.length
      ? errorLogs.reduce((a, b) => (toTime_(a.timestamp) > toTime_(b.timestamp) ? a : b))
      : null;

    return {
      success: true,
      data: {
        openaiModel: getConfig('OPENAI_MODEL') || 'gpt-5-mini',
        claudeModel: getConfig('CLAUDE_MODEL') || 'claude-sonnet-5',
        claudeFallbackModel: getConfig('CLAUDE_FALLBACK_MODEL') || 'claude-sonnet-4-6',
        autoRunEnabled: autoEnabled,
        autoRunInterval: autoEnabled ? '5분' : '설정 안 됨',
        lastSuccessAt: lastSuccess ? formatDateTime_(lastSuccess.timestamp) : '',
        lastErrorAt: lastError ? formatDateTime_(lastError.timestamp) : '',
        openaiKeyConfigured: !!props.getProperty('OPENAI_API_KEY'),
        anthropicKeyConfigured: !!props.getProperty('ANTHROPIC_API_KEY')
      }
    };
  } catch (err) {
    return { success: false, message: '설정 정보를 불러오지 못했습니다.' };
  }
}
