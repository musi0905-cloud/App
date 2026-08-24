#!/usr/bin/env python3
"""
저장소 정적 검증 스크립트 — 「쉼」 Sprint 0

이 스크립트가 검증하는 것:
  1. Sprint 0이 요구하는 기준 문서와 파일이 존재하는가
  2. Xcode 프로젝트 파일의 구조와 내부 참조가 정합한가
  3. 프로젝트가 참조하는 소스 디렉터리가 실제로 존재하는가
  4. 공유 스킴이 실제 타깃을 가리키는가
  5. XcodeGen 스펙과 pbxproj의 핵심 설정이 일치하는가
  6. 저장소에 비밀정보(API Key, 토큰, 인증서 등)가 없는가

이 스크립트가 검증하지 '않는' 것 — 매우 중요:
  * Swift 코드가 컴파일되는지        (Xcode/Swift 툴체인 필요)
  * Xcode가 프로젝트를 열 수 있는지  (macOS + Xcode 필요)
  * Simulator 빌드가 성공하는지      (macOS + Xcode 필요)
  * 유닛 테스트가 통과하는지         (macOS + Xcode 필요)

즉 이 스크립트의 PASS는 "빌드 성공"을 의미하지 않는다.
Sprint 0 Acceptance Criteria AC-1 / AC-2는 이 스크립트로 충족될 수 없다.
자세한 내용은 docs/DECISIONS.md D-001 참고.

사용법:  python3 scripts/verify_repo.py
종료코드: 0 = 전부 통과, 1 = 실패 있음
"""

from __future__ import annotations

import os
import re
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

failures: list[str] = []
warnings: list[str] = []
passes: list[str] = []


def ok(msg: str) -> None:
    passes.append(msg)


def fail(msg: str) -> None:
    failures.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def rel(*parts: str) -> str:
    return os.path.join(REPO, *parts)


def read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


# ---------------------------------------------------------------- 1. 기준 문서
def check_required_files() -> None:
    required = [
        "CLAUDE.md",
        "README.md",
        ".gitignore",
        "docs/PRODUCT.md",
        "docs/IOS_SPEC.md",
        "docs/SPRINTS.md",
        "docs/DECISIONS.md",
        "ios/project.yml",
        "ios/Shim.xcodeproj/project.pbxproj",
        "ios/Shim.xcodeproj/xcshareddata/xcschemes/Shim.xcscheme",
        "ios/Shim/ShimApp.swift",
        "ios/Shim/RootView.swift",
        "ios/Shim/Assets.xcassets/Contents.json",
        "ios/Shim/Assets.xcassets/AppIcon.appiconset/Contents.json",
        "ios/Shim/Assets.xcassets/AccentColor.colorset/Contents.json",
        "ios/ShimTests/ShimSmokeTests.swift",
        "scripts/mac_verify.sh",
    ]
    missing = [p for p in required if not os.path.exists(rel(p))]
    if missing:
        fail(f"필수 파일 누락: {', '.join(missing)}")
    else:
        ok(f"필수 파일 {len(required)}개 모두 존재")


# ------------------------------------------------- 2. CLAUDE.md 운영규칙 포함 (AC-4)
def check_claude_md() -> None:
    text = read(rel("CLAUDE.md"))
    # 운영규칙 원문의 핵심 조항이 실제로 반영됐는지 확인한다.
    required_rules = {
        "Sprint 단일 진행": "한 번에 하나의 Sprint만 수행한다",
        "다음 Sprint 선행 금지": "다음 Sprint 코드를 구현하지 않는다",
        "미테스트 완료 보고 금지": '테스트하지 않은 기능을 "완료"라고 표현하지 않는다',
        "실기기 검증 구분": "실기기 미검증",
        "API Key 금지": "API Key",
        "비공개 API 금지": "비공개 API",
        "Sprint 보고 형식": "Sprint 완료 보고 형식",
        "문제 구분 A~D": "제품 결정 필요",
    }
    missing = [name for name, needle in required_rules.items() if needle not in text]
    if missing:
        fail(f"CLAUDE.md에 운영규칙 항목 누락: {', '.join(missing)}")
    else:
        ok(f"CLAUDE.md가 운영규칙 핵심 {len(required_rules)}개 항목 포함 (AC-4)")


