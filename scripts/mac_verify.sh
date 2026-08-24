#!/usr/bin/env bash
#
# mac_verify.sh — 「쉼」 Sprint 0 Mac 검증 자동화
#
# Product Owner 결정에 따라 Sprint 0은 아래 3개가 모두 성공해야 DONE 처리된다.
#   AC-1  Xcode에서 프로젝트가 열린다
#   AC-2  iOS Simulator 대상 build 성공
#   AC-6  Unit Test 성공
#
# 프로젝트 생성 우선순위 (docs/DECISIONS.md D-006):
#   1순위) XcodeGen이 있으면 ios/project.yml 기준으로 재생성한다.
#   2순위) 없으면 커밋된 ios/Shim.xcodeproj로 fallback한다.
#
# 사용법:
#   ./scripts/mac_verify.sh
#   ./scripts/mac_verify.sh --simulator "iPhone 16 Pro"
#   ./scripts/mac_verify.sh --no-xcodegen
#   ./scripts/mac_verify.sh --open
#
# 종료코드: 0 = 3개 검증 모두 성공, 그 외 = 실패

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$REPO_ROOT/ios"
PROJECT="$IOS_DIR/Shim.xcodeproj"
SCHEME="Shim"
LOG_DIR="$REPO_ROOT/build-logs"
LOG_FILE="$LOG_DIR/mac_verify_$(date +%Y%m%d_%H%M%S).log"

SIMULATOR=""
USE_XCODEGEN=1
OPEN_XCODE=0
USED_XCODEGEN=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --simulator)   SIMULATOR="${2:-}"; shift 2 ;;
        --no-xcodegen) USE_XCODEGEN=0; shift ;;
        --open)        OPEN_XCODE=1; shift ;;
        -h|--help)     sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
        *) echo "알 수 없는 옵션: $1"; exit 2 ;;
    esac
done

mkdir -p "$LOG_DIR"

# ── 출력 헬퍼 ──────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
    B=$'\033[1m'; G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; N=$'\033[0m'
else
    B=""; G=""; R=""; Y=""; N=""
fi

log()  { echo "$*" | tee -a "$LOG_FILE"; }
step() { log ""; log "${B}▶ $*${N}"; }
pass() { log "${G}  ✓ $*${N}"; }
warn() { log "${Y}  ! $*${N}"; }
die()  {
    log ""
    log "${R}✗ 실패: $*${N}"
    log ""
    log "전체 로그: $LOG_FILE"
    log ""
    log "이 로그 파일과 아래 정보를 전달하면 원인을 분석해 수정한다:"
    log "  1. 실패 단계: $CURRENT_STEP"
    log "  2. 오류 메시지 (로그의 'error:' 줄)"
    log "  3. xcodebuild -version 출력"
    exit 1
}

CURRENT_STEP="시작"

log "========================================================================"
log "「쉼」 Sprint 0 — Mac 검증"
log "실행 시각: $(date '+%Y-%m-%d %H:%M:%S %Z')"
log "저장소:    $REPO_ROOT"
log "로그:      $LOG_FILE"
log "========================================================================"

# ── 0. 사전 확인 ──────────────────────────────────────────────────────
CURRENT_STEP="0. 사전 환경 확인"
step "$CURRENT_STEP"

[[ "$(uname -s)" == "Darwin" ]] || die "macOS가 아니다 (uname -s = $(uname -s)). 이 스크립트는 Mac에서만 동작한다."
pass "macOS 확인"

command -v xcodebuild >/dev/null 2>&1 || die "xcodebuild를 찾을 수 없다. Xcode와 Command Line Tools를 설치할 것."

XCODE_VERSION_RAW="$(xcodebuild -version 2>&1 | head -2 | tr '\n' ' ')"
log "    $XCODE_VERSION_RAW"
XCODE_MAJOR="$(xcodebuild -version 2>/dev/null | sed -n 's/^Xcode \([0-9]*\).*/\1/p')"
if [[ -z "$XCODE_MAJOR" ]]; then
    warn "Xcode 버전을 파싱하지 못했다. 계속 진행한다."
