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
    .requireValueInList(['기획', '검토', '개발', '최종판단', '상태조회'], true)
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
    '상태조회': 'STATUS', 'STATUS': 'STATUS'
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
  return ({PLAN:'기획', REVIEW:'검토', DEVELOP:'개발', DECISION:'최종판단', STATUS:'상태조회'})[normalizeCommandType(value)] || value;
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
  if (!lock.tryLock(5000)) return;

  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('COMMANDS');
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return;

    const headers = values[0];
    const idx = indexMap(headers);

    if (idx.approval_decision === undefined) {
      throw new Error('COMMANDS 시트에 approval_decision 열이 없습니다.');
    }

    const targets = values.slice(1)
      .map((row, i) => ({ row, sheetRow: i + 2, command: rowToObject(headers, row) }))
      .filter(x => normalizeStatus(x.command.status) === 'AWAITING_APPROVAL')
      .filter(x => String(x.command.approval_decision || '').trim() !== '');

    for (const item of targets) {
      const command = item.command;
      const decision = normalizeApproval(command.approval_decision);
      const note = String(command.approval_note || '').trim();

      if (!decision) {
        updateCommand(sheet, item.sheetRow, idx, {
          error: 'approval_decision은 APPROVE, REVISE, REJECT 중 하나여야 합니다.'
        });
        continue;
      }

      if (decision === 'APPROVE') {
        handleApprovedCommand(ss, command);
        updateCommand(sheet, item.sheetRow, idx, {
          status: '승인 완료',
          approval_processed_at: new Date(),
          error: ''
        });
      } else if (decision === 'REVISE') {
        createRevisionCommand(ss, command, note);
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
    }
  } finally {
    lock.releaseLock();
  }
}

function handleApprovedCommand(ss, command) {
  const type = normalizeCommandType(command.command_type);
  const autoReview = truthy(getConfig('AUTO_CREATE_REVIEW_ON_APPROVAL'));

  if (type === 'PLAN' && autoReview) {
    const fullResult = getAiLogResult(command.result_ref) || command.result_summary || '';
    appendCommand(ss, {
      command_id: makeId('CMD-REVIEW'),
      created_at: new Date(),
      project_id: command.project_id,
      command_type: '검토',
      request:
        `다음 GPT 기획안을 기술·UX·정책·보안·수익 실행 가능성 관점에서 검토하라.\n\n` +
        `[원 요청]\n${command.request}\n\n[GPT 기획안]\n${fullResult}`,
      priority: command.priority || 'HIGH',
      status: '실행 대기',
      assigned_model: '클로드',
      approval_required: true,
      result_summary: '',
      result_ref: '',
      processed_at: '',
      error: '',
      approval_decision: '',
      approval_note: '',
      approval_processed_at: ''
    });
  }
}

