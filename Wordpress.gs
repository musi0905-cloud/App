// ============================================================
// 워드프레스 애드센스 승인 자동화 (이 파일 전체가 신규 추가)
//
// 목표: 애드센스 승인 심사를 통과할 수 있는 상태로 워드프레스 블로그를 만들어 두고,
// 키워드 발굴 → 경험 기반 글 작성 → 이미지 생성/첨부 → 예약 발행 → 자동 발행까지
// 사람이 개입하지 않아도 굴러가게 한다.
//
// 기존 파일과의 관계:
// - GPT/Claude 호출은 Code.gs의 callOpenAI() / callClaude()를 그대로 재사용한다.
// - makeId() / truncate() / formatDateTime_() / toTime_() 같은 범용 헬퍼도 재사용한다.
// - 시트 입출력은 Code.gs의 readTable()/rowToObject()를 쓰지 않고 이 파일 안의
//   wpReadTable_() 계열을 쓴다. Code.gs의 canonicalHeader()가 '진행상태'/'담당AI'/
//   '오류내용' 같은 한글 헤더를 COMMANDS 시트 기준 영문 키로 전역 치환하기 때문에,
//   워드프레스 관리대장까지 같은 규칙에 끌려가지 않도록 헤더 텍스트를 그대로 키로 쓴다.
// - 스프레드시트 ID를 상수로 박지 않는다. 최초 실행 때 관리대장을 자동 생성하고
//   그 ID를 Script Properties에 저장한다(WP_LEDGER_SHEET_ID).
//
// 애드센스 정책상 주의: AI가 사람의 경험을 지어내면 "가치 없는 콘텐츠"로 거절당한다.
// 그래서 3번 기능(경험)은 경험을 창작하는 기능이 아니라, 운영자에게 맞춤 질문을 던져
// 실제 경험을 받아 적고(경험노트), 글 생성 시 그 노트만 근거로 쓰게 하는 구조다.
// 노트가 없으면 1인칭 경험을 지어내는 대신 검증 가능한 정보 중심으로 쓴다.
// ============================================================

const WP_TZ_ = 'Asia/Seoul';

// ============================================================
// 0. 관리대장(스프레드시트) 자동 생성 및 입출력
// ============================================================

const WP_SHEET_SCHEMA_ = {
  '워드프레스설정': ['설정키', '설정값', '설명', '수정일시'],
  '키워드': [
    '키워드번호', '등록일시', '주제분야', '키워드', '검색의도', '롱테일제목',
    '난이도', '기회점수', '연관키워드', '출처', '상태', '콘텐츠번호', '비고'
  ],
  '경험노트': [
    '노트번호', '등록일시', '키워드번호', '주제', '질문', '경험답변',
    '사용여부', '비고'
  ],
  '콘텐츠': [
    '콘텐츠번호', '등록일시', '키워드번호', '키워드', '제목', '슬러그', '요약',
    '본문HTML', '태그', '카테고리', '글자수', '경험반영', '이미지수',
    '대표이미지ID', '대표이미지URL', '작성상태', '발행방식', '예약일시',
    '발행일시', '워드프레스글ID', '워드프레스링크', '검수결과', '오류메모', '수정일시',
    '이미지계획'
  ],
  '발행로그': ['로그번호', '일시', '단계', '대상', '수행주체', '작업내용', '처리결과', '상세', '오류메모'],
  '점검이력': ['점검번호', '일시', '총점', '통과항목수', '전체항목수', '미충족항목', '요약']
};

const WP_DEFAULT_SETTINGS_ = [
  ['블로그주제', '', '블로그가 다루는 큰 주제 분야 (예: 초등 자녀 학습법)'],
  ['타깃독자', '', '누가 읽는 글인지 (예: 초등 저학년 자녀를 둔 30~40대 부모)'],
  ['글쓴이소개', '', '글쓴이가 왜 이 주제를 말할 자격이 있는지 (E-E-A-T 근거)'],
  ['어투', '친근한 존댓말', '글의 어투'],
  ['글자수목표', '2000', '한 편당 목표 글자수 (공백 제외 기준 근사)'],
  ['이미지생성사용', 'Y', '이미지를 만들어 첨부할지 (Y/N)'],
  ['편당이미지수', '2', '대표이미지 1장 + 본문이미지 (n-1)장'],
  ['자동발행사용', 'N', '트리거 자동 발행 사용 여부 (Y/N)'],
  ['자동발행모드', '예약발행', '즉시발행 / 예약발행 / 초안만'],
  ['하루발행수', '1', '자동 발행이 하루에 만들 글 수'],
  ['예약발행시각', '09:00', '자동 예약발행이 잡을 시각 (HH:mm, 쉼표로 여러 개)'],
  ['경험없을때', '정보중심', '경험노트가 없을 때: 정보중심 / 자리표시자'],
  ['자동검수사용', 'Y', 'Claude가 애드센스 정책 관점에서 검수할지 (Y/N)']
];

function wpProps_() {
  return PropertiesService.getScriptProperties();
}

// 관리대장 점검(탭/헤더 확인)은 실행 한 번에 한 번이면 충분하다. wpGetSetting_ 같은 함수가
// 한 요청 안에서 수십 번 불리는데, 그때마다 전체 탭을 훑으면 그것만으로 몇 초가 날아간다.
let WP_LEDGER_CACHE_ = null;

/**
 * 관리대장 스프레드시트를 반환한다. 없으면 만들고 ID를 Script Properties에 저장한다.
 * 탭이나 헤더가 빠져 있으면 그때그때 채워 넣으므로, 사용자가 탭을 지워도 자동 복구된다.
 */
function wpEnsureLedger_() {
  if (WP_LEDGER_CACHE_) return WP_LEDGER_CACHE_;
  const props = wpProps_();
  let id = props.getProperty('WP_LEDGER_SHEET_ID');
  let ss = null;

  if (id) {
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (err) {
      ss = null; // 삭제됐거나 권한이 사라진 경우 새로 만든다.
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('워드프레스 애드센스 자동화 관리대장');
    props.setProperty('WP_LEDGER_SHEET_ID', ss.getId());
  }

  Object.keys(WP_SHEET_SCHEMA_).forEach(function (name) {
    const headers = WP_SHEET_SCHEMA_[name];
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const width = Math.max(sheet.getLastColumn(), headers.length);
    const current = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (v) { return String(v).trim(); });
    const needsHeader = headers.some(function (h, i) { return current[i] !== h; });
    if (needsHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });

  // 새로 만든 스프레드시트에 남는 기본 시트는 정리한다.
  const leftover = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (leftover && ss.getSheets().length > 1 && leftover.getLastRow() === 0) {
    ss.deleteSheet(leftover);
  }

  wpSeedSettings_(ss);
  WP_LEDGER_CACHE_ = ss;
  return ss;
}

function wpSeedSettings_(ss) {
  const sheet = ss.getSheetByName('워드프레스설정');
  const values = sheet.getDataRange().getValues();
  const existing = {};
  for (let i = 1; i < values.length; i++) {
    existing[String(values[i][0] || '').trim()] = true;
  }
  const missing = WP_DEFAULT_SETTINGS_.filter(function (row) { return !existing[row[0]]; });
  if (!missing.length) return;
  const now = new Date();
  sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, 4)
    .setValues(missing.map(function (r) { return [r[0], r[1], r[2], now]; }));
}

function wpSheet_(name) {
  const sheet = wpEnsureLedger_().getSheetByName(name);
  if (!sheet) throw new Error('관리대장 탭을 찾을 수 없습니다: ' + name);
  return sheet;
}

/** 헤더 텍스트를 그대로 키로 쓰는 표 읽기 (canonicalHeader를 거치지 않는다). */
function wpReadTable_(name) {
  const sheet = wpSheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1)
    .filter(function (row) { return row.some(function (v) { return v !== ''; }); })
    .map(function (row) {
      return headers.reduce(function (obj, h, i) { obj[h] = row[i]; return obj; }, {});
    });
}

function wpAppendRow_(name, record) {
  const sheet = wpSheet_(name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(function (h) {
    const v = record[String(h).trim()];
    return v === undefined || v === null ? '' : v;
  }));
}

/** idField 열에서 id와 일치하는 행을 찾아 { sheet, headers, idx, rowNumber, data }로 반환한다. */
function wpFindRow_(name, idField, id) {
  const sheet = wpSheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const idx = headers.reduce(function (obj, h, i) { obj[h] = i; return obj; }, {});
  if (idx[idField] === undefined) return null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx[idField]] || '').trim() === String(id || '').trim()) {
      const data = headers.reduce(function (obj, h, j) { obj[h] = values[i][j]; return obj; }, {});
      return { sheet: sheet, headers: headers, idx: idx, rowNumber: i + 1, data: data };
    }
  }
  return null;
}

function wpUpdateRow_(found, patch) {
  Object.keys(patch).forEach(function (key) {
    if (found.idx[key] !== undefined) {
      found.sheet.getRange(found.rowNumber, found.idx[key] + 1).setValue(patch[key]);
      found.data[key] = patch[key];
    }
  });
}

// 설정은 글 한 편 만드는 동안에도 십수 번 읽히므로 실행 단위로 캐시한다.
let WP_SETTINGS_CACHE_ = null;

function wpSettingsMap_() {
  if (WP_SETTINGS_CACHE_) return WP_SETTINGS_CACHE_;
  const map = {};
  wpReadTable_('워드프레스설정').forEach(function (r) {
    map[String(r['설정키']).trim()] = String(r['설정값'] || '').trim();
  });
  WP_SETTINGS_CACHE_ = map;
  return map;
}

function wpGetSetting_(key, fallback) {
  const value = wpSettingsMap_()[key] || '';
  return value || (fallback === undefined ? '' : fallback);
}

function wpSetSetting_(key, value) {
  const found = wpFindRow_('워드프레스설정', '설정키', key);
  if (found) {
    wpUpdateRow_(found, { '설정값': value, '수정일시': new Date() });
  } else {
    wpAppendRow_('워드프레스설정', { '설정키': key, '설정값': value, '설명': '', '수정일시': new Date() });
  }
  WP_SETTINGS_CACHE_ = null;
}

function wpIsOn_(key, fallback) {
  const v = String(wpGetSetting_(key, fallback || '')).trim().toUpperCase();
  return ['Y', 'YES', 'TRUE', '1', '예', '사용'].indexOf(v) !== -1;
}

