# podoal 개발 원칙 — "페이블처럼 판단하기"

> 이 문서의 목적: **어떤 모델이 작업하든** podoal에서 같은 판단을 재현하게 하는 실행 가능한 규칙. 산문이 아니라 결정 트리·체크리스트·표. 리트머스: *하위모델이 이 문서만 보고 2026-07-05 감사(`docs/audit/AUDIT-2026-07-05.md`)의 발견을 같은 severity로 트리아지할 수 있는가.*
>
> 함께 읽기: 컨벤션 원본 `CLAUDE.md`, 운영 `docs/PLAYBOOK.md`, 로드맵 `docs/ROADMAP.md`, 커밋 전 `docs/REVIEW_CHECKLIST.md`.

## 0. 작업 유형 → 참조 매핑

| 하려는 것 | 먼저 읽을 곳 |
|-----------|-------------|
| UI 시각/모션 변경 | §5 UI 체크리스트 + CLAUDE.md 스타일 섹션 |
| API·스키마·auth 변경 | §3 데이터 레이어 게이트 + §4 스키마 절차 |
| 버그 수정 | §2 변경 분류기 → §6 건드리면 부서지는 곳 |
| 카피·문구 변경 | §7 콘텐츠 정책 |
| 수익화 | `docs/MONETIZATION_PLAN.md` §5 가드레일 |
| 감사·리뷰 | §8 트리아지 기준 + PLAYBOOK 서브에이전트 규약 |

## 1. 제품 원칙 (무엇을 만드는가)

1. **디자인이 변화를 말한다.** podoal은 습관 추적 PWA를 클레이모피즘으로 재해석한 것. 기능이 아니라 만듦새(포도알 채우는 촉감, 히트스톱, 액체 차오름)가 제품의 정체성.
2. **진행은 마찰 없이·무료로.** 알 채우기·보상·릴레이·와이너리·통계는 결제·광고·강제 뒤에 두지 않는다(수익화는 코스메틱만 — MONETIZATION_PLAN §5).
3. **친구 기반 소셜.** 응원·선물·깜짝선물·릴레이는 accepted 친구 사이에서만. 새 소셜 라우트는 반드시 친구 관계를 검증한다(PA-006이 이걸 놓쳤던 사례).
4. **ADHD 가드레일.** 알림은 적게(데일리 넛지 opt-in 기본 꺼짐, DND 존중). 압박·만료·가챠 금지.

## 2. 변경 분류기 (결정 트리)

```
무엇을 바꾸려는가?
├─ 픽셀·모션·레이아웃만 → §5 UI 체크리스트. 데이터 레이어 안 건드림.
├─ API 동작·검증·권한 → §3 데이터 레이어 게이트 통과 필수.
├─ Prisma 스키마 → §4 마이그레이션 절차(단독 작업·신중).
├─ 카피·네이밍·티어·템플릿 → §7. 원칙적 불변, 예외는 명시 승인만.
└─ 문서/설정 → 자유롭게, 단 §6의 .env.example 동기 규칙.
```

## 3. 데이터 레이어 변경 게이트 (구 CLAUDE.md "do not modify" 현행화)

과거 CLAUDE.md는 데이터 레이어(Prisma 스키마·`/api/*`·`auth.ts`·`oauth.ts`·`store.ts` 키·`feedback.ts` 시그니처·seed·env명) 전면 수정 금지였다. 리디자인기 규칙이었고, 2026-07-05 감사에서 **실버그 수정은 허용**으로 사용자가 갱신했다. 현행 규칙:

**허용 (게이트 통과 시)**:
- 검증된 실버그 수정 — **재현 절차 필수**(감사 보고서 또는 재현 스크립트). 예: 입력 검증 누락으로 500(PA-002/003), 권한 게이트 누락(PA-006).
- 가드·입력 검증 추가(방어적).
- **additive** 신규 필드/테이블(nullable, 기존 응답 계약 불변).

