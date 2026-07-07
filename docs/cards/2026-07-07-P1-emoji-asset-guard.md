상태: 완료 (2026-07-07 — 페이블 diff 검수·실렌더 재확인 통과, 반려 0회)

## P1: 이모지 선택지 ↔ fluent 자산 동기 검사 (check-icons 확장)

- Severity/분류: Low(위생 — 재발 방지 자동화) / 배정: haiku 또는 sonnet
- 필독: `scripts/check-icons.mjs` 전체(기존 검사 방식 모방), PRINCIPLES §9(diff 최소주의)
- 소유 파일 (이 목록 밖 수정 시 반려):
  - scripts/check-icons.mjs

### 배경 (자립 설명)

2026-07-06 워크스루에서 seed 메시지의 🏋️ 이모지가 `public/icons/fluent/`(118종 flat SVG)에 없어 콘솔 경고+아이콘 미표시가 났다(seed는 💪로 교체 완료 — `docs/cards/2026-07-06-W2-walkthrough.md` 발견 1). 같은 사고가 **이모지 선택지 UI**(응원 보내기 CheerModal의 이모지 팔레트, plant-gift 모달의 emoji 선택 등)에서 재발할 수 있다 — 선택지에 있는 이모지가 자산에 없으면 사용자가 고른 순간 같은 증상.

`scripts/check-icons.mjs`는 `npm run lint`에 이미 물려 있는 검사기다(생이모지 JSX 사용 검출). 여기에 "코드의 이모지 선택지 배열에 등장하는 모든 이모지가 fluent SVG 자산을 갖는지" 검사를 추가한다.

### 스펙 (시험 가능)

1. 검사 대상: `src/**` 안에서 이모지 선택지로 쓰이는 상수 배열(예: CheerModal의 이모지 목록 — grep으로 실제 위치·이름 확인 후 카드에 기록하고 진행). 하드코딩 경로 나열이 아니라, 기존 check-icons의 파일 스캔 방식과 같은 방식으로 이모지 리터럴을 수집해도 된다 — 단 **기존 검사와 중복 보고하지 않게** 분리된 섹션으로.
2. 각 이모지 → 코드포인트 변환(기존 스크립트에 변환 로직 있으면 재사용) → `public/icons/fluent/<codepoint>.svg` 존재 확인.
3. 누락 발견 시: 파일·이모지·기대 SVG 경로를 출력하고 **exit 1** (lint 실패로 이어져 CI에서 차단).
4. 현재 코드베이스 기준 통과해야 한다(누락 0이어야 정상 — 만약 기존 누락이 발견되면 고치지 말고 카드에 목록만 기록하고 보고).

### 검증법

1. `node scripts/check-icons.mjs` → 통과.
2. 임시로 아무 선택지에 🏋️ 추가 → 실행 → 실패+경로 출력 확인 → 원복.
3. `npm run lint` 전체 통과.

### 산출: diff + 검증 로그(2번 실패 출력 포함). **커밋 금지**.
