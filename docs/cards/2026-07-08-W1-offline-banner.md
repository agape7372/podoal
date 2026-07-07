상태: 검증대기

## W1-offline-banner: 오프라인 상태 배너 (GAP-07)

- 분류: UX(제안-2 채택) / Severity Med(채움 실패가 버그로 오인 — P01·P06) / 배정: **sonnet**
- 필독: `docs/PRINCIPLES.md` §5(UI 체크리스트 — z-index 사다리·transition-all 금지)

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/components/OfflineBanner.tsx` (신규)
- `src/app/(app)/layout.tsx`

### 문제/배경
오프라인에서 알 채우기가 실패해도 아무 안내가 없어 사용자가 앱 버그로 오인(PERSONA_REVIEW GAP-07, P01 "앱 탓인 줄"). 오프라인 채우기 자체(백로그, 위험 高)는 범위 밖 — **상태 고지만** 한다.

### 스펙 (시험 가능한 문장)
1. `OfflineBanner`: `navigator.onLine` 초기값 + `window` `online`/`offline` 이벤트 구독(cleanup 필수). SSR 안전(`'use client'` + 초기 렌더는 온라인 가정, 마운트 후 판정 — hydration mismatch 금지).
2. 오프라인일 때만 렌더: 화면 **상단 고정** 슬림 배너(`fixed top-0 inset-x-0`), 중앙 정렬 텍스트 "지금은 오프라인이에요 · 연결되면 다시 채울 수 있어요" + EmojiIcon 📡 또는 ☁. 스타일: clay 톤(밝은 배경 + `text-warm-text`), 붉은색·경고색 금지(처벌 금지 톤 — PRINCIPLES §1).
3. z-index: `z-[60]` (Nav z-50 위, 모달 z-[90] 아래). safe-area: `pt-[env(safe-area-inset-top)]` 반영.
4. 온라인 복귀 시 배너 제거(간단 제거 — 복귀 축하 토스트 등 추가 금지).
5. `role="status"` + `aria-live="polite"`.
6. 등장/퇴장 모션 쓰면 `transition-[transform,opacity]`만(전역 reduced-motion 백스톱 존재 — per-animation 가드 금지).
7. `(app)/layout.tsx`에 1회 마운트(웰컴 페이지는 범위 밖).

### 제약
- 신규 카피는 신규 표면이라 허용 — 위 문구 그대로 사용(자체 창작 금지).
- 레이아웃 불변식: 본문 padding 변경 금지(배너는 overlay, 문서 흐름 밖).
- `Date.now` 폴링·setInterval 금지 — 이벤트 구동만.

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- 코드 트레이스 로그: ①이벤트 리스너 등록/해제 대칭 ②hydration 안전 근거(초기 상태) ③z-index 값.
- (DevTools 오프라인 에뮬 런타임 확인은 페이블이 병합 후 수행.)

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**

### 검증 로그 (2026-07-08)

**변경 파일**
- `src/components/OfflineBanner.tsx` (신규)
- `src/app/(app)/layout.tsx` (import 1줄 + `<OfflineBanner />` 마운트 1줄)

**명령 검증**
- `npx tsc --noEmit` → 에러 0, exit 0.
- `npm run lint` → `eslint .`: 0 errors / 22 warnings(전부 기존 `react-hooks/set-state-in-effect` — CLAUDE.md에 명시된 대로 이 룰은 `warn`이며 앱 전역의 fetch-on-mount 패턴에 기인, `OfflineBanner.tsx:20`의 `setIsOnline(navigator.onLine)`도 동일 계열로 신규 회귀 아님) / exit 0. 이어서 `check-icons.mjs` → "✓ 모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음 · 선택지 배열 커버됨" / exit 0.
- `git status`로 owned 파일 밖 미변경 확인(`layout.tsx` diff = import 1줄 + 마운트 1줄만, 신규 파일 1개).

**코드 트레이스 로그**
1. **이벤트 리스너 등록/해제 대칭**: `useEffect` 내부에서 `window.addEventListener('online', handleOnline)` + `addEventListener('offline', handleOffline)` 등록 → cleanup 함수에서 동일 레퍼런스로 `removeEventListener` 2건 대칭 해제(`OfflineBanner.tsx:20-27`). 의존성 배열 `[]`로 마운트 1회만 등록.
2. **hydration 안전 근거**: `useState(true)`(온라인 가정)로 초기화 → 서버 렌더(항상 null 반환) 및 클라이언트 첫 렌더(마운트 전, 이펙트 미실행) 둘 다 "배너 없음"으로 일치. 실제 오프라인 여부는 `useEffect` 내부 `setIsOnline(navigator.onLine)`이 커밋 이후에 재확정 — React가 하이드레이션 완료 후 별도 렌더로 처리하므로 mismatch 없음(InstallPrompt.tsx의 `mode` state와 동일 패턴).
3. **z-index 값**: `z-[60]` 사용 확인(`OfflineBanner.tsx` 39번째 줄 부근 className) — Navigation `z-50` 위, 모달 `z-[90]` 아래, PRINCIPLES §5 사다리 준수. FAB `z-40`과도 충돌 없음.

**스펙 이탈 사유 (1건)**
- 스펙 §2의 `EmojiIcon 📡 또는 ☁` 미채택. 두 이모지 모두 `public/icons/fluent/`에 대응 SVG가 없음(`1f4e1.svg`, `2601.svg` 부재 확인) → `EmojiIcon` 경유 시 `check-icons.mjs`가 커버리지 실패로 `npm run lint`를 실패시킴(검증법에 명시된 필수 게이트). 아이콘 SVG 자산 추가는 이 카드의 소유 파일 목록 밖이라 이번 스코프에서 생성 불가. 대체로 `InstallPrompt.tsx`의 닫기 아이콘과 동일한 관례(인라인 stroke SVG, `currentColor`)로 "신호 없음" 막대+사선 아이콘을 자체 구현(`aria-hidden="true"`, 텍스트가 실제 접근성 콘텐츠). 문구 자체는 스펙 그대로 사용(자체 창작 없음). 후속 조치로 `mcp__ccd_session__spawn_task`에 아이콘 자산 추가 작업을 별도 플래그함.
- 모션(스펙 §6)은 미적용하지 않고 기존 `.animate-fade-in`(`fadeInUp` 키프레임, opacity+translateY만 사용, 전역 reduced-motion 백스톱 적용 대상)으로 마운트 진입 모션만 부여 — `transition-*` 유틸리티는 상태 전환이 아닌 mount/unmount라 데드 클래스가 되어 추가하지 않음. 퇴장은 스펙 §4대로 즉시 unmount(간단 제거).