**금지 (사용자 명시 승인 없이는 절대)**:
- 기존 키/함수 시그니처/env 변수명 **rename**.
- `store.ts` localStorage 키(`podoal-app-settings`·`podoal-feedback-settings`) 변경 — 사용자 데이터 유실.
- API 응답 필드 **제거**(클라 계약 파괴).

**변경 시 필수 체크리스트**:
- [ ] `getCurrentUserId()` + `authResponse()` 가드 패턴 유지
- [ ] 입력 검증은 `src/lib/validate.ts` 헬퍼 또는 동일 스타일(타입+길이+범위)
- [ ] 404(없음) vs 403(권한 없음) 구분 — 단 리소스 존재를 프로빙당하는 곳은 균일 403(plant-gift/board GET 선례)
- [ ] 에러 문구 한국어 해요체
- [ ] 직렬화 충돌은 `isSerializationConflict()`(src/lib/fillBoard.ts)로 감지 — `e.code==='P2034'` 단독 금지
- [ ] 수정 함수의 **호출자 전수** grep(부수효과 확인)
- [ ] 소셜 라우트면 accepted Friendship 양방향 OR 검증(패턴: gift/route.ts:53)

## 4. 스키마 변경 절차

1. `prisma/schema.prisma` 수정 → additive 우선(nullable 컬럼·신규 테이블).
2. 로컬 Docker Postgres 기동(`docker start podoal-pg`) → `npx prisma migrate dev --name <요약>` → `npx prisma generate`(v7는 자동 아님).
3. 생성된 `prisma/migrations/<...>` 디렉토리 커밋. CI/prod는 `migrate deploy`로 적용.
4. 상세: `docs/MIGRATIONS.md`. **스키마 카드는 서브에이전트 단독 웨이브(generate가 전역 영향)·opus 배정.**

## 5. UI 변경 체크리스트

- **모션 토큰**: 이징 `--ease-standard`(이동)/`--ease-backout`(오버슈트), duration `--motion-fast/base/slow`. **신규 코드 `transition-all` 금지** — 변하는 속성만 명시(`transition-[transform,box-shadow]`). 진행바는 `width` 아닌 `scaleX()`. 신규 키프레임은 고유 이름(@theme 동명 가림 회귀 선례).
- **모달**: 공용 `Modal` variant(sheet/center) 사용, 닫기는 `useModalClose(onClose).requestClose`로 이탈 애니 경유.
- **a11y (재추가 금지 — 전역 백스톱 있음)**: 전역 `:focus-visible` 링·`prefers-reduced-motion` 백스톱이 globals.css에 있음. per-element focus·per-animation 가드 추가 금지. 본문 텍스트는 `text-warm-sub`(text-warm-light는 AA 미달·장식 전용). 숫자에 `tabular-nums`. `window.confirm` 대신 `<ConfirmDialog>`.
- **레이아웃 불변식 7종 (어기면 2026-05-25 UI 버그 재발)**:
  1. `overflow-x-auto` 컨테이너엔 `py-{≥2}`(overflow-y 자동승격 클립 방지)
  2. `ring-{n}` 자식은 컨테이너 패딩 ≥ n+1
  3. `(app)/layout.tsx` `pb-[160px]` = Navigation+InstallPrompt 커버(높이 바뀌면 동반 수정)
  4. z-index 사다리: Nav z-50 > FAB z-40 > InstallPrompt z-30, 모달 z-[90]. z-40 재사용 금지
  5. 스크롤 모달 영역(`flex-1 overflow-y-auto`)에 `pb-4`
  6. GrapeStem 잎은 bunch 위 **양수** marginBottom(음수 금지)
  7. 잎 크기 = `grapeSize*1.5`(하드코딩 px 금지, 2×알 초과 금지)
- **Tailwind v4**: `tailwind.config.ts` 재생성 금지(@theme in globals.css). `@source` 글롭에 `src/lib/**` 추가 금지(winery 티어 글로우 회귀).

## 6. 건드리면 부서지는 곳 지도 (회귀 이력 기반)