function wpLog_(stage, target, actor, work, result, detail, errorText) {
  try {
    wpAppendRow_('발행로그', {
      '로그번호': makeId('WLOG'),
      '일시': new Date(),
      '단계': stage,
      '대상': target || '',
      '수행주체': actor || '',
      '작업내용': work || '',
      '처리결과': result || '',
      '상세': truncate(detail || '', 1000),
      '오류메모': truncate(errorText || '', 1000)
    });
  } catch (err) {
    // 로그 기록 실패가 본 작업을 막지 않게 한다.
  }
}

// ============================================================
// 1. 워드프레스 REST API 클라이언트
//
// 인증은 워드프레스 기본 기능인 "애플리케이션 비밀번호"(사용자 > 프로필 하단)를 쓴다.
// 로그인 비밀번호가 아니라 앱 전용 비밀번호이므로 언제든 회수할 수 있다.
// ============================================================

function wpConnection_() {
  const props = wpProps_();
  const site = String(props.getProperty('WP_SITE_URL') || '').trim().replace(/\/+$/, '');
  const user = String(props.getProperty('WP_USERNAME') || '').trim();
  const pass = String(props.getProperty('WP_APP_PASSWORD') || '').trim();
  if (!site || !user || !pass) {
    throw new Error('워드프레스 연결 정보가 없습니다. 설정 화면에서 사이트 주소·아이디·애플리케이션 비밀번호를 먼저 저장해주세요.');
  }
  return {
    site: site,
    user: user,
    authHeader: 'Basic ' + Utilities.base64Encode(user + ':' + pass.replace(/\s+/g, ''))
  };
}

/**
 * 워드프레스 REST API 호출. path는 '/wp/v2/posts'처럼 네임스페이스부터 준다.
 * query는 객체, payload는 JSON으로 보낼 객체.
 */
function wpApi_(path, method, payload, query) {
  const conn = wpConnection_();
  let url = conn.site + '/wp-json' + path;
  if (query && Object.keys(query).length) {
    url += '?' + Object.keys(query)
      .filter(function (k) { return query[k] !== undefined && query[k] !== null && query[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); })
      .join('&');
  }

  const options = {
    method: method || 'get',
    headers: { Authorization: conn.authHeader },
    muteHttpExceptions: true,
    followRedirects: true
  };
  if (payload) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(payload);
  }

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();
  const text = res.getContentText();

  if (code === 401 || code === 403) {
    throw new Error('워드프레스 인증에 실패했습니다(' + code + '). 아이디와 애플리케이션 비밀번호를 다시 확인해주세요.');
  }
  if (code >= 300) {
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message || text;
    } catch (e) { /* HTML 오류 페이지면 원문을 그대로 쓴다 */ }
    throw new Error('워드프레스 API 오류 ' + code + ': ' + truncate(message, 400));
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('워드프레스 응답을 해석하지 못했습니다. REST API가 열려 있는지 확인해주세요.');
  }
}

