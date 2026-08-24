# 저장소 이전 절차 — `musi0905-cloud/App` → `musi0905-cloud/shim-ios`

> Product Owner 결정 (2026-08-24, `docs/DECISIONS.md` D-002):
> 「쉼」 iOS 프로젝트를 기존 Apps Script 저장소와 분리해 새 저장소 `shim-ios`로 이전한다.
> 기존 Apps Script 파일은 이동하거나 수정하지 않는다.
>
> **이 파일은 이전이 완료되면 삭제한다.**

---

## 현재 상태

| 단계 | 상태 |
|---|---|
| 1. 이전 대상 파일 확정 | ✅ 완료 |
| 2. 새 저장소 `musi0905-cloud/shim-ios` 생성 | ❌ **BLOCKED — Product Owner 조치 필요** |
| 3. 「쉼」 파일을 새 저장소로 push | ⏳ 2번 완료 후 진행 |
| 4. `App` 브랜치에서 「쉼」 파일 제거 | ⏳ 3번 확인 후 진행 |

### 2번이 BLOCKED인 이유

Claude Code 세션의 GitHub App 통합에 저장소 생성 권한이 없다.

```
POST https://api.github.com/user/repos
→ 403 Resource not accessible by integration
```

이 세션의 GitHub 접근 범위는 `musi0905-cloud/app` 하나로 한정돼 있다. 우회 방법은 없다.

---

## Product Owner가 할 일 (1분)

### 빈 저장소 생성

https://github.com/new 에서:

| 항목 | 값 |
|---|---|
| Repository name | `shim-ios` |
| Description | `「쉼」 — 힘든 순간에 필요한 몇 분을 대신 설계하고 실행해주는 AI 기반 쉼 서비스 (iOS)` |
| Visibility | **Private** 권장 (Public도 무방 — 시크릿은 커밋되지 않았다) |
| Add a README file | **체크 해제** |
| Add .gitignore | **None** |
| Choose a license | **None** (B-004로 별도 결정) |

> ⚠️ README·.gitignore·license를 **초기화하지 말 것.** 빈 저장소여야 이전 이력이 깨끗하게 들어간다.

### 생성 후

다음 중 하나를 선택한다.

---

## 방법 A — Claude Code가 push (권장)

저장소를 만든 뒤 세션에 **"shim-ios 만들었다"** 라고 알려주면 된다.

Claude Code가 수행할 작업:
1. `add_repo`로 `musi0905-cloud/shim-ios`를 세션에 연결
2. 「쉼」 파일만 담은 커밋을 새 저장소의 `main` 브랜치에 push
3. push 성공 확인
4. `App` 저장소의 `claude/shim-ios-sprint-0-setup-aalbvo` 브랜치에서 「쉼」 파일 제거
   (Apps Script 파일 5개는 그대로 유지)
5. 결과 보고

---

## 방법 B — Product Owner가 직접 push

Mac 또는 로컬 터미널에서:

```bash
# 1. 현재 작업물이 있는 App 저장소를 clone
git clone --branch claude/shim-ios-sprint-0-setup-aalbvo \
  https://github.com/musi0905-cloud/App.git shim-migration
cd shim-migration

# 2. Apps Script 파일 제거 — 「쉼」 파일만 남긴다
git rm -q Code.gs Index.html Scripts.html Styles.html appsscript.json
git rm -q MIGRATION.md          # 이전이 끝나면 필요 없다

# 3. 새 저장소용 초기 커밋으로 정리
#    (기존 Apps Script 커밋 이력은 가져가지 않는다)
rm -rf .git
git init -b main
git add -A
git commit -m "chore: initial import of 쉼 iOS project (Sprint 0)

musi0905-cloud/App 에서 「쉼」 관련 파일만 분리해 옮긴다 (D-002).
기존 Google Apps Script 프로젝트는 App 저장소에 그대로 둔다.

Sprint 0 상태: BLOCKED — Mac에서 AC-1/AC-2/AC-6 검증 대기.
검증 방법은 README.md 「Mac 검증 절차」 참고."

# 4. 새 저장소로 push
git remote add origin https://github.com/musi0905-cloud/shim-ios.git
git push -u origin main

# 5. 정합성 확인
python3 scripts/verify_repo.py     # 통과 25+ / 실패 0 이어야 한다
```

push가 끝나면 그 사실을 세션에 알려준다.
Claude Code가 `App` 브랜치에서 「쉼」 파일을 제거하는 정리 작업을 수행한다.

---

## 이전 대상 파일 (18개)

```
CLAUDE.md
README.md
.gitignore
docs/PRODUCT.md
docs/IOS_SPEC.md
docs/SPRINTS.md
docs/DECISIONS.md
scripts/verify_repo.py
scripts/mac_verify.sh
ios/project.yml
ios/Shim.xcodeproj/project.pbxproj
ios/Shim.xcodeproj/xcshareddata/xcschemes/Shim.xcscheme
ios/Shim/ShimApp.swift
ios/Shim/RootView.swift
ios/Shim/Assets.xcassets/Contents.json
ios/Shim/Assets.xcassets/AppIcon.appiconset/Contents.json
ios/Shim/Assets.xcassets/AccentColor.colorset/Contents.json
ios/ShimTests/ShimSmokeTests.swift
```

## 이전하지 않는 파일 — `musi0905-cloud/App`에 그대로 둔다

```
Code.gs
Index.html
Scripts.html
Styles.html
appsscript.json
```

---

## 이전 완료 후 정리

1. `App` 저장소의 `claude/shim-ios-sprint-0-setup-aalbvo` 브랜치에서 「쉼」 파일 제거
   - 이 브랜치는 `App`의 기본 브랜치에 병합된 적이 없으므로 Apps Script 프로젝트에는 영향이 없다
   - **새 저장소 push가 확인된 뒤에만 수행한다** (먼저 지우면 작업물이 어디에도 남지 않는다)
2. `shim-ios`에서 이 `MIGRATION.md` 삭제
3. `docs/DECISIONS.md` D-002 상태를 `확정 / 이전 완료`로 갱신
4. `docs/SPRINTS.md`의 "추가 미완 항목"에서 저장소 생성 항목 제거