| 영역 | 위험 | 수정 시 필수 |
|------|------|-------------|
| 홈 드래그 정렬 (#94~#103 회귀 다발) | 서버 order + 로컬 병합, 제스처 민감 | 실기기 수동 테스트: 정렬 후 새로고침 유지·연타·중간 실패 롤백 |
| SW 캐시 (`public/sw.js`) | 캐시 전략 변경 시 stale 문서 | 캐싱 변경마다 `CACHE_VERSION` 범프. HTML navigation은 network-first 유지 |
| dual-store 설정 | Zustand `podoal-app-settings` + feedback.ts `podoal-feedback-settings` 이중 저장 | 사운드 설정 변경 시 **양쪽 동시** 갱신 |
| 낙관적 채우기 | board/[id] 임시 스티커 후 POST 화해, 보상 시 재fetch | 롤백 경로·`isJustFilled` 600ms 창 보존 |
| SSE (useSSE) | 10초 폴, 4분 수명, lastCheck 스냅샷 | lastCheck를 new Date() 아닌 마지막 메시지 createdAt으로 |
| @source 글롭 | winery 티어 클래스 문자열 미스캔 | 글롭 확대 금지(별도 PR) |
| .env.example | 코드가 요구하는 env 누락 시 조용한 기능 정지(PA 사례: VAPID·CRON_SECRET 누락) | 새 env 추가 시 .env.example + PLAYBOOK 환경변수 대장 동시 갱신 |

## 7. 콘텐츠 정책

- **원칙적 불변**: 카피·티어명(포도알 새싹→포도 마스터)·38 템플릿·30 사운드·3 보상타입 라벨. 디자인이 변화를 나르지, 네이밍은 그대로.
- **승인된 예외**: 선물·공유·메시지 문구는 UX 개선 허용(2026-07-05 사용자 승인). 변경 시 현행 vs 제안 병기 후 적용.
- **이모지 정책**: 라벨에 생이모지 금지 — 아이콘은 `src/lib/icons.ts`(REWARD_TYPE_ICON), `scripts/check-icons.mjs`가 강제. 제목 표시엔 `stripTitleEmoji`.

## 8. 트리아지 기준 (감사와 단일 출처)

| Severity | 정의 | 예 |
|----------|------|----|
| **Critical** | 데이터 파괴·인증 우회·프로드 장애 | 타 유저 데이터 삭제, JWT 우회 |
| **High** | 권한 경계 침범·코어 저니 차단·데이터 정합 오류 | 타인 보드 채우기, 완주 불가 |
| **Med** | 우회 가능 오동작·자원 남용 벡터·기능 연계 단절 | 비친구 메시지(PA-006), 선물→보드 링크 없음(PA-008) |
| **Low** | 위생·문서 불일치·방어적 보강 | 입력 검증으로 500 방지(PA-002), 길이 캡(PA-007) |

**분류 규율**: 발견은 셋 중 하나 — ① 수정 카드 ② 의도적 동작(근거 기록) ③ 제안(§5→ROADMAP). "기능이 없다"는 대개 제안(수정 아님). 스코프 폭발 방지의 핵심.

## 9. 스코프 규율

- **diff 최소주의**: 요청·카드 범위 밖 리팩토링 금지. `transition-all` 잔존 같은 레거시는 "기회 있을 때 점진 치환"이지 일괄 개조 아님(모션 회귀 위험 > 이득).
- **원자 커밋**: 발견/카드당 1커밋, `type(scope): 한국어 요약` + Co-Authored-By. main 직접 커밋 시 웨이브 게이트(tsc+lint+test) 통과 후 push.
- **모든 외부 보고는 가설.** 하위모델·탐색 에이전트 보고는 코드로 재검증 후 채택(2026-07-05 감사에서 탐색 "High 2건"이 재검증 시 무효였음 — PLAYBOOK 서브에이전트 규약 참조).

## 10. 사고 프로토콜 — 가설 → 재현 → 적대 검증 (모델 무관 공통 절차)

§9의 "보고는 가설" 경고를 실행 절차로 만든 것. **버그 수정·감사·리뷰는 이 3단계를 순서대로, 단계를 건너뛰면 반려 사유.**

### 1단계 — 가설 (주장에 근거 좌표를 붙인다)

- [ ] 모든 주장("X가 원인", "Y는 안전")에 `파일:라인` 좌표가 붙어 있는가? 좌표 없는 주장은 기록하되 믿지 않는다.
- [ ] 그 좌표를 **직접 열어 읽었는가?** 탐색 에이전트 인용문은 원문과 다를 수 있다(요약 왜곡).
- [ ] 반대 증거를 한 번 찾아봤는가? (해당 함수의 호출자 grep, 같은 패턴의 다른 라우트 비교)
- 실례: 2026-07-05 감사에서 탐색이 올린 "High 2건"(메시지 스팸 벡터·NotificationSetting 우회)은 좌표를 직접 열어보니 **이미 방어 코드가 있었다**. 좌표 검증 없이 채택했다면 유령 수정 2건이 커밋됐다.

### 2단계 — 재현 (재현 없이 수정 없음)

- [ ] 실행으로 증상을 재현했는가? (dev 서버 + curl/브라우저 — 2계정 절차는 PLAYBOOK §8)
- [ ] 재현 커맨드/시나리오를 카드에 **기록**했는가? (수정 후 같은 커맨드로 소멸 확인해야 하므로)
- [ ] 재현이 안 되면: 수정하지 말고 "재현 실패" 기록 + 관찰 조건(기기·타이밍·계정 상태)을 좁혀서 보고. 재현 안 되는 수정은 추측 수정 — 회귀만 만든다.
- [ ] 재현 코드가 재사용 가치가 있으면 `scripts/repro/`에 자산화(PLAYBOOK §8).

### 3단계 — 적대 검증 (내 수정을 내가 공격한다)

수정 diff를 낸 뒤, 아래 표에서 해당하는 공격 각도로 **스스로 반례를 찾는다**. "이 수정이 틀렸다면 어디서 틀렸을까?"에 답 못 하면 검증이 안 된 것.

| 공격 각도 | 질문 | 대표 지뢰 |
|-----------|------|-----------|
| 경합 | 연타·병렬 요청·큐 드레인 중이면? | 낙관 업데이트 롤백, 직렬 큐(fillBoard), Serializable 충돌 |
| 권한 | 비친구·비주인·게스트 계정으로 같은 요청을 쏘면? | canSeeBody 마스킹, 균일 403 프로빙 방어 |
| stale | 구 캐시(SW·useCachedApi 시드)로 진입하면? | content '' 마스킹 잔존, CACHE_VERSION |
| 제스처 | 모바일 터치(캡처·slop·축잠금)에서도 같은가? | 홈 스와이프/리프트, touch-action 복원 |
| 경계값 | 0·최대·빈문자열·이모지·비정수를 넣으면? | PA-002/003 (비정수 position 500) |
| 시간 | KST 자정·DND 경계·타이머 겹침이면? | 스트릭, cron dedupe, 25s 백스톱 |
| 부수효과 | 내가 바꾼 함수의 다른 호출자는? | 호출자 전수 grep (§3 체크리스트와 동일) |

- [ ] 위 표에서 해당 각도 최소 2개를 골라 반례 시도를 **기록**했는가? (반례 없음도 기록 — "경합: 큐 드레인 중 탭 시도, 버퍼 소비로 정상")
- [ ] 검증 로그(실행 출력)를 카드에 첨부했는가? "될 것이다"는 검증이 아니다.

### 에스컬레이션 (반려 흐름 — PLAYBOOK §7과 동일)

반려 1회: 카드에 반려 사유 기록 후 같은 모델 재시도 → 반려 2회: 상위 모델로 → 3회: 최상위 모델 직접. 반려 사유가 "스펙 불명확"이면 모델이 아니라 **카드를 고친다**(카드 품질 문제).
