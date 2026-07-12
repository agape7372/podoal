상태: 완료 (2026-07-13 — 게이트 7항. **이탈(상위 수정)**: '/home' precache는 죽은 코드가 아니라 navigate 오프라인 폴백(sw.js:81 `caches.match('/home')`)의 소스 — '/'만 제거하고 '/home'은 유지, 주석에 근거 명문화. CACHE_VERSION 범프는 유지. 프로드 배포 후 DevTools에서 신 캐시 확인 항목)

## FE-4: SW 캐시 정리 + 보상 자동개봉 타이밍 상수화 (F15·F17)

- Severity: Med(캐시 위생·타이밍 결합) / 분류: 인프라·버그예방 / 배정: opus (sw.js는 opus 티어)
- 필독: CLAUDE.md PWA 절(sw.js fetch 전략·CACHE_VERSION 범프 규칙), PLAYBOOK 버그 클래스 3(SW 캐시 stale), REVIEW_CHECKLIST 게이트 7

### 소유 파일 (이 목록 밖 수정 시 반려)
- `public/sw.js`
- `src/app/(app)/board/[id]/page.tsx`
- `src/components/GrapeBoard.tsx`

### 문제/재현
1. **F15** sw.js:4,6: `CACHE_VERSION='2026-07-03-art-infra'`가 이후 캐싱 관련 변경에도 정체. `APP_SHELL`에 `'/'`,`'/home'` precache — HTML navigation이 network-first로 바뀐 현행 전략에서 죽은 코드(혼동 유발).
2. **F17** board/[id]:535,557: 완성 보상 자동개봉이 `setTimeout(…, 2400)` 하드코딩 — 축하 연출의 사운드/컨페티 비트(임팩트+1650ms, 정본 GrapeBoard.tsx:479)와 암묵 결합. 연출 타이밍 변경 시 두 상수가 조용히 어긋남.

### 스펙 (시험 가능한 문장)
- F15: `APP_SHELL`에서 `'/'`·`'/home'` 제거(`'/manifest.json'` 등 정적 자산은 유지), `CACHE_VERSION`을 `'2026-07-13-shell-cleanup'`으로 범프. fetch 전략 로직 자체는 불변.
- F17: GrapeBoard에서 축하 비트 상수를 export (예: `export const CELEBRATION_PEAK_MS = 1650` — 기존 479 라인의 리터럴을 이 상수로 치환). board/[id]의 `2400`을 `CELEBRATION_PEAK_MS + 750`으로 파생. **타임라인 로직·연출 코드 무변경 — 상수 추출만.** StrictMode 이중 실행 가드(aliveRef 등) 불변.

### 제약
- sw.js 캐싱 변경 = CACHE_VERSION 범프 필수 (게이트 7 명문).
- GrapeBoard는 낙관 채움·600ms isJustFilled 커플링 핫존 — 상수 export 외 접근 금지.
- 오프라인 폴백 경로 확인: precache 제거 후에도 아이콘·manifest는 cache-first 유지.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test
# 수동: DevTools Application → 구 캐시 삭제·새 CACHE_VERSION 등록 확인, 보드 완성 축하→보상 자동개봉 박자(임팩트 후 ~0.75초) 유지
```

### 보고 전 자가검증
각 주장을 이 세션의 도구 결과와 대조 — 증거를 가리킬 수 있는 작업만 보고. 검증 안 된 것은 "미검증" 명시. 테스트 실패는 출력과 함께.

### 산출
diff + 검증 로그. **커밋 금지** (git add도 금지 — 페이블이 수행).