# ------------------------------------------------------ 3. README 빌드 방법 (AC-5)
def check_readme() -> None:
    text = read(rel("README.md"))
    needed = {
        "프로젝트 구조": "프로젝트 구조",
        "빌드 방법": "xcodebuild",
        "스킴 이름": "-scheme Shim",
        "환경 제약 명시": "Linux",
        "Mac 검증 절차": "Mac 검증 절차",
        "XcodeGen 재생성 명령": "xcodegen generate",
        "검증 자동화 스크립트": "scripts/mac_verify.sh",
        "Unit Test 검증": "xcodebuild test",
    }
    missing = [k for k, v in needed.items() if v not in text]
    if missing:
        fail(f"README.md에 항목 누락: {', '.join(missing)}")
    else:
        ok("README.md가 프로젝트 구조와 빌드 방법을 기록 (AC-5)")


# --------------------------------------------------------- 4. pbxproj 구조 검증
def check_pbxproj() -> None:
    path = rel("ios/Shim.xcodeproj/project.pbxproj")
    text = read(path)

    if not text.startswith("// !$*UTF8*$!"):
        fail("project.pbxproj: 헤더 '// !$*UTF8*$!' 없음")
        return
    ok("project.pbxproj: 헤더 정상")

    # 중괄호/괄호 균형 (주석과 문자열 안의 괄호는 제외)
    stripped = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    stripped = re.sub(r'"(?:[^"\\]|\\.)*"', '""', stripped)
    for open_ch, close_ch, label in (("{", "}", "중괄호"), ("(", ")", "괄호")):
        if stripped.count(open_ch) != stripped.count(close_ch):
            fail(
                f"project.pbxproj: {label} 불균형 "
                f"({open_ch}={stripped.count(open_ch)}, {close_ch}={stripped.count(close_ch)})"
            )
        else:
            ok(f"project.pbxproj: {label} 균형 ({stripped.count(open_ch)}쌍)")

    # 필수 isa 섹션
    required_isa = [
        "PBXProject",
        "PBXNativeTarget",
        "PBXGroup",
        "PBXFileReference",
        "PBXFileSystemSynchronizedRootGroup",
        "PBXSourcesBuildPhase",
        "PBXFrameworksBuildPhase",
        "PBXResourcesBuildPhase",
        "PBXTargetDependency",
        "PBXContainerItemProxy",
        "XCBuildConfiguration",
        "XCConfigurationList",
    ]
    missing = [isa for isa in required_isa if f"isa = {isa};" not in text]
    if missing:
        fail(f"project.pbxproj: isa 누락 {', '.join(missing)}")
    else:
        ok(f"project.pbxproj: 필수 isa 섹션 {len(required_isa)}종 존재")

    # 모든 24자리 오브젝트 ID가 정의되어 있는지 (참조만 있고 정의 없는 dangling ID 탐지)
    defined = set(re.findall(r"^\t\t([0-9A-F]{24}) ", text, flags=re.MULTILINE))
    referenced = set(re.findall(r"\b([0-9A-F]{24})\b", text))
    dangling = referenced - defined
    if dangling:
        fail(f"project.pbxproj: 정의되지 않은 오브젝트 ID 참조 {sorted(dangling)}")
    else:
        ok(f"project.pbxproj: 오브젝트 ID {len(defined)}개 모두 정의됨, dangling 참조 없음")

    # rootObject 가 PBXProject 를 가리키는가
    m = re.search(r"rootObject = ([0-9A-F]{24})", text)
    if not m:
        fail("project.pbxproj: rootObject 없음")
    elif m.group(1) not in defined:
        fail(f"project.pbxproj: rootObject {m.group(1)} 가 정의되지 않음")
    else:
        ok(f"project.pbxproj: rootObject {m.group(1)} 정상")

    # 동기화 그룹이 가리키는 디렉터리가 실제로 존재하는가
    sync_paths = re.findall(
        r"isa = PBXFileSystemSynchronizedRootGroup;\s*\n\s*path = (\w+);", text
    )
    if not sync_paths:
        fail("project.pbxproj: PBXFileSystemSynchronizedRootGroup 의 path 를 찾지 못함")
    for p in sync_paths:
        if os.path.isdir(rel("ios", p)):
            n = sum(len(f) for _, _, f in os.walk(rel("ios", p)))
            ok(f"project.pbxproj: 동기화 그룹 'ios/{p}/' 존재 (파일 {n}개)")
        else:
            fail(f"project.pbxproj: 동기화 그룹이 가리키는 'ios/{p}/' 디렉터리 없음")

    # 각 타깃에 fileSystemSynchronizedGroups 가 연결됐는가
    if text.count("fileSystemSynchronizedGroups = (") != 2:
        fail("project.pbxproj: fileSystemSynchronizedGroups 가 두 타깃 모두에 있지 않음")
    else:
        ok("project.pbxproj: 두 타깃 모두 fileSystemSynchronizedGroups 연결됨")

    # 테스트 타깃 host 설정
    if "TEST_HOST" in text and 'BUNDLE_LOADER = "$(TEST_HOST)"' in text:
        ok("project.pbxproj: 테스트 타깃 TEST_HOST / BUNDLE_LOADER 설정됨")
    else:
        fail("project.pbxproj: 테스트 타깃의 TEST_HOST 또는 BUNDLE_LOADER 누락")

    # 서명 정보가 커밋되지 않았는지 (D-004)
    teams = re.findall(r"DEVELOPMENT_TEAM = ([^;]+);", text)
    bad = [t.strip() for t in teams if t.strip() not in ('""', "")]
    if bad:
        fail(f"project.pbxproj: DEVELOPMENT_TEAM 이 비어있지 않음 {bad} — 커밋 금지 (D-004)")
    else:
        ok(f"project.pbxproj: DEVELOPMENT_TEAM 모두 비어있음 ({len(teams)}곳, D-004 준수)")

    # objectVersion 확인 및 Xcode 버전 요구사항 경고
    m = re.search(r"objectVersion = (\d+);", text)
    if m:
        ov = int(m.group(1))
        ok(f"project.pbxproj: objectVersion = {ov}")
        if ov >= 77:
            warn(
                "objectVersion 77 + PBXFileSystemSynchronizedRootGroup 은 Xcode 16 이상에서만 "
                "열린다. Xcode 15 이하라면 'cd ios && xcodegen generate' 로 재생성할 것 (D-006)."
            )
    else:
        fail("project.pbxproj: objectVersion 없음")