function createRevisionCommand(ss, command, note) {
  const fullResult = getAiLogResult(command.result_ref) || command.result_summary || '';
  const type = normalizeCommandType(command.command_type || 'PLAN');
  const assigned = ['REVIEW', 'DEVELOP'].includes(type) ? 'CLAUDE' : 'GPT';

  appendCommand(ss, {
    command_id: makeId('CMD-REVISION'),
    created_at: new Date(),
    project_id: command.project_id,
    command_type: type,
    request:
      `기존 결과를 사용자 수정 요청에 따라 다시 작성하라.\n\n` +
      `[원 요청]\n${command.request}\n\n[기존 결과]\n${fullResult}\n\n[사용자 수정 요청]\n${note || '사용자 요청에 맞게 개선하라.'}`,
    priority: command.priority || 'HIGH',
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
    updateCommand(sheet, item.sheetRow, idx, { status: '처리 중', error: '' });

    let result = '';
    let modelsCalled = '';
    const started = new Date();

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
        result = callClaude(context.claude + '\n\n개발 명세, 파일 구조, 구현 순서, 테스트 기준을 포함하라.', command.request);
      } else if (type === 'DECISION') {
        modelsCalled = 'GPT→CLAUDE→GPT';
        const first = callOpenAI(context.gpt, command.request);
        const review = callClaude(context.claude, `다음 GPT 초기안을 비판적으로 검토하라.\n\n[요청]\n${command.request}\n\n[GPT 초기안]\n${first}`);
        result = callOpenAI(context.gpt, `최종 의사결정안을 작성하라.\n\n[원 요청]\n${command.request}\n\n[GPT 초기안]\n${first}\n\n[Claude 검토]\n${review}`);
      } else if (type === 'STATUS') {
        modelsCalled = 'NONE';
        result = buildStatusReport(projectId);
      } else {
        throw new Error(`지원하지 않는 command_type: ${type}`);
      }

      const runId = makeId('RUN');
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
      updateCommand(sheet, item.sheetRow, idx, {
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
      updateCommand(sheet, item.sheetRow, idx, {
        status: '오류',
        processed_at: new Date(),
        error: truncate(message, 45000)
      });
      throw err;
    }
  } finally {
    lock.releaseLock();
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
// 위쪽의 기존 자동화 함수는 한 줄도 수정하지 않았으며,
// 아래 함수들은 모두 위 함수(processApprovals, processNextCommand,
// appendCommand, updateCommand, readTable, findOne, getConfig,
// normalizeStatus, displayStatus 등)를 재사용만 한다.
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
 * 목록/카드용 요약 객체. 결과가 아무리 길어도 카드에는 미리보기만 보낸다.
 */
function commandToCard_(c) {
  return {
    commandId: c.command_id || '',
    commandType: displayCommandType(c.command_type),
    assignedModel: displayModel(c.assigned_model),
    status: displayStatus(c.status),
    priority: displayPriority(c.priority),
    requestPreview: truncate(c.request, 160),
    resultPreview: truncate(c.result_summary, 220),
    createdAt: formatDateTime_(c.created_at)
  };
}

/**
 * 상세 화면용 전체 객체. 결과 전문을 그대로 보낸다.
 */
function commandToDetail_(c) {
  return {
    commandId: c.command_id || '',
    commandType: displayCommandType(c.command_type),
    assignedModel: displayModel(c.assigned_model),
    status: displayStatus(c.status),
    priority: displayPriority(c.priority),
    request: String(c.request || ''),
    result: String(c.result_summary || ''),
    error: String(c.error || ''),
    createdAt: formatDateTime_(c.created_at),
    processedAt: formatDateTime_(c.processed_at),
    approvalNote: String(c.approval_note || '')
  };
}

/**
 * 홈 화면: 상단 요약 카운트 + 지금 확인할 작업(승인 대기) 목록.
 */
function getDashboardData() {
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
      .map(commandToCard_);

    return { success: true, data: { summary, pendingApprovals } };
  } catch (err) {
    return { success: false, message: '데이터를 불러오지 못했습니다.' };
  }
}

/**
 * 승인 대기 전체 목록 (홈에서 더보기, 또는 다른 화면에서 재사용).
 */
function getPendingApprovals() {
  try {
    const rows = readTable('COMMANDS');
    const pending = rows
      .filter(r => normalizeStatus(r.status) === 'AWAITING_APPROVAL')
      .sort((a, b) => toTime_(b.created_at) - toTime_(a.created_at))
      .map(commandToCard_);
    return { success: true, data: pending };
  } catch (err) {
    return { success: false, message: '승인 대기 목록을 불러오지 못했습니다.' };
  }
}

/**
 * 작업 상세 조회. commandId 기준으로 서버에서 재조회한다.
 */
function getCommandDetail(commandId) {
  try {
    const found = findCommandRow_(commandId);
    if (!found) return { success: false, message: '작업을 찾을 수 없습니다.' };
    const obj = rowToObject(found.headers, found.row);
    return { success: true, data: commandToDetail_(obj) };
  } catch (err) {
    return { success: false, message: '작업 정보를 불러오지 못했습니다.' };
  }
}

/**
 * 승인 / 수정 요청 / 폐기 처리.
 * 셀 값만 바꾸고 끝내지 않고, 기존 processApprovals()를 그대로 호출해
 * 승인 시 다음 작업(검토 등)이 자동 생성되도록 한다.
 */
function submitApproval(commandId, decisionKey, note) {
  try {
    const decisionMap = { approve: '승인', revise: '수정', reject: '폐기' };
    const decisionText = decisionMap[String(decisionKey || '').trim().toLowerCase()];
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

    // 기존 승인 처리 로직을 그대로 재사용 (승인 시 후속 검토 작업 자동 생성 포함)
    processApprovals();

    return getCommandDetail(commandId);
  } catch (err) {
    return { success: false, message: '승인 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * 새 작업 등록. COMMANDS에 실행 대기 상태로 행을 추가한다.
 */
function createNewCommand(payload) {
  try {
    payload = payload || {};
    const typeLabel = String(payload.commandType || '').trim();
    const request = String(payload.request || '').trim();
    const priorityLabel = String(payload.priority || '보통').trim();
    const approvalRequired = payload.approvalRequired !== false;

    const validTypes = ['기획', '검토', '개발', '최종판단', '상태조회'];
    const validPriorities = ['높음', '보통', '낮음'];

    if (validTypes.indexOf(typeLabel) === -1) {
      return { success: false, message: '작업유형을 선택해주세요.' };
    }
    if (!request) {
      return { success: false, message: '요청내용을 입력해주세요.' };
    }
    if (validPriorities.indexOf(priorityLabel) === -1) {
      return { success: false, message: '우선순위를 선택해주세요.' };
    }

    const modelMap = { '기획': 'GPT', '검토': '클로드', '개발': '클로드', '최종판단': 'GPT', '상태조회': '없음' };
    const assignedModel = modelMap[typeLabel];

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const projectId = getConfig('DEFAULT_PROJECT_ID') || 'PRJ-001';
    const commandId = makeId('CMD');

    appendCommand(ss, {
      command_id: commandId,
      created_at: new Date(),
      project_id: projectId,
      command_type: typeLabel,
      request: request,
      priority: priorityLabel,
      status: '실행 대기',
      assigned_model: assignedModel,
      approval_required: approvalRequired ? '예' : '아니오',
      result_summary: '',
      result_ref: '',
      processed_at: '',
      error: '',
      approval_decision: '',
      approval_note: '',
      approval_processed_at: ''
    });

    return getCommandDetail(commandId);
  } catch (err) {
    return { success: false, message: '작업 등록 중 오류가 발생했습니다.' };
  }
}

/**
 * 새로 등록한 작업을 바로 실행해보는 버튼용. 기존 processNextCommand()를 재사용한다.
 * (우선순위상 다른 실행 대기 작업이 있다면 그 작업이 먼저 처리될 수 있다.)
 */
function runNextReadyCommand() {
  try {
    processNextCommand();
    return { success: true };
  } catch (err) {
    return { success: false, message: '작업 실행 중 오류가 발생했습니다.' };
  }
}

/**
 * 작업 기록 조회 (필터 + 검색).
 */
function getCommandHistory(filter) {
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

    return { success: true, data: rows.slice(0, 200).map(commandToCard_) };
  } catch (err) {
    return { success: false, message: '작업 기록을 불러오지 못했습니다.' };
  }
}

/**
 * 오류 작업 재실행. 상태를 실행 대기로 되돌린 뒤 기존 processNextCommand()를 호출한다.
 */
function retryCommand(commandId) {
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
      processNextCommand();
    } catch (e) {
      // 실패해도 오류 내용은 processNextCommand 내부에서 이미 시트에 기록됨
    }

    return getCommandDetail(commandId);
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