/** 이미지 blob을 미디어 라이브러리에 올리고 { id, url }을 반환한다. */
function wpUploadMedia_(blob, filename, altText, caption) {
  const conn = wpConnection_();
  const res = UrlFetchApp.fetch(conn.site + '/wp-json/wp/v2/media', {
    method: 'post',
    headers: {
      Authorization: conn.authHeader,
      'Content-Disposition': 'attachment; filename="' + filename + '"'
    },
    contentType: blob.getContentType() || 'image/png',
    payload: blob.getBytes(),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code >= 300) {
    throw new Error('이미지 업로드 실패 ' + code + ': ' + truncate(res.getContentText(), 300));
  }
  const media = JSON.parse(res.getContentText());

  // alt 텍스트는 접근성뿐 아니라 검색 노출에도 쓰이므로 별도 PATCH로 채운다.
  if (altText) {
    try {
      wpApi_('/wp/v2/media/' + media.id, 'post', { alt_text: altText, caption: caption || altText });
    } catch (err) { /* 본문 첨부에는 영향이 없으므로 무시 */ }
  }
  return { id: media.id, url: media.source_url };
}

/** 연결 확인용. 사이트 이름과 로그인 사용자 이름을 돌려준다. */
function wpTestConnection() {
  try {
    const settings = wpApi_('/wp/v2/settings', 'get');
    const me = wpApi_('/wp/v2/users/me', 'get');
    return {
      success: true,
      data: {
        siteTitle: settings.title || '',
        tagline: settings.description || '',
        userName: me.name || '',
        canPublish: !!(me.capabilities && me.capabilities.publish_posts)
      },
      message: '워드프레스에 정상적으로 연결되었습니다.'
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

// ============================================================
// 2. 기능 1 — 워드프레스 꾸미기
//
// 애드센스 심사는 "이 사이트가 운영 주체가 분명하고, 필수 문서가 있고, 탐색이 되는가"를 본다.
// 그래서 꾸미기 = 제목/설명 정리 + 필수 페이지 생성 + 카테고리 구성 + 메뉴 연결까지를 한다.
// ============================================================

function wpEnsureCategory_(name, description) {
  const found = wpApi_('/wp/v2/categories', 'get', null, { search: name, per_page: 20 }) || [];
  const hit = found.find(function (c) { return String(c.name).trim() === String(name).trim(); });
  if (hit) return hit;
  return wpApi_('/wp/v2/categories', 'post', { name: name, description: description || '' });
}

function wpFindPageBySlug_(slug) {
  const found = wpApi_('/wp/v2/pages', 'get', null, { slug: slug, status: 'publish,draft,pending,private', per_page: 5 }) || [];
  return found.length ? found[0] : null;
}

function wpEnsurePage_(title, slug, contentHtml) {
  const existing = wpFindPageBySlug_(slug);
  if (existing) {
    return { page: existing, created: false };
  }
  const page = wpApi_('/wp/v2/pages', 'post', {
    title: title,
    slug: slug,
    content: contentHtml,
    status: 'publish'
  });
  return { page: page, created: true };
}

function wpPrivacyPolicyHtml_(siteName, ownerEmail) {
  return [
    '<p>' + siteName + '(이하 “본 사이트”)은 이용자의 개인정보를 중요하게 생각하며, 아래와 같이 개인정보를 처리합니다.</p>',
    '<h2>1. 수집하는 정보</h2>',
    '<p>본 사이트는 회원가입을 받지 않으며, 이름·연락처 등 개인정보를 직접 수집하지 않습니다. 다만 댓글 작성 시 입력한 이름과 이메일 주소, 접속 로그(IP, 브라우저 정보)가 저장될 수 있습니다.</p>',
    '<h2>2. 쿠키와 광고</h2>',
    '<p>본 사이트는 Google을 포함한 제3자 광고 사업자의 광고를 게재할 수 있습니다. Google은 쿠키를 사용하여 이용자의 본 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 게재합니다. 이용자는 <a href="https://www.google.com/settings/ads" rel="nofollow noopener" target="_blank">Google 광고 설정</a>에서 맞춤 광고를 해제할 수 있습니다.</p>',
    '<h2>3. 분석 도구</h2>',
    '<p>방문 통계 확인을 위해 Google Analytics 등의 분석 도구를 사용할 수 있으며, 이때 수집되는 정보는 개인을 식별할 수 없는 형태로 처리됩니다.</p>',
    '<h2>4. 보유 및 파기</h2>',
    '<p>댓글 및 접속 기록은 보관 목적이 달성되면 지체 없이 파기합니다. 이용자는 언제든 본인이 작성한 댓글의 삭제를 요청할 수 있습니다.</p>',
    '<h2>5. 문의</h2>',
    '<p>개인정보 처리에 대한 문의는 ' + (ownerEmail || '문의 페이지') + '로 연락해주시기 바랍니다.</p>',
    '<p><em>본 방침은 게시일로부터 적용되며, 변경 시 본 페이지를 통해 공지합니다.</em></p>'
  ].join('\n');
}

function wpAboutPageHtml_(siteName, topic, target, authorIntro) {
  return [
    '<h2>' + siteName + '은 어떤 곳인가요?</h2>',
    '<p>' + siteName + '은 ' + (topic || '일상에서 자주 부딪히는 문제') + '을(를) 다루는 블로그입니다. ' +
    '검색해도 잘 나오지 않거나, 나와 있어도 실제로 해보면 다른 이야기가 되는 부분을 직접 겪어보고 정리합니다.</p>',
    '<h2>누구를 위한 글인가요?</h2>',
    '<p>' + (target || '같은 문제를 처음 겪어 어디서부터 알아봐야 할지 막막한 분') + '을 위해 씁니다.</p>',
    '<h2>글쓴이</h2>',
    '<p>' + (authorIntro || '해당 주제를 직접 겪으며 기록을 남기고 있는 운영자입니다.') + '</p>',
    '<h2>글을 쓰는 원칙</h2>',
    '<ul>',
    '<li>직접 확인하지 않은 내용은 확인하지 않았다고 밝힙니다.</li>',
    '<li>수치와 날짜는 출처를 함께 적습니다.</li>',
    '<li>사실이 바뀌면 글을 수정하고 수정한 날짜를 남깁니다.</li>',
    '</ul>'
  ].join('\n');
}

function wpContactPageHtml_(ownerEmail) {
  return [
    '<p>글에 대한 문의, 정정 요청, 제휴 제안은 아래로 보내주세요. 확인하는 대로 답변드리겠습니다.</p>',
    '<ul>',
    '<li>이메일: ' + (ownerEmail || '(이메일 주소를 입력해주세요)') + '</li>',
    '</ul>',
    '<p>잘못된 정보를 발견하셨다면 해당 글의 제목과 함께 알려주시면 확인 후 수정하겠습니다.</p>'
  ].join('\n');
}

/**
 * 기능 1: 블로그 기본 꾸미기.
 * payload: { siteTitle, tagline, topic, target, authorIntro, ownerEmail, categories: [문자열] }
 */
function wpApplyBlogSetup(payload) {
  try {
    payload = payload || {};
    const siteTitle = String(payload.siteTitle || '').trim();
    const tagline = String(payload.tagline || '').trim();
    const topic = String(payload.topic || '').trim();
    const target = String(payload.target || '').trim();
    const authorIntro = String(payload.authorIntro || '').trim();
    const ownerEmail = String(payload.ownerEmail || '').trim();

    const done = [];
    const warnings = [];

    // 1) 사이트 제목/설명
    if (siteTitle || tagline) {
      const patch = {};
      if (siteTitle) patch.title = siteTitle;
      if (tagline) patch.description = tagline;
      wpApi_('/wp/v2/settings', 'post', patch);
      done.push('사이트 제목·설명을 저장했습니다.');
    }

    const settings = wpApi_('/wp/v2/settings', 'get');
    const effectiveName = siteTitle || settings.title || '이 블로그';

    // 2) 카테고리
    let categories = payload.categories;
    if (!categories || !categories.length) {
      categories = wpSuggestCategories_(topic || effectiveName);
    }
    const madeCategories = [];
    categories.slice(0, 8).forEach(function (name) {
      const clean = String(name || '').trim();
      if (!clean) return;
      try {
        wpEnsureCategory_(clean, '');
        madeCategories.push(clean);
      } catch (err) {
        warnings.push('카테고리 “' + clean + '” 생성 실패: ' + err.message);
      }
    });
    if (madeCategories.length) done.push('카테고리 ' + madeCategories.length + '개를 정리했습니다: ' + madeCategories.join(', '));

    // 3) 애드센스 심사에서 사실상 필수인 페이지 3종
    const pages = [
      { title: '개인정보처리방침', slug: 'privacy-policy', html: wpPrivacyPolicyHtml_(effectiveName, ownerEmail) },
      { title: '블로그 소개', slug: 'about', html: wpAboutPageHtml_(effectiveName, topic, target, authorIntro) },
      { title: '문의하기', slug: 'contact', html: wpContactPageHtml_(ownerEmail) }
    ];
    const createdPages = [];
    const keptPages = [];
    pages.forEach(function (p) {
      try {
        const result = wpEnsurePage_(p.title, p.slug, p.html);
        if (result.created) createdPages.push(p.title);
        else keptPages.push(p.title);
      } catch (err) {
        warnings.push(p.title + ' 페이지 생성 실패: ' + err.message);
      }
    });
    if (createdPages.length) done.push('필수 페이지를 새로 만들었습니다: ' + createdPages.join(', '));
    if (keptPages.length) done.push('이미 있는 페이지는 그대로 두었습니다: ' + keptPages.join(', '));

    // 4) 메뉴 연결 (테마가 메뉴 REST를 지원할 때만 동작한다)
    try {
      wpEnsureMenu_(pages);
      done.push('상단 메뉴에 필수 페이지를 연결했습니다.');
    } catch (err) {
      warnings.push('메뉴 자동 연결은 실패했습니다(테마가 지원하지 않을 수 있습니다). 워드프레스 관리자 > 외모 > 메뉴에서 소개·문의하기·개인정보처리방침을 직접 추가해주세요.');
    }

    // 5) 설정 저장 (이후 글 생성 프롬프트에 계속 쓰인다)
    if (topic) wpSetSetting_('블로그주제', topic);
    if (target) wpSetSetting_('타깃독자', target);
    if (authorIntro) wpSetSetting_('글쓴이소개', authorIntro);
    if (ownerEmail) wpSetSetting_('운영자이메일', ownerEmail);

    wpLog_('사이트 꾸미기', effectiveName, '시스템', done.join(' / '), '완료', warnings.join(' / '), '');

    return {
      success: true,
      message: '블로그 기본 구성을 마쳤습니다.',
      data: { done: done, warnings: warnings }
    };
  } catch (err) {
    wpLog_('사이트 꾸미기', '', '시스템', '블로그 기본 구성', '오류', '', err.message || String(err));
    return { success: false, message: err.message || String(err) };
  }
}

function wpSuggestCategories_(topic) {
  if (!topic) return ['시작하기', '자주 겪는 문제', '직접 해본 후기', '정보 정리'];
  try {
    const text = callOpenAI(
      '너는 한국어 블로그 정보구조 설계자다. 주어진 주제로 블로그를 만들 때 쓸 카테고리 5개를 제안하라. ' +
      '설명 없이 카테고리 이름만 한 줄에 하나씩 출력하라. 각 이름은 12자 이내로 하라.',
      '블로그 주제: ' + topic
    );
    const list = String(text || '').split('\n')
      .map(function (l) { return l.replace(/^[\-\*\d\.\s]+/, '').trim(); })
      .filter(function (l) { return l && l.length <= 20; });
    return list.length ? list.slice(0, 5) : ['시작하기', '자주 겪는 문제', '직접 해본 후기', '정보 정리'];
  } catch (err) {
    return ['시작하기', '자주 겪는 문제', '직접 해본 후기', '정보 정리'];
  }
}

/** 워드프레스 5.9+ 의 /wp/v2/menus 를 이용해 기본 메뉴를 구성한다. */
function wpEnsureMenu_(pages) {
  const menus = wpApi_('/wp/v2/menus', 'get', null, { per_page: 20 }) || [];
  let menu = menus.find(function (m) { return String(m.name).trim() === '기본 메뉴'; });
  if (!menu) menu = wpApi_('/wp/v2/menus', 'post', { name: '기본 메뉴' });

  const items = wpApi_('/wp/v2/menu-items', 'get', null, { menus: menu.id, per_page: 50 }) || [];
  const titles = items.map(function (i) { return String(i.title && i.title.rendered ? i.title.rendered : i.title).trim(); });

  pages.forEach(function (p, order) {
    if (titles.indexOf(p.title) !== -1) return;
    const found = wpFindPageBySlug_(p.slug);
    if (!found) return;
    wpApi_('/wp/v2/menu-items', 'post', {
      title: p.title,
      menus: menu.id,
      object: 'page',
      object_id: found.id,
      type: 'post_type',
      status: 'publish',
      menu_order: order + 1
    });
  });
}

/**
 * 애드센스 승인 관점 자가 점검. 심사에서 자주 걸리는 항목만 실제 사이트 상태로 확인한다.
 */
function wpCheckAdsenseReadiness() {
  try {
    const settings = wpApi_('/wp/v2/settings', 'get');
    const posts = wpApi_('/wp/v2/posts', 'get', null, { per_page: 100, status: 'publish', _fields: 'id,title,content,date,featured_media,categories' }) || [];
    const pages = wpApi_('/wp/v2/pages', 'get', null, { per_page: 50, status: 'publish', _fields: 'id,title,slug' }) || [];
    const categories = wpApi_('/wp/v2/categories', 'get', null, { per_page: 50, _fields: 'id,name,count' }) || [];

    const pageSlugs = pages.map(function (p) { return String(p.slug || ''); });
    const pageTitles = pages.map(function (p) { return String(p.title && p.title.rendered || ''); });
    const hasPage = function (slugPart, titlePart) {
      return pageSlugs.some(function (s) { return s.indexOf(slugPart) !== -1; }) ||
        pageTitles.some(function (t) { return t.indexOf(titlePart) !== -1; });
    };

    const textLengths = posts.map(function (p) {
      const raw = String((p.content && p.content.rendered) || '').replace(/<[^>]*>/g, '').replace(/\s+/g, '');
      return raw.length;
    });
    const avgLength = textLengths.length
      ? Math.round(textLengths.reduce(function (a, b) { return a + b; }, 0) / textLengths.length)
      : 0;
    const longPosts = textLengths.filter(function (n) { return n >= 1500; }).length;
    const withImage = posts.filter(function (p) { return Number(p.featured_media || 0) > 0; }).length;

    // 최근 30일 발행 수 (심사 중에도 꾸준히 올라가는지를 본다)
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = posts.filter(function (p) { return new Date(p.date).getTime() >= monthAgo; }).length;

    const checks = [
      {
        key: '사이트 제목',
        pass: !!String(settings.title || '').trim(),
        detail: settings.title || '비어 있음',
        fix: '워드프레스 설정 > 일반에서 사이트 제목을 채우거나, 이 앱의 “블로그 꾸미기”를 실행하세요.'
      },
      {
        key: '사이트 설명(태그라인)',
        pass: !!String(settings.description || '').trim() && String(settings.description) !== 'Just another WordPress site',
        detail: settings.description || '비어 있음',
        fix: '기본 문구를 그대로 두면 미완성 사이트로 보입니다. 블로그가 무엇을 다루는지 한 줄로 적으세요.'
      },
      {
        key: '개인정보처리방침 페이지',
        pass: hasPage('privacy', '개인정보'),
        detail: hasPage('privacy', '개인정보') ? '있음' : '없음',
        fix: '애드센스는 개인정보처리방침이 없으면 대부분 거절합니다. “블로그 꾸미기”가 자동으로 만들어 줍니다.'
      },
      {
        key: '블로그 소개 페이지',
        pass: hasPage('about', '소개'),
        detail: hasPage('about', '소개') ? '있음' : '없음',
        fix: '운영 주체가 누구인지 밝히는 소개 페이지가 필요합니다.'
      },
      {
        key: '문의 페이지',
        pass: hasPage('contact', '문의'),
        detail: hasPage('contact', '문의') ? '있음' : '없음',
        fix: '연락 수단이 없으면 신뢰도 항목에서 감점됩니다.'
      },
      {
        key: '발행 글 수 (20편 이상 권장)',
        pass: posts.length >= 20,
        detail: posts.length + '편',
        fix: '심사 전에 최소 20편 이상을 권장합니다. 자동 발행을 켜두면 매일 채워집니다.'
      },
      {
        key: '평균 글 길이 (1,500자 이상)',
        pass: avgLength >= 1500,
        detail: '평균 ' + avgLength + '자, 1,500자 이상 ' + longPosts + '편',
        fix: '짧은 글이 많으면 “가치 없는 콘텐츠”로 분류됩니다. 설정에서 글자수 목표를 올리세요.'
      },
      {
        key: '대표 이미지가 있는 글',
        pass: posts.length > 0 && withImage >= Math.ceil(posts.length * 0.8),
        detail: posts.length ? withImage + '/' + posts.length + '편' : '글 없음',
        fix: '이미지 생성을 켜면 글마다 대표 이미지가 자동으로 붙습니다.'
      },
      {
        key: '카테고리 구성',
        pass: categories.filter(function (c) { return Number(c.count || 0) > 0; }).length >= 2,
        detail: categories.length + '개',
        fix: '글이 실제로 들어 있는 카테고리가 2개 이상이어야 탐색이 됩니다.'
      },
      {
        key: '최근 30일 발행',
        pass: recent >= 4,
        detail: recent + '편',
        fix: '심사 기간에도 글이 계속 올라와야 “운영 중인 사이트”로 봅니다.'
      }
    ];

    const passed = checks.filter(function (c) { return c.pass; }).length;
    const score = Math.round((passed / checks.length) * 100);
    const failed = checks.filter(function (c) { return !c.pass; });

    wpAppendRow_('점검이력', {
      '점검번호': makeId('CHK'),
      '일시': new Date(),
      '총점': score,
      '통과항목수': passed,
      '전체항목수': checks.length,
      '미충족항목': failed.map(function (c) { return c.key; }).join(', '),
      '요약': score >= 90 ? '신청 가능' : (score >= 70 ? '조금만 더 보완' : '아직 신청하지 마세요')
    });

    return {
      success: true,
      data: {
        score: score,
        passed: passed,
        total: checks.length,
        verdict: score >= 90 ? '신청 가능' : (score >= 70 ? '조금만 더 보완' : '아직 신청하지 마세요'),
        checks: checks,
        stats: { posts: posts.length, avgLength: avgLength, withImage: withImage, recent30d: recent }
      }
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

// ============================================================
// 3. 기능 2 — 키워드 자동 발굴
//
// 유료 키워드 도구 없이도 쓸 수 있도록, 구글 자동완성(실제 검색어 데이터)으로 후보를 긁고
// GPT가 검색의도·난이도·제목을 붙여 점수화한다.
// ============================================================

/** 구글 자동완성에서 실제 이용자들이 치는 검색어를 가져온다. */
function wpFetchGoogleSuggest_(seed) {
  const url = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&gl=kr&q=' + encodeURIComponent(seed);
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() >= 300) return [];
    const parsed = JSON.parse(res.getContentText());
    return (parsed[1] || []).map(function (s) { return String(s).trim(); }).filter(Boolean);
  } catch (err) {
    return [];
  }
}

/** 씨앗 키워드 + 자모/의문사 확장으로 자동완성을 넓게 훑는다. */
function wpCollectSuggestions_(seed) {
  const modifiers = ['', ' 방법', ' 추천', ' 후기', ' 비교', ' 비용', ' 초보', ' 준비물', '는', ' 언제'];
  const set = {};
  modifiers.forEach(function (m) {
    wpFetchGoogleSuggest_(seed + m).forEach(function (s) { set[s] = true; });
  });
  return Object.keys(set).slice(0, 60);
}

const WP_KEYWORD_INSTRUCTIONS_ = [
  '너는 한국어 SEO 키워드 분석가다. 아래 실제 구글 자동완성 검색어 목록에서, 개인 블로그가 상위 노출을 노려볼 만한',
  '롱테일 키워드를 최대 10개 고르고 분석하라.',
  '',
  '선정 기준:',
  '- 기업 사이트나 쇼핑몰이 이미 장악한 짧은 상업 키워드는 제외한다.',
  '- 경험담·실제 후기·구체적 절차를 찾는 검색어를 우선한다.',
  '- 애드센스 정책상 위험한 주제(의료 진단, 성인, 도박, 금융 투자 권유)는 제외한다.',
  '',
  '반드시 아래 JSON 배열 형식으로만 출력하라. 설명 문장이나 코드블록 표시를 붙이지 마라.',
  '[',
  '  {',
  '    "keyword": "키워드",',
  '    "intent": "정보형|후기형|비교형|방법형 중 하나와 한 줄 설명",',
  '    "title": "이 키워드로 쓸 블로그 글 제목 (32자 내외, 클릭하고 싶게)",',
  '    "difficulty": "낮음|보통|높음",',
  '    "score": 0부터 100 사이 정수 (개인 블로그 기준 기회 점수),',
  '    "related": "함께 넣으면 좋은 연관 키워드 3개를 쉼표로"',
  '  }',
  ']'
].join('\n');

function wpParseJsonArray_(text) {
  let s = String(text || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = s.indexOf('[');
  const end = s.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI 응답에서 JSON 배열을 찾지 못했습니다.');
  }
  return JSON.parse(s.slice(start, end + 1));
}

/**
 * 기능 2: 키워드 자동 발굴.
 * payload: { seed: '씨앗 키워드', count: 10 }
 */
function wpDiscoverKeywords(payload) {
  try {
    payload = payload || {};
    const seed = String(payload.seed || wpGetSetting_('블로그주제', '')).trim();
    if (!seed) return { success: false, message: '씨앗 키워드나 블로그 주제를 먼저 입력해주세요.' };

    const suggestions = wpCollectSuggestions_(seed);
    const source = suggestions.length ? '구글 자동완성 + AI 분석' : 'AI 분석';

    const input = [
      '블로그 주제: ' + seed,
      '타깃 독자: ' + wpGetSetting_('타깃독자', '일반 독자'),
      '',
      suggestions.length
        ? '[구글 자동완성 실제 검색어]\n' + suggestions.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n')
        : '[구글 자동완성 결과를 가져오지 못했습니다. 주제만 보고 롱테일 키워드를 직접 제안하라.]'
    ].join('\n');

    const raw = callOpenAI(WP_KEYWORD_INSTRUCTIONS_, input);
    const items = wpParseJsonArray_(raw);

    const existing = {};
    wpReadTable_('키워드').forEach(function (r) { existing[String(r['키워드']).trim()] = true; });

    const now = new Date();
    const saved = [];
    items.forEach(function (item) {
      const keyword = String(item.keyword || '').trim();
      if (!keyword || existing[keyword]) return;
      const id = makeId('KW');
      wpAppendRow_('키워드', {
        '키워드번호': id,
        '등록일시': now,
        '주제분야': seed,
        '키워드': keyword,
        '검색의도': String(item.intent || ''),
        '롱테일제목': String(item.title || ''),
        '난이도': String(item.difficulty || ''),
        '기회점수': Number(item.score || 0),
        '연관키워드': String(item.related || ''),
        '출처': source,
        '상태': '대기',
        '콘텐츠번호': '',
        '비고': ''
      });
      existing[keyword] = true;
      saved.push({ keywordId: id, keyword: keyword, title: String(item.title || ''), score: Number(item.score || 0) });
    });

    wpLog_('키워드 발굴', seed, 'GPT', '자동완성 ' + suggestions.length + '건 분석', '완료',
      saved.map(function (s) { return s.keyword; }).join(', '), '');

    return {
      success: true,
      message: saved.length ? saved.length + '개의 새 키워드를 찾았습니다.' : '새로운 키워드가 없습니다. 이미 등록된 키워드뿐입니다.',
      data: { seed: seed, suggestionCount: suggestions.length, keywords: saved }
    };
  } catch (err) {
    wpLog_('키워드 발굴', String((payload || {}).seed || ''), 'GPT', '키워드 발굴', '오류', '', err.message || String(err));
    return { success: false, message: '키워드 발굴 중 오류가 발생했습니다: ' + (err.message || err) };
  }
}

function wpListKeywords(filter) {
  try {
    filter = filter || {};
    let rows = wpReadTable_('키워드');
    if (filter.status) rows = rows.filter(function (r) { return String(r['상태']) === filter.status; });
    rows.sort(function (a, b) { return Number(b['기회점수'] || 0) - Number(a['기회점수'] || 0); });
    return {
      success: true,
      data: rows.slice(0, 100).map(function (r) {
        return {
          keywordId: String(r['키워드번호'] || ''),
          keyword: String(r['키워드'] || ''),
          title: String(r['롱테일제목'] || ''),
          intent: String(r['검색의도'] || ''),
          difficulty: String(r['난이도'] || ''),
          score: Number(r['기회점수'] || 0),
          related: String(r['연관키워드'] || ''),
          status: String(r['상태'] || ''),
          contentId: String(r['콘텐츠번호'] || ''),
          createdAt: formatDateTime_(r['등록일시'])
        };
      })
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

// ============================================================
// 4. 기능 3 — 사람의 경험 반영
//
// AI에게 "경험담을 지어내라"고 시키지 않는다. 애드센스 심사에서 가장 크게 감점되는 게
// 검색 결과를 짜깁기한 티가 나는 글이고, 지어낸 1인칭은 그 티가 제일 잘 난다.
// 대신 (1) 키워드별로 운영자만 답할 수 있는 질문을 만들고, (2) 받아 적은 답변을 저장했다가,
// (3) 글을 쓸 때 그 답변만을 1인칭 근거로 쓰게 한다.
// ============================================================

const WP_INTERVIEW_INSTRUCTIONS_ = [
  '너는 인터뷰어다. 블로그 운영자가 이 키워드에 대해 "직접 겪은 것"만 끌어내는 질문을 만들어야 한다.',
  '',
  '규칙:',
  '- 검색하면 나오는 정보(정의, 일반 절차)를 묻지 마라. 검색으로는 알 수 없는 것만 물어라.',
  '- 구체적인 숫자, 실패, 예상과 달랐던 점, 다시 한다면 바꿀 점을 물어라.',
  '- 질문 6개를 만들어라. 각 질문은 한 문장이고 40자를 넘기지 마라.',
  '',
  '아래 JSON 배열 형식으로만 출력하라. 설명이나 코드블록 표시를 붙이지 마라.',
  '[{"question": "질문 내용"}]'
].join('\n');

/** 기능 3-1: 키워드에 맞는 경험 질문을 만들어 경험노트에 빈 칸으로 저장한다. */
function wpCreateExperienceInterview(keywordId) {
  try {
    const found = wpFindRow_('키워드', '키워드번호', keywordId);
    if (!found) return { success: false, message: '키워드를 찾을 수 없습니다.' };
    const keyword = String(found.data['키워드'] || '');

    const raw = callOpenAI(WP_INTERVIEW_INSTRUCTIONS_, [
      '키워드: ' + keyword,
      '예정 제목: ' + String(found.data['롱테일제목'] || ''),
      '검색의도: ' + String(found.data['검색의도'] || ''),
      '블로그 주제: ' + wpGetSetting_('블로그주제', ''),
      '타깃 독자: ' + wpGetSetting_('타깃독자', '')
    ].join('\n'));

    const items = wpParseJsonArray_(raw);
    const now = new Date();
    const saved = [];
    items.slice(0, 8).forEach(function (item) {
      const question = String(item.question || '').trim();
      if (!question) return;
      const id = makeId('EXP');
      wpAppendRow_('경험노트', {
        '노트번호': id,
        '등록일시': now,
        '키워드번호': keywordId,
        '주제': keyword,
        '질문': question,
        '경험답변': '',
        '사용여부': 'N',
        '비고': ''
      });
      saved.push({ noteId: id, question: question, answer: '' });
    });

    wpLog_('경험 인터뷰', keyword, 'GPT', '질문 ' + saved.length + '개 생성', '완료', '', '');
    return {
      success: true,
      message: '이 키워드에 맞는 질문 ' + saved.length + '개를 만들었습니다. 답할 수 있는 것만 채워주세요.',
      data: { keywordId: keywordId, keyword: keyword, notes: saved }
    };
  } catch (err) {
    return { success: false, message: '경험 질문 생성 중 오류가 발생했습니다: ' + (err.message || err) };
  }
}

/** 기능 3-2: 운영자가 적은 실제 경험을 저장한다. payload: { notes: [{noteId, answer}] } */
function wpSaveExperienceNotes(payload) {
  try {
    payload = payload || {};
    const notes = payload.notes || [];
    let count = 0;
    notes.forEach(function (n) {
      const answer = String(n.answer || '').trim();
      const found = wpFindRow_('경험노트', '노트번호', n.noteId);
      if (!found) return;
      wpUpdateRow_(found, { '경험답변': answer, '사용여부': answer ? 'Y' : 'N' });
      if (answer) count++;
    });
    return { success: true, message: count + '개의 경험을 저장했습니다.', data: { saved: count } };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/** 키워드에 딸린 경험노트를 (답변이 있는 것 위주로) 가져온다. */
function wpGetExperienceNotes(keywordId) {
  try {
    const rows = wpReadTable_('경험노트')
      .filter(function (r) { return String(r['키워드번호']) === String(keywordId); });
    return {
      success: true,
      data: rows.map(function (r) {
        return {
          noteId: String(r['노트번호'] || ''),
          question: String(r['질문'] || ''),
          answer: String(r['경험답변'] || ''),
          used: String(r['사용여부'] || 'N') === 'Y'
        };
      })
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

function wpAnsweredNotes_(keywordId) {
  return wpReadTable_('경험노트')
    .filter(function (r) {
      return String(r['키워드번호']) === String(keywordId) && String(r['경험답변'] || '').trim();
    })
    .map(function (r) { return { question: String(r['질문']), answer: String(r['경험답변']) }; });
}

// ============================================================
// 5. 글 생성 (기능 2·3의 결과를 실제 원고로 만든다)
// ============================================================

function wpArticleInstructions_(hasExperience, fallbackMode) {
  const base = [
    '너는 한국어 블로그 글을 쓰는 사람이다. 애드센스 심사를 통과할 수준의 글, 즉 검색 결과를 요약한 티가 나지 않고',
    '읽고 나면 실제로 뭘 해야 할지 알게 되는 글을 써야 한다.',
    '',
    '반드시 지킬 것:',
    '- 워드프레스에 그대로 붙일 HTML로 쓴다. <h2>, <h3>, <p>, <ul>, <li>, <table>, <strong>만 쓴다.',
    '- <h1>은 쓰지 않는다(제목은 별도 필드다). 코드블록 표시(```)도 쓰지 않는다.',
    '- 첫 문단은 독자가 지금 겪고 있는 상황을 한 문장으로 짚고 시작한다. "안녕하세요" 같은 인사는 쓰지 않는다.',
    '- 소제목(h2)은 4~6개로 하고, 각 소제목 아래 문단은 3줄 이상 쓴다.',
    '- "~할 수 있습니다", "중요합니다" 같은 하나 마나 한 문장으로 문단을 채우지 않는다.',
    '- 숫자·기간·비용이 나오면 언제 기준인지 밝힌다. 모르면 모른다고 쓴다.',
    '- 표나 목록을 최소 하나 넣어 훑어볼 수 있게 한다.',
    '- 마지막에 <h2>정리</h2>로 실행 순서를 3~5단계로 요약한다.',
    '',
    '절대 하지 말 것:',
    '- 존재하지 않는 통계, 출처, 인용을 지어내지 마라.',
    '- 의료·법률·금융에서 단정적 조언을 하지 마라. 전문가 상담이 필요하면 그렇게 적어라.',
    '- 같은 말을 표현만 바꿔 반복해 글자수를 늘리지 마라.'
  ];

  if (hasExperience) {
    base.push(
      '',
      '경험 반영 (가장 중요):',
      '- 아래 [운영자 실제 경험]에 적힌 내용은 운영자가 직접 겪은 사실이다. 이것을 글의 중심 뼈대로 삼아라.',
      '- 최소 3곳에서 이 경험을 1인칭으로 녹여라. 구체적인 숫자와 실패담을 그대로 살려라.',
      '- 경험에 없는 내용을 1인칭("제가 해보니")으로 지어내지 마라. 경험 목록에 있는 것만 1인칭으로 쓴다.'
    );
  } else if (fallbackMode === '자리표시자') {
    base.push(
      '',
      '경험 반영:',
      '- 운영자의 실제 경험 기록이 아직 없다. 1인칭 경험담을 지어내지 마라.',
      '- 대신 경험이 들어가면 좋을 자리에 <p><strong>[내 경험 추가: 여기에 ○○를 적으세요]</strong></p> 형태의',
      '  자리표시자를 3개 넣어라. 무엇을 적어야 하는지 구체적으로 지시하라.'
    );
  } else {
    base.push(
      '',
      '경험 반영:',
      '- 운영자의 실제 경험 기록이 아직 없다. 1인칭 경험담을 지어내지 마라.',
      '- 대신 확인 가능한 절차, 조건별 판단 기준, 흔한 실수와 그 이유를 구체적으로 써서 정보 가치로 승부하라.',
      '- "제가 해봤는데", "직접 사용해보니" 같은 표현을 쓰지 마라.'
    );
  }

  base.push(
    '',
    '출력 형식 — 아래 JSON 객체 하나만 출력하라. 설명이나 코드블록 표시를 붙이지 마라.',
    '{',
    '  "title": "글 제목 (32자 내외)",',
    '  "slug": "url-slug-in-english-lowercase-hyphen",',
    '  "excerpt": "검색 결과에 보일 요약 (90자 내외)",',
    '  "content": "본문 HTML 전체",',
    '  "tags": ["태그1", "태그2", "태그3"],',
    '  "imagePrompts": ["대표 이미지 묘사", "본문 이미지 묘사"],',
    '  "imageAlts": ["대표 이미지 대체텍스트", "본문 이미지 대체텍스트"]',
    '}',
    '',
    'imagePrompts는 이미지 생성 AI에 넣을 영어 묘사다. 사진처럼 자연스러운 장면을 묘사하고,',
    '글자·로고·워터마크·실존 인물은 넣지 말라고 명시하라.'
  );

  return base.join('\n');
}

function wpParseJsonObject_(text) {
  let s = String(text || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI 응답에서 JSON 객체를 찾지 못했습니다.');
  }
  return JSON.parse(s.slice(start, end + 1));
}

const WP_REVIEW_INSTRUCTIONS_ = [
  '너는 구글 애드센스 심사관의 관점에서 블로그 글을 검수한다. 아래 글을 읽고 다음을 판정하라.',
  '',
  '1. 정책 위반 소지 (성인/폭력/의료 단정/저작권 침해 소지)',
  '2. "가치 없는 콘텐츠"로 보일 요소 (내용 없는 문장 반복, 검색 결과 짜깁기 느낌, 지나치게 짧음)',
  '3. 사실로 단정했지만 근거가 없는 문장',
  '',
  '출력 형식:',
  '판정: 통과 / 수정필요',
  '이유: (2~4줄. 통과면 어떤 점이 좋았는지, 수정필요면 어느 문장이 문제인지 구체적으로)',
  '',
  '판정 줄은 반드시 위 형식 그대로 첫 줄에 써라.'
].join('\n');

/**
 * 기능 2+3 결과로 글 원고를 만든다. 이미지는 여기서 만들지 않고 발행 단계에서 붙인다.
 * payload: { keywordId } 또는 { keyword, title }
 */
function wpGenerateArticle(payload) {
  try {
    payload = payload || {};
    let keywordId = String(payload.keywordId || '').trim();
    let keyword = String(payload.keyword || '').trim();
    let plannedTitle = String(payload.title || '').trim();
    let related = '';
    let intent = '';

    if (keywordId) {
      const found = wpFindRow_('키워드', '키워드번호', keywordId);
      if (!found) return { success: false, message: '키워드를 찾을 수 없습니다.' };
      keyword = String(found.data['키워드'] || '');
      plannedTitle = plannedTitle || String(found.data['롱테일제목'] || '');
      related = String(found.data['연관키워드'] || '');
      intent = String(found.data['검색의도'] || '');
    }
    if (!keyword) return { success: false, message: '키워드를 입력하거나 선택해주세요.' };

    const notes = keywordId ? wpAnsweredNotes_(keywordId) : [];
    const hasExperience = notes.length > 0;
    const fallbackMode = wpGetSetting_('경험없을때', '정보중심');
    const targetLength = Number(wpGetSetting_('글자수목표', '2000')) || 2000;

    const input = [
      '핵심 키워드: ' + keyword,
      plannedTitle ? '제목 후보: ' + plannedTitle : '',
      intent ? '검색 의도: ' + intent : '',
      related ? '함께 다룰 연관 키워드: ' + related : '',
      '블로그 주제: ' + wpGetSetting_('블로그주제', ''),
      '타깃 독자: ' + wpGetSetting_('타깃독자', '일반 독자'),
      '글쓴이: ' + wpGetSetting_('글쓴이소개', ''),
      '어투: ' + wpGetSetting_('어투', '친근한 존댓말'),
      '목표 분량: 공백 제외 ' + targetLength + '자 이상',
      '',
      hasExperience
        ? '[운영자 실제 경험]\n' + notes.map(function (n, i) {
            return (i + 1) + '. 질문: ' + n.question + '\n   답변: ' + n.answer;
          }).join('\n')
        : '[운영자 실제 경험] 아직 기록된 경험이 없습니다.'
    ].filter(Boolean).join('\n');

    const raw = callOpenAI(wpArticleInstructions_(hasExperience, fallbackMode), input);
    const article = wpParseJsonObject_(raw);

    const contentHtml = String(article.content || '').trim();
    if (!contentHtml) throw new Error('본문이 비어 있습니다. 다시 시도해주세요.');
    const plainLength = contentHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, '').length;

    // Claude 검수 (설정에서 끌 수 있다)
    let review = '검수 안 함';
    if (wpIsOn_('자동검수사용', 'Y')) {
      try {
        review = truncate(callClaude(WP_REVIEW_INSTRUCTIONS_,
          '제목: ' + String(article.title || '') + '\n\n' + contentHtml.replace(/<[^>]*>/g, ' ')), 1200);
      } catch (err) {
        review = '검수 실패: ' + (err.message || err);
      }
    }

    const contentId = makeId('WPC');
    const now = new Date();
    wpAppendRow_('콘텐츠', {
      '콘텐츠번호': contentId,
      '등록일시': now,
      '키워드번호': keywordId,
      '키워드': keyword,
      '제목': String(article.title || plannedTitle || keyword),
      '슬러그': String(article.slug || ''),
      '요약': String(article.excerpt || ''),
      '본문HTML': contentHtml,
      '태그': (article.tags || []).join(', '),
      '카테고리': String(payload.category || ''),
      '글자수': plainLength,
      '경험반영': hasExperience ? notes.length + '건 반영' : '없음(' + fallbackMode + ')',
      '이미지수': 0,
      '대표이미지ID': '',
      '대표이미지URL': '',
      '작성상태': '원고 완료',
      '발행방식': '',
      '예약일시': '',
      '발행일시': '',
      '워드프레스글ID': '',
      '워드프레스링크': '',
      '검수결과': review,
      '오류메모': '',
      '수정일시': now,
      // 이미지 프롬프트는 발행 단계에서 실제 이미지를 만들 때 다시 쓴다.
      '이미지계획': truncate(JSON.stringify({
        prompts: article.imagePrompts || [],
        alts: article.imageAlts || []
      }), 4000)
    });

    if (keywordId) {
      const kwRow = wpFindRow_('키워드', '키워드번호', keywordId);
      if (kwRow) wpUpdateRow_(kwRow, { '상태': '원고 완료', '콘텐츠번호': contentId });
    }

    wpLog_('원고 작성', keyword, 'GPT', String(article.title || ''), '완료',
      plainLength + '자 · 경험 ' + notes.length + '건', '');

    return {
      success: true,
      message: '원고를 만들었습니다. (' + plainLength + '자)',
      data: {
        contentId: contentId,
        title: String(article.title || ''),
        length: plainLength,
        experienceUsed: notes.length,
        review: review
      }
    };
  } catch (err) {
    wpLog_('원고 작성', String((payload || {}).keyword || ''), 'GPT', '원고 작성', '오류', '', err.message || String(err));
    return { success: false, message: '원고 작성 중 오류가 발생했습니다: ' + (err.message || err) };
  }
}

// ============================================================
// 6. 기능 4 — 이미지 생성 후 첨부
//
// OpenAI 이미지 모델로 만들고 base64를 그대로 워드프레스 미디어에 올린다.
// 외부 이미지 URL을 긁어오면 저작권 문제로 애드센스에서 거절될 수 있어 직접 생성만 쓴다.
// ============================================================

function wpGenerateImageBlob_(prompt, filename) {
  const key = wpProps_().getProperty('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

  const safePrompt = String(prompt || '').trim() +
    '. Photorealistic, natural lighting, clean composition. ' +
    'No text, no letters, no logos, no watermark, no real person\'s face.';

  const res = UrlFetchApp.fetch('https://api.openai.com/v1/images/generations', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({
      model: 'gpt-image-1',
      prompt: safePrompt,
      size: '1536x1024',
      quality: 'medium',
      n: 1
    }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText() || '{}');
  if (code >= 300) {
    throw new Error('이미지 생성 실패 ' + code + ': ' + ((body.error && body.error.message) || '알 수 없는 오류'));
  }
  const b64 = body.data && body.data[0] && body.data[0].b64_json;
  if (!b64) throw new Error('이미지 응답에 데이터가 없습니다.');

  return Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', filename);
}

/**
 * 콘텐츠에 이미지를 만들어 붙인다. 첫 장은 대표 이미지, 나머지는 본문 h2 사이에 끼운다.
 * 반환: { featuredId, featuredUrl, count }
 */
function wpAttachImages_(contentFound) {
  const contentId = String(contentFound.data['콘텐츠번호']);
  const wanted = Math.max(0, Number(wpGetSetting_('편당이미지수', '2')) || 0);
  if (!wpIsOn_('이미지생성사용', 'Y') || wanted === 0) {
    return { featuredId: '', featuredUrl: '', count: 0 };
  }

  let plan = { prompts: [], alts: [] };
  try {
    const stored = String(contentFound.data['이미지계획'] || '');
    if (stored) plan = JSON.parse(stored);
  } catch (err) { /* 저장된 프롬프트가 깨졌으면 아래에서 제목으로 대체한다 */ }

  const title = String(contentFound.data['제목'] || '');
  const keyword = String(contentFound.data['키워드'] || '');
  const prompts = (plan.prompts && plan.prompts.length ? plan.prompts : [
    'A clean, realistic scene that illustrates the topic: ' + (keyword || title)
  ]).slice(0, wanted);
  const alts = plan.alts || [];

  let html = String(contentFound.data['본문HTML'] || '');
  let featuredId = '';
  let featuredUrl = '';
  let made = 0;

  prompts.forEach(function (prompt, i) {
    try {
      // 파일명은 아스키만 남긴다. 한글 슬러그면 남는 게 없으므로 기본 이름으로 되돌린다.
      const base = String(contentFound.data['슬러그'] || '').replace(/[^a-zA-Z0-9\-_]/g, '') || 'post';
      const filename = base + '-' + (i + 1) + '.png';
      const alt = String(alts[i] || title).replace(/["<>]/g, '');
      const blob = wpGenerateImageBlob_(prompt, filename);
      const media = wpUploadMedia_(blob, filename, alt, alt);
      made++;

      if (i === 0) {
        featuredId = media.id;
        featuredUrl = media.url;
        return; // 대표 이미지는 본문에 중복으로 넣지 않는다.
      }
      // 본문 이미지는 i번째 h2 앞에 끼워 넣는다. h2가 없으면 맨 끝에 붙인다.
      const figure = '\n<figure><img src="' + media.url + '" alt="' + alt +
        '" loading="lazy" /><figcaption>' + alt + '</figcaption></figure>\n';
      const positions = [];
      const re = /<h2[\s>]/gi;
      let m;
      while ((m = re.exec(html)) !== null) positions.push(m.index);
      const at = positions[Math.min(i, positions.length - 1)];
      if (at === undefined) html += figure;
      else html = html.slice(0, at) + figure + html.slice(at);
    } catch (err) {
      wpLog_('이미지 생성', contentId, '시스템', (i + 1) + '번째 이미지', '오류', prompt, err.message || String(err));
    }
  });

  wpUpdateRow_(contentFound, {
    '본문HTML': html,
    '이미지수': made,
    '대표이미지ID': featuredId,
    '대표이미지URL': featuredUrl,
    '수정일시': new Date()
  });

  return { featuredId: featuredId, featuredUrl: featuredUrl, count: made };
}

// ============================================================
// 7. 기능 5·6 — 예약 발행 / 즉시 발행
// ============================================================

/** 'yyyy-MM-dd HH:mm'(KST) 또는 ISO 문자열을 Date로 바꾼다. */
function wpParseKstDateTime_(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (m) {
    const iso = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) +
      'T' + ('0' + m[4]).slice(-2) + ':' + m[5] + ':00+09:00';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 워드프레스 REST에 보낼 예약 시각 필드를 만든다.
 *
 * date와 date_gmt를 둘 다 보내면 워드프레스는 date만 쓰고 그 값을 "사이트 타임존" 기준으로
 * 해석한다(WP_REST_Posts_Controller::prepare_item_for_database의 elseif 분기). 사이트
 * 타임존이 서울이 아니면 예약 시각이 그만큼 어긋나므로, 타임존에 관계없이 한 시점만 가리키는
 * date_gmt(UTC)만 보낸다.
 */
function wpToWpDateFields_(date) {
  return { date_gmt: Utilities.formatDate(date, 'UTC', "yyyy-MM-dd'T'HH:mm:ss") };
}

function wpResolveCategoryIds_(names) {
  const ids = [];
  (names || []).forEach(function (name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    try {
      const cat = wpEnsureCategory_(clean, '');
      if (cat && cat.id) ids.push(cat.id);
    } catch (err) { /* 카테고리 실패는 발행을 막지 않는다 */ }
  });
  return ids;
}

function wpResolveTagIds_(names) {
  const ids = [];
  (names || []).forEach(function (name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    try {
      const found = wpApi_('/wp/v2/tags', 'get', null, { search: clean, per_page: 20 }) || [];
      const hit = found.find(function (t) { return String(t.name).trim() === clean; });
      const tag = hit || wpApi_('/wp/v2/tags', 'post', { name: clean });
      if (tag && tag.id) ids.push(tag.id);
    } catch (err) { /* 태그 실패는 발행을 막지 않는다 */ }
  });
  return ids;
}

/**
 * 기능 4+5+6: 이미지 첨부 → 워드프레스 발행.
 * mode: '즉시발행' | '예약발행' | '초안'
 * scheduleAt: 예약발행일 때 'yyyy-MM-dd HH:mm' (KST)
 */
function wpPublishContent(contentId, mode, scheduleAt) {
  try {
    const found = wpFindRow_('콘텐츠', '콘텐츠번호', contentId);
    if (!found) return { success: false, message: '콘텐츠를 찾을 수 없습니다.' };
    if (String(found.data['워드프레스글ID'] || '')) {
      return { success: false, message: '이미 워드프레스에 올라간 글입니다.' };
    }

    mode = String(mode || '즉시발행');
    let scheduledDate = null;
    if (mode === '예약발행') {
      scheduledDate = wpParseKstDateTime_(scheduleAt);
      if (!scheduledDate) return { success: false, message: '예약 일시를 "2026-08-20 09:00" 형식으로 입력해주세요.' };
      if (scheduledDate.getTime() <= Date.now()) {
        return { success: false, message: '예약 일시는 현재 시각보다 뒤여야 합니다.' };
      }
    }

    // 이미지 첨부 (설정에서 껐으면 건너뛴다)
    const images = wpAttachImages_(found);
    const refreshed = wpFindRow_('콘텐츠', '콘텐츠번호', contentId);

    const tags = String(refreshed.data['태그'] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const categoryNames = String(refreshed.data['카테고리'] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    const body = {
      title: String(refreshed.data['제목'] || ''),
      content: String(refreshed.data['본문HTML'] || ''),
      excerpt: String(refreshed.data['요약'] || ''),
      status: mode === '초안' ? 'draft' : (mode === '예약발행' ? 'future' : 'publish'),
      comment_status: 'open'
    };
    const slug = String(refreshed.data['슬러그'] || '').trim();
    if (slug) body.slug = slug;
    if (images.featuredId) body.featured_media = images.featuredId;

    const tagIds = wpResolveTagIds_(tags);
    if (tagIds.length) body.tags = tagIds;
    const catIds = wpResolveCategoryIds_(categoryNames);
    if (catIds.length) body.categories = catIds;

    if (scheduledDate) {
      body.date_gmt = wpToWpDateFields_(scheduledDate).date_gmt;
    }

    const post = wpApi_('/wp/v2/posts', 'post', body);
    const link = post.link || '';
    const now = new Date();

    wpUpdateRow_(refreshed, {
      '작성상태': mode === '초안' ? '초안 저장' : (mode === '예약발행' ? '예약 완료' : '발행 완료'),
      '발행방식': mode,
      '예약일시': scheduledDate || '',
      '발행일시': mode === '즉시발행' ? now : '',
      '워드프레스글ID': post.id,
      '워드프레스링크': link,
      '오류메모': '',
      '수정일시': now
    });

    const keywordId = String(refreshed.data['키워드번호'] || '');
    if (keywordId) {
      const kwRow = wpFindRow_('키워드', '키워드번호', keywordId);
      if (kwRow) wpUpdateRow_(kwRow, { '상태': mode === '예약발행' ? '예약 완료' : (mode === '초안' ? '초안 저장' : '발행 완료') });
    }

    wpLog_('발행', String(refreshed.data['제목'] || ''), '시스템', mode, '완료',
      link + (scheduledDate ? ' (예약 ' + formatDateTime_(scheduledDate) + ')' : '') + ' · 이미지 ' + images.count + '장', '');

    return {
      success: true,
      message: mode === '예약발행'
        ? formatDateTime_(scheduledDate) + '에 발행되도록 예약했습니다.'
        : (mode === '초안' ? '워드프레스에 초안으로 저장했습니다.' : '워드프레스에 발행했습니다.'),
      data: {
        contentId: contentId,
        postId: post.id,
        link: link,
        mode: mode,
        scheduledAt: scheduledDate ? formatDateTime_(scheduledDate) : '',
        images: images.count
      }
    };
  } catch (err) {
    const found = wpFindRow_('콘텐츠', '콘텐츠번호', contentId);
    if (found) wpUpdateRow_(found, { '오류메모': truncate(err.message || String(err), 500), '수정일시': new Date() });
    wpLog_('발행', contentId, '시스템', String(mode || ''), '오류', '', err.message || String(err));
    return { success: false, message: '발행 중 오류가 발생했습니다: ' + (err.message || err) };
  }
}

/** 예약만 다시 잡기 (이미 예약된 글의 시각 변경). */
function wpReschedule(contentId, scheduleAt) {
  try {
    const found = wpFindRow_('콘텐츠', '콘텐츠번호', contentId);
    if (!found) return { success: false, message: '콘텐츠를 찾을 수 없습니다.' };
    const postId = String(found.data['워드프레스글ID'] || '');
    if (!postId) return { success: false, message: '아직 워드프레스에 올라가지 않은 글입니다. 먼저 예약 발행을 해주세요.' };

    const date = wpParseKstDateTime_(scheduleAt);
    if (!date) return { success: false, message: '예약 일시를 "2026-08-20 09:00" 형식으로 입력해주세요.' };
    if (date.getTime() <= Date.now()) return { success: false, message: '예약 일시는 현재 시각보다 뒤여야 합니다.' };

    wpApi_('/wp/v2/posts/' + postId, 'post', {
      status: 'future',
      date_gmt: wpToWpDateFields_(date).date_gmt
    });

    wpUpdateRow_(found, { '예약일시': date, '작성상태': '예약 완료', '발행방식': '예약발행', '수정일시': new Date() });
    wpLog_('예약 변경', String(found.data['제목'] || ''), '시스템', formatDateTime_(date), '완료', '', '');
    return { success: true, message: formatDateTime_(date) + '로 예약을 변경했습니다.' };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

// ============================================================
// 8. 기능 6 — 자동 발행 (시간 트리거)
//
// 한 번 돌 때 글 한 편만 만든다. Apps Script 실행 시간이 6분으로 제한돼 있어서
// 여러 편을 한 번에 만들면 이미지 생성 도중 잘린다.
// ============================================================

/** 다음 예약 시각을 '예약발행시각' 설정(HH:mm, 쉼표 구분)에서 고른다. */
function wpNextScheduleSlot_() {
  const raw = wpGetSetting_('예약발행시각', '09:00');
  const slots = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  const now = new Date();

  const candidates = [];
  [0, 1, 2].forEach(function (dayOffset) {
    slots.forEach(function (slot) {
      const m = slot.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return;
      const base = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = Utilities.formatDate(base, WP_TZ_, 'yyyy-MM-dd');
      const d = new Date(dateStr + 'T' + ('0' + m[1]).slice(-2) + ':' + m[2] + ':00+09:00');
      if (!isNaN(d.getTime()) && d.getTime() > now.getTime() + 5 * 60 * 1000) candidates.push(d);
    });
  });

  candidates.sort(function (a, b) { return a - b; });

  // 이미 그 시각에 예약된 글이 있으면 다음 슬롯으로 밀어 하루에 몰리지 않게 한다.
  const taken = {};
  wpReadTable_('콘텐츠').forEach(function (r) {
    const at = r['예약일시'];
    if (at instanceof Date) taken[Utilities.formatDate(at, WP_TZ_, 'yyyy-MM-dd HH:mm')] = true;
  });

  for (let i = 0; i < candidates.length; i++) {
    const key = Utilities.formatDate(candidates[i], WP_TZ_, 'yyyy-MM-dd HH:mm');
    if (!taken[key]) return candidates[i];
  }
  return candidates.length ? candidates[0] : new Date(Date.now() + 60 * 60 * 1000);
}

function wpCountTodayRuns_() {
  const today = Utilities.formatDate(new Date(), WP_TZ_, 'yyyy-MM-dd');
  return wpReadTable_('콘텐츠').filter(function (r) {
    const at = r['등록일시'];
    return at instanceof Date && Utilities.formatDate(at, WP_TZ_, 'yyyy-MM-dd') === today;
  }).length;
}

/**
 * 자동 발행 1회 사이클. 트리거가 이 함수를 호출한다.
 * 1) 대기 중인 키워드가 없으면 자동으로 새 키워드를 발굴한다.
 * 2) 점수가 가장 높은 키워드로 원고를 쓴다.
 * 3) 설정한 모드(즉시발행/예약발행/초안만)로 워드프레스에 올린다.
 */
function wpAutomationCycle() {
  try {
    if (!wpIsOn_('자동발행사용', 'N')) return { success: true, message: '자동 발행이 꺼져 있습니다.' };

    const perDay = Math.max(1, Number(wpGetSetting_('하루발행수', '1')) || 1);
    if (wpCountTodayRuns_() >= perDay) {
      return { success: true, message: '오늘 목표(' + perDay + '편)를 이미 채웠습니다.' };
    }

    // 1) 키워드 확보
    let pending = wpReadTable_('키워드').filter(function (r) { return String(r['상태']) === '대기'; });
    if (!pending.length) {
      const seed = wpGetSetting_('블로그주제', '');
      if (!seed) {
        wpLog_('자동 발행', '', '시스템', '키워드 확보', '중단', '블로그주제 설정이 비어 있음', '');
        return { success: false, message: '블로그주제 설정이 비어 있어 키워드를 찾을 수 없습니다.' };
      }
      wpDiscoverKeywords({ seed: seed });
      pending = wpReadTable_('키워드').filter(function (r) { return String(r['상태']) === '대기'; });
      if (!pending.length) {
        return { success: false, message: '발굴된 새 키워드가 없습니다.' };
      }
    }
    pending.sort(function (a, b) { return Number(b['기회점수'] || 0) - Number(a['기회점수'] || 0); });
    const target = pending[0];
    const keywordId = String(target['키워드번호']);

    // 2) 원고
    const article = wpGenerateArticle({ keywordId: keywordId });
    if (!article.success) {
      wpLog_('자동 발행', String(target['키워드']), '시스템', '원고 작성', '오류', '', article.message);
      return article;
    }

    // 3) 발행
    const mode = wpGetSetting_('자동발행모드', '예약발행');
    if (mode === '초안만') {
      const result = wpPublishContent(article.data.contentId, '초안', '');
      return result;
    }
    if (mode === '즉시발행') {
      return wpPublishContent(article.data.contentId, '즉시발행', '');
    }
    const slot = wpNextScheduleSlot_();
    return wpPublishContent(article.data.contentId, '예약발행', Utilities.formatDate(slot, WP_TZ_, 'yyyy-MM-dd HH:mm'));
  } catch (err) {
    wpLog_('자동 발행', '', '시스템', '자동 사이클', '오류', '', err.message || String(err));
    return { success: false, message: '자동 발행 중 오류가 발생했습니다: ' + (err.message || err) };
  }
}

function wpInstallAutoPublishTrigger(everyHours) {
  wpRemoveAutoPublishTriggers();
  const hours = Math.max(1, Math.min(24, Number(everyHours || 6)));
  ScriptApp.newTrigger('wpAutomationCycle').timeBased().everyHours(hours).create();
  wpSetSetting_('자동발행사용', 'Y');
  wpSetSetting_('자동실행주기', hours + '시간');
  wpLog_('자동 발행', '', '시스템', hours + '시간마다 자동 실행 설치', '완료', '', '');
  return { success: true, message: hours + '시간마다 자동으로 글을 만들고 발행합니다.' };
}

function wpRemoveAutoPublishTriggers() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'wpAutomationCycle'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  wpSetSetting_('자동발행사용', 'N');
  return { success: true, message: '자동 발행을 껐습니다.' };
}

function wpHasAutoTrigger_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'wpAutomationCycle'; });
}

// ============================================================
// 9. 웹앱에서 부르는 조회/설정 함수
// ============================================================

function wpGetDashboard() {
  try {
    const contents = wpReadTable_('콘텐츠');
    const keywords = wpReadTable_('키워드');

    const summary = {
      keywordsPending: keywords.filter(function (r) { return String(r['상태']) === '대기'; }).length,
      drafts: contents.filter(function (r) { return ['원고 완료', '초안 저장'].indexOf(String(r['작성상태'])) !== -1; }).length,
      scheduled: contents.filter(function (r) { return String(r['작성상태']) === '예약 완료'; }).length,
      published: contents.filter(function (r) { return String(r['작성상태']) === '발행 완료'; }).length
    };

    const cards = contents
      .sort(function (a, b) { return toTime_(b['수정일시'] || b['등록일시']) - toTime_(a['수정일시'] || a['등록일시']); })
      .slice(0, 50)
      .map(function (r) {
        return {
          contentId: String(r['콘텐츠번호'] || ''),
          title: String(r['제목'] || ''),
          keyword: String(r['키워드'] || ''),
          status: String(r['작성상태'] || ''),
          length: Number(r['글자수'] || 0),
          experience: String(r['경험반영'] || ''),
          images: Number(r['이미지수'] || 0),
          scheduledAt: formatDateTime_(r['예약일시']),
          link: String(r['워드프레스링크'] || ''),
          updatedAt: formatDateTime_(r['수정일시'] || r['등록일시'])
        };
      });

    return {
      success: true,
      data: {
        summary: summary,
        contents: cards,
        autoOn: wpHasAutoTrigger_() && wpIsOn_('자동발행사용', 'N')
      }
    };
  } catch (err) {
    return { success: false, message: '워드프레스 대시보드를 불러오지 못했습니다: ' + (err.message || err) };
  }
}

function wpGetContentDetail(contentId) {
  try {
    const found = wpFindRow_('콘텐츠', '콘텐츠번호', contentId);
    if (!found) return { success: false, message: '콘텐츠를 찾을 수 없습니다.' };
    const r = found.data;
    return {
      success: true,
      data: {
        contentId: String(r['콘텐츠번호'] || ''),
        keywordId: String(r['키워드번호'] || ''),
        keyword: String(r['키워드'] || ''),
        title: String(r['제목'] || ''),
        slug: String(r['슬러그'] || ''),
        excerpt: String(r['요약'] || ''),
        contentHtml: String(r['본문HTML'] || ''),
        tags: String(r['태그'] || ''),
        category: String(r['카테고리'] || ''),
        length: Number(r['글자수'] || 0),
        experience: String(r['경험반영'] || ''),
        images: Number(r['이미지수'] || 0),
        featuredUrl: String(r['대표이미지URL'] || ''),
        status: String(r['작성상태'] || ''),
        mode: String(r['발행방식'] || ''),
        scheduledAt: formatDateTime_(r['예약일시']),
        publishedAt: formatDateTime_(r['발행일시']),
        link: String(r['워드프레스링크'] || ''),
        review: String(r['검수결과'] || ''),
        errorText: String(r['오류메모'] || ''),
        updatedAt: formatDateTime_(r['수정일시'] || r['등록일시'])
      }
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/** 원고를 사람이 손본 뒤 저장. */
function wpUpdateContent(payload) {
  try {
    payload = payload || {};
    const found = wpFindRow_('콘텐츠', '콘텐츠번호', payload.contentId);
    if (!found) return { success: false, message: '콘텐츠를 찾을 수 없습니다.' };

    const patch = { '수정일시': new Date() };
    if (payload.title !== undefined) patch['제목'] = String(payload.title);
    if (payload.contentHtml !== undefined) {
      patch['본문HTML'] = String(payload.contentHtml);
      patch['글자수'] = String(payload.contentHtml).replace(/<[^>]*>/g, '').replace(/\s+/g, '').length;
    }
    if (payload.excerpt !== undefined) patch['요약'] = String(payload.excerpt);
    if (payload.tags !== undefined) patch['태그'] = String(payload.tags);
    if (payload.category !== undefined) patch['카테고리'] = String(payload.category);
    wpUpdateRow_(found, patch);

    // 이미 워드프레스에 올라간 글이면 그쪽도 함께 고친다.
    const postId = String(found.data['워드프레스글ID'] || '');
    if (postId) {
      const body = {};
      if (patch['제목'] !== undefined) body.title = patch['제목'];
      if (patch['본문HTML'] !== undefined) body.content = patch['본문HTML'];
      if (patch['요약'] !== undefined) body.excerpt = patch['요약'];
      if (Object.keys(body).length) wpApi_('/wp/v2/posts/' + postId, 'post', body);
    }

    return { success: true, message: '저장했습니다.' };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

function wpGetSettingsForClient() {
  try {
    const props = wpProps_();
    const site = String(props.getProperty('WP_SITE_URL') || '');
    const user = String(props.getProperty('WP_USERNAME') || '');
    const hasPass = !!props.getProperty('WP_APP_PASSWORD');

    const settings = {};
    wpReadTable_('워드프레스설정').forEach(function (r) {
      settings[String(r['설정키']).trim()] = String(r['설정값'] || '');
    });

    const lastCheck = wpReadTable_('점검이력').slice(-1)[0] || null;

    return {
      success: true,
      data: {
        siteUrl: site,
        userName: user,
        hasAppPassword: hasPass,
        connected: !!(site && user && hasPass),
        hasOpenAiKey: !!props.getProperty('OPENAI_API_KEY'),
        hasAnthropicKey: !!props.getProperty('ANTHROPIC_API_KEY'),
        autoOn: wpHasAutoTrigger_() && wpIsOn_('자동발행사용', 'N'),
        settings: settings,
        ledgerUrl: wpEnsureLedger_().getUrl(),
        lastCheck: lastCheck ? {
          score: Number(lastCheck['총점'] || 0),
          verdict: String(lastCheck['요약'] || ''),
          at: formatDateTime_(lastCheck['일시'])
        } : null
      }
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

/** 워드프레스 접속 정보 저장. 비밀번호는 Script Properties에만 저장하고 화면에 다시 내려주지 않는다. */
function wpSaveConnection(payload) {
  try {
    payload = payload || {};
    const site = String(payload.siteUrl || '').trim().replace(/\/+$/, '');
    const user = String(payload.userName || '').trim();
    const pass = String(payload.appPassword || '').trim();

    if (site && !/^https?:\/\//i.test(site)) {
      return { success: false, message: '사이트 주소는 https:// 로 시작해야 합니다.' };
    }

    const props = wpProps_();
    if (site) props.setProperty('WP_SITE_URL', site);
    if (user) props.setProperty('WP_USERNAME', user);
    if (pass) props.setProperty('WP_APP_PASSWORD', pass);

    const test = wpTestConnection();
    if (!test.success) return test;
    return { success: true, message: '연결에 성공했습니다: ' + test.data.siteTitle, data: test.data };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

function wpSaveSettings(payload) {
  try {
    payload = payload || {};
    const settings = payload.settings || {};
    Object.keys(settings).forEach(function (key) {
      wpSetSetting_(key, String(settings[key]));
    });
    return { success: true, message: '설정을 저장했습니다.' };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}

// ============================================================
// 10. 스프레드시트 메뉴에서 부르는 래퍼
//     (웹앱 없이 시트만 열어도 초기 설정과 점검을 할 수 있게 한다)
// ============================================================

function wpSetupConnectionFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const props = wpProps_();

  const site = ui.prompt('워드프레스 사이트 주소',
    'https:// 부터 전체 주소를 입력하세요. 예: https://myblog.com', ui.ButtonSet.OK_CANCEL);
  if (site.getSelectedButton() !== ui.Button.OK) return;
  if (site.getResponseText().trim()) {
    props.setProperty('WP_SITE_URL', site.getResponseText().trim().replace(/\/+$/, ''));
  }

  const user = ui.prompt('워드프레스 아이디', '관리자 로그인 아이디를 입력하세요.', ui.ButtonSet.OK_CANCEL);
  if (user.getSelectedButton() !== ui.Button.OK) return;
  if (user.getResponseText().trim()) props.setProperty('WP_USERNAME', user.getResponseText().trim());

  const pass = ui.prompt('애플리케이션 비밀번호',
    '워드프레스 관리자 > 사용자 > 프로필 맨 아래 "애플리케이션 비밀번호"에서 발급한 값을 입력하세요. (로그인 비밀번호 아님)',
    ui.ButtonSet.OK_CANCEL);
  if (pass.getSelectedButton() !== ui.Button.OK) return;
  if (pass.getResponseText().trim()) props.setProperty('WP_APP_PASSWORD', pass.getResponseText().trim());

  const test = wpTestConnection();
  ui.alert(test.success ? '연결 성공' : '연결 실패',
    test.success ? ('사이트: ' + test.data.siteTitle + '\n사용자: ' + test.data.userName) : test.message,
    ui.ButtonSet.OK);
}

function wpOpenLedgerFromMenu() {
  const ss = wpEnsureLedger_();
  SpreadsheetApp.getUi().alert('워드프레스 관리대장',
    '관리대장을 준비했습니다.\n\n' + ss.getUrl(), SpreadsheetApp.getUi().ButtonSet.OK);
}

function wpCheckReadinessFromMenu() {
  const res = wpCheckAdsenseReadiness();
  const ui = SpreadsheetApp.getUi();
  if (!res.success) {
    ui.alert('점검 실패', res.message, ui.ButtonSet.OK);
    return;
  }
  const failed = res.data.checks.filter(function (c) { return !c.pass; });
  ui.alert('애드센스 준비 상태: ' + res.data.score + '점 (' + res.data.verdict + ')',
    failed.length
      ? '보완할 항목\n\n' + failed.map(function (c, i) { return (i + 1) + '. ' + c.key + ' — ' + c.fix; }).join('\n\n')
      : '모든 항목을 통과했습니다. 애드센스를 신청해도 좋습니다.',
    ui.ButtonSet.OK);
}

function wpInstallAutoPublishTriggerFromMenu() {
  const res = wpInstallAutoPublishTrigger(6);
  SpreadsheetApp.getUi().alert(res.message);
}

function wpGetRecentLogs(limit) {
  try {
    const rows = wpReadTable_('발행로그')
      .sort(function (a, b) { return toTime_(b['일시']) - toTime_(a['일시']); })
      .slice(0, Number(limit || 30));
    return {
      success: true,
      data: rows.map(function (r) {
        return {
          at: formatDateTime_(r['일시']),
          stage: String(r['단계'] || ''),
          target: String(r['대상'] || ''),
          actor: String(r['수행주체'] || ''),
          work: String(r['작업내용'] || ''),
          result: String(r['처리결과'] || ''),
          detail: String(r['상세'] || ''),
          errorText: String(r['오류메모'] || '')
        };
      })
    };
  } catch (err) {
    return { success: false, message: err.message || String(err) };
  }
}