# ------------------------------------------------------------ 5. 공유 스킴 검증
def check_scheme() -> None:
    scheme_path = rel("ios/Shim.xcodeproj/xcshareddata/xcschemes/Shim.xcscheme")
    scheme = read(scheme_path)
    pbx = read(rel("ios/Shim.xcodeproj/project.pbxproj"))

    # XML 파싱 가능 여부
    try:
        import xml.etree.ElementTree as ET

        ET.fromstring(scheme)
        ok("Shim.xcscheme: XML 파싱 성공")
    except Exception as exc:  # noqa: BLE001
        fail(f"Shim.xcscheme: XML 파싱 실패 — {exc}")
        return

    defined = set(re.findall(r"^\t\t([0-9A-F]{24}) ", pbx, flags=re.MULTILINE))
    blueprints = set(re.findall(r'BlueprintIdentifier = "([0-9A-F]{24})"', scheme))
    if not blueprints:
        fail("Shim.xcscheme: BlueprintIdentifier 없음")
        return
    unknown = blueprints - defined
    if unknown:
        fail(f"Shim.xcscheme: pbxproj에 없는 타깃을 참조 {sorted(unknown)}")
    else:
        ok(f"Shim.xcscheme: 참조 타깃 {len(blueprints)}개 모두 pbxproj에 존재")

    for section in ("BuildAction", "TestAction", "LaunchAction"):
        if f"<{section}" not in scheme:
            fail(f"Shim.xcscheme: {section} 없음")
    if all(f"<{s}" in scheme for s in ("BuildAction", "TestAction", "LaunchAction")):
        ok("Shim.xcscheme: Build / Test / Launch 액션 모두 정의됨")

    if 'BuildableName = "ShimTests.xctest"' in scheme:
        ok("Shim.xcscheme: 테스트 번들이 TestAction 에 등록됨")
    else:
        fail("Shim.xcscheme: TestAction 에 ShimTests.xctest 없음")


# ------------------------------------------- 6. project.yml 과 pbxproj 설정 일치
def check_spec_consistency() -> None:
    yml = read(rel("ios/project.yml"))
    pbx = read(rel("ios/Shim.xcodeproj/project.pbxproj"))

    checks = [
        ("배포 타깃", r'iOS: "([\d.]+)"', yml, r"IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);", pbx),
        ("Swift 버전", r'SWIFT_VERSION: "([\d.]+)"', yml, r"SWIFT_VERSION = ([\d.]+);", pbx),
    ]
    for label, ypat, ytext, ppat, ptext in checks:
        ym = re.search(ypat, ytext)
        pms = set(re.findall(ppat, ptext))
        if not ym:
            fail(f"project.yml: {label} 값을 찾지 못함")
        elif pms != {ym.group(1)}:
            fail(f"{label} 불일치 — project.yml={ym.group(1)}, pbxproj={sorted(pms)}")
        else:
            ok(f"{label} 일치: {ym.group(1)}")

    for bid in ("com.shimapp.Shim", "com.shimapp.ShimTests"):
        if bid in yml and bid in pbx:
            ok(f"번들 ID 일치: {bid}")
        else:
            fail(f"번들 ID {bid} 가 project.yml 또는 pbxproj 에 없음")