elif (( XCODE_MAJOR < 16 )); then
    warn "Xcode $XCODE_MAJOR 감지됨. 커밋된 project.pbxproj는 objectVersion 77(Xcode 16+)이라 열리지 않을 수 있다."
    warn "이 경우 XcodeGen 재생성 경로가 필수다 (D-006)."
else
    pass "Xcode $XCODE_MAJOR (16 이상)"
fi

xcrun simctl help >/dev/null 2>&1 || die "xcrun simctl을 사용할 수 없다. 'sudo xcode-select --switch /Applications/Xcode.app' 확인."
pass "xcrun simctl 사용 가능"

# ── 1. 프로젝트 생성 / 확보 ───────────────────────────────────────────
CURRENT_STEP="1. 프로젝트 생성 (XcodeGen 우선)"
step "$CURRENT_STEP"

if (( USE_XCODEGEN )) && command -v xcodegen >/dev/null 2>&1; then
    log "    $(xcodegen --version 2>&1 | head -1)"
    log "    ios/project.yml 기준으로 재생성한다 (D-006 우선 경로)"
    if (cd "$IOS_DIR" && xcodegen generate) >>"$LOG_FILE" 2>&1; then
        USED_XCODEGEN=1
        pass "xcodegen generate 성공 → $PROJECT"
    else
        log ""
        tail -30 "$LOG_FILE"
        die "xcodegen generate 실패. ios/project.yml 확인 필요."
    fi
elif (( USE_XCODEGEN )); then
    warn "XcodeGen 미설치. 커밋된 ios/Shim.xcodeproj로 fallback한다."
    warn "권장: brew install xcodegen  후 재실행 (D-006)"
else
    warn "--no-xcodegen 지정됨. 커밋된 ios/Shim.xcodeproj로 검증한다."
fi

[[ -d "$PROJECT" ]] || die "$PROJECT 가 없다."
[[ -f "$PROJECT/project.pbxproj" ]] || die "$PROJECT/project.pbxproj 가 없다."
pass "프로젝트 존재 확인"

# ── 2. AC-1 : Xcode가 프로젝트를 읽을 수 있는가 ───────────────────────
CURRENT_STEP="2. AC-1 — Xcode 프로젝트 열기"
step "$CURRENT_STEP  (AC-1)"

# xcodebuild -list 는 Xcode의 프로젝트 파서를 그대로 사용한다.
# 여기서 성공하면 Xcode가 프로젝트를 해석할 수 있다는 뜻이다.
if LIST_OUT="$(xcodebuild -list -project "$PROJECT" 2>&1)"; then
    echo "$LIST_OUT" >> "$LOG_FILE"
    pass "xcodebuild가 프로젝트를 파싱했다"
else
    log "$LIST_OUT"
    die "프로젝트를 파싱할 수 없다. Xcode가 이 프로젝트를 열 수 없다는 뜻이다."
fi

echo "$LIST_OUT" | grep -q "Shim" || die "타깃 'Shim'을 찾을 수 없다."
pass "타깃 'Shim' 확인"
echo "$LIST_OUT" | grep -q "ShimTests" || die "타깃 'ShimTests'를 찾을 수 없다."
pass "타깃 'ShimTests' 확인"
echo "$LIST_OUT" | grep -A20 "Schemes:" | grep -q "Shim" || die "스킴 'Shim'을 찾을 수 없다."
pass "스킴 'Shim' 확인"

# ── 3. Simulator 선택 ─────────────────────────────────────────────────
CURRENT_STEP="3. Simulator 탐지"
step "$CURRENT_STEP"