# ----------------------------------------------------- 7. 시크릿 스캔 (AC-3)
SECRET_PATTERNS = [
    (r"sk-[A-Za-z0-9_-]{20,}", "OpenAI API Key 형식"),
    (r"sk-proj-[A-Za-z0-9_-]{20,}", "OpenAI 프로젝트 Key 형식"),
    (r"ghp_[A-Za-z0-9]{36}", "GitHub Personal Access Token"),
    (r"github_pat_[A-Za-z0-9_]{22,}", "GitHub Fine-grained Token"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
    (r"AIza[0-9A-Za-z_-]{35}", "Google API Key"),
    (r"xox[baprs]-[0-9A-Za-z-]{10,}", "Slack Token"),
    (r"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----", "개인키 블록"),
    (r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.", "JWT 형식"),
]
SECRET_FILE_NAMES = {
    ".env", "secrets.json", "Secrets.plist", "Secrets.xcconfig",
    "GoogleService-Info.plist", "google-services.json", ".clasp.json",
}
SECRET_FILE_SUFFIXES = (".p12", ".mobileprovision", ".p8", ".certSigningRequest", ".keystore", ".jks")


def tracked_files() -> list[str]:
    try:
        out = subprocess.run(
            ["git", "-C", REPO, "ls-files"],
            capture_output=True, text=True, check=True,
        ).stdout
        return [line for line in out.splitlines() if line]
    except (subprocess.CalledProcessError, FileNotFoundError):
        warn("git ls-files 실패 — 시크릿 스캔을 작업 트리 기준으로 수행")
        result = []
        for root, dirs, files in os.walk(REPO):
            dirs[:] = [d for d in dirs if d != ".git"]
            for f in files:
                result.append(os.path.relpath(os.path.join(root, f), REPO))
        return result


def check_secrets(files: list[str]) -> None:
    # 이 스크립트 자신은 탐지 패턴을 문자열로 포함하므로 스캔에서 제외한다.
    self_rel = os.path.relpath(os.path.abspath(__file__), REPO)

    hits: list[str] = []

    for f in files:
        base = os.path.basename(f)
        if base in SECRET_FILE_NAMES or f.endswith(SECRET_FILE_SUFFIXES):
            hits.append(f"{f}: 비밀정보 파일명/확장자")

    scanned = 0
    for f in files:
        if f == self_rel:
            continue
        path = os.path.join(REPO, f)
        if not os.path.isfile(path):
            continue
        try:
            if os.path.getsize(path) > 5_000_000:
                continue
            with open(path, encoding="utf-8", errors="ignore") as fh:
                content = fh.read()
        except OSError:
            continue
        scanned += 1
        for pattern, label in SECRET_PATTERNS:
            m = re.search(pattern, content)
            if m:
                line_no = content[: m.start()].count("\n") + 1
                hits.append(f"{f}:{line_no}: {label}")

    if hits:
        for h in hits:
            fail(f"시크릿 의심: {h}")
    else:
        ok(f"시크릿 스캔 통과 — 추적 파일 {scanned}개, 패턴 {len(SECRET_PATTERNS)}종 (AC-3)")


def check_gitignore() -> None:
    text = read(rel(".gitignore"))
    required = [".env", "*.p12", "*.mobileprovision", "AuthKey_*.p8", "xcuserdata/", "DerivedData/"]
    missing = [p for p in required if p not in text]
    if missing:
        fail(f".gitignore 에 항목 누락: {', '.join(missing)}")
    else:
        ok(f".gitignore 가 시크릿·빌드 산출물 패턴 {len(required)}종 포함")


# -------------------------------------------------------------------- 실행
def main() -> int:
    print("=" * 72)
    print("「쉼」 저장소 정적 검증 — Sprint 0")
    print("=" * 72)

    check_required_files()
    check_claude_md()
    check_readme()
    check_pbxproj()
    check_scheme()
    check_spec_consistency()
    check_gitignore()
    check_secrets(tracked_files())

    print()
    for p in passes:
        print(f"  PASS  {p}")
    if warnings:
        print()
        for w in warnings:
            print(f"  WARN  {w}")
    if failures:
        print()
        for f in failures:
            print(f"  FAIL  {f}")

    print()
    print("-" * 72)
    print(f"통과 {len(passes)} / 경고 {len(warnings)} / 실패 {len(failures)}")
    print("-" * 72)
    print()
    print("주의: 이 결과는 빌드 검증이 아니다.")
    print("      Xcode 열기(AC-1)와 Simulator 빌드(AC-2)는 macOS + Xcode 에서만 확인 가능하다.")
    print("      docs/DECISIONS.md D-001 참고.")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