if [[ -z "$SIMULATOR" ]]; then
    # 사용 가능한 iPhone 시뮬레이터 중 마지막(대체로 최신) 항목을 고른다.
    SIMULATOR="$(xcrun simctl list devices available 2>/dev/null \
        | grep -E '^\s+iPhone' \
        | sed -E 's/^[[:space:]]+([^(]+) \(.*/\1/' \
        | sed -E 's/[[:space:]]+$//' \
        | tail -1)"
fi

[[ -n "$SIMULATOR" ]] || die "사용 가능한 iPhone Simulator가 없다. Xcode > Settings > Components 에서 iOS 런타임을 설치할 것."
pass "Simulator: $SIMULATOR"
DESTINATION="platform=iOS Simulator,name=$SIMULATOR"

# ── 4. AC-2 : Simulator 빌드 ──────────────────────────────────────────
CURRENT_STEP="4. AC-2 — Simulator 대상 build"
step "$CURRENT_STEP  (AC-2)"
log "    xcodebuild build -scheme $SCHEME -destination '$DESTINATION'"

if xcodebuild build \
        -project "$PROJECT" \
        -scheme "$SCHEME" \
        -destination "$DESTINATION" \
        >>"$LOG_FILE" 2>&1; then
    pass "** BUILD SUCCEEDED **"
else
    log ""
    log "── 빌드 오류 ──────────────────────────────────────────"
    grep -E "(error|warning):" "$LOG_FILE" | tail -25
    log "───────────────────────────────────────────────────────"
    die "Simulator 빌드 실패 (AC-2)"
fi

# ── 5. AC-6 : Unit Test ───────────────────────────────────────────────
CURRENT_STEP="5. AC-6 — Unit Test"
step "$CURRENT_STEP  (AC-6)"
log "    xcodebuild test -scheme $SCHEME -destination '$DESTINATION'"

if xcodebuild test \
        -project "$PROJECT" \
        -scheme "$SCHEME" \
        -destination "$DESTINATION" \
        >>"$LOG_FILE" 2>&1; then
    pass "** TEST SUCCEEDED **"
    grep -E "Test Case .* (passed|failed)" "$LOG_FILE" | tail -10 | while read -r line; do
        log "      $line"
    done
else
    log ""
    log "── 테스트 실패 ────────────────────────────────────────"
    grep -E "(error:|Test Case .* failed|failed to|XCTAssert)" "$LOG_FILE" | tail -25
    log "───────────────────────────────────────────────────────"
    die "Unit Test 실패 (AC-6)"
fi

# ── 결과 ──────────────────────────────────────────────────────────────
log ""
log "========================================================================"
log "${G}${B}Sprint 0 Mac 검증 3개 항목 모두 통과${N}"
log "========================================================================"
log "  AC-1  Xcode 프로젝트 열기      ✓"
log "  AC-2  Simulator build          ✓"
log "  AC-6  Unit Test                ✓"
log ""
log "  Xcode:      $XCODE_VERSION_RAW"
log "  Simulator:  $SIMULATOR"
if (( USED_XCODEGEN )); then
    log "  프로젝트:   XcodeGen 재생성 (ios/project.yml 기준)"
else
    log "  프로젝트:   커밋된 ios/Shim.xcodeproj (XcodeGen 미사용)"
fi
log "  로그:       $LOG_FILE"
log ""

if (( USED_XCODEGEN )); then
    if ! git -C "$REPO_ROOT" diff --quiet -- ios/Shim.xcodeproj 2>/dev/null; then
        log "${Y}참고: xcodegen generate 로 ios/Shim.xcodeproj 가 변경되었다.${N}"
        log "      생성된 프로젝트가 기준이므로 이 변경을 커밋할 것 (D-006):"
        log "        git add ios/Shim.xcodeproj"
        log "        git commit -m \"chore: regenerate Xcode project with XcodeGen\""
        log ""
    fi
fi

log "다음 단계: 위 결과를 전달하면 Sprint 0을 DONE 처리하고 Sprint 1 계획을 제시한다."
log ""

if (( OPEN_XCODE )); then
    open "$PROJECT"
fi

exit 0
