# podoal 운영 플레이북

> 증상 → 진단 순서 → 명령어. 세션 시작 시 읽는 순서: `CLAUDE.md` → `docs/PRINCIPLES.md` → (감사/이슈면) `docs/audit/`. 커밋 전 `docs/REVIEW_CHECKLIST.md`.

## 1. 로컬 개발 부트스트랩 (Phase 0 절차 영속화)

```bash
docker start podoal-pg                 # 로컬 Postgres 16 (localhost:5432, db=podoal)
npx prisma migrate status              # drift 0 확인
npm run db:seed                        # 샘플 데이터 (⚠ 전 테이블 deleteMany — DATABASE_URL이 localhost인지 반드시 확인)
npm run dev                            # localhost:3000
# dev 로그인: 웰컴 화면 "🛠 개발자 모드" 또는 POST /api/auth/dev (dev@podoal.com / dev1234)
# 테스트 친구 만들기: POST /api/dev/seed-friends (로그인 상태) → test1234 비번의 친구 3명 + 수락된 친구관계
```

**⚠ 시드 안전 게이트**: `prisma/seed.ts`는 전 테이블 `deleteMany`. 실행 전 `.env`의 `DATABASE_URL`이 **localhost**인지 확인(Neon 프로덕션이면 전멸). Docker 데몬이 꺼져 있으면 `docker start podoal-pg` 전에 Docker Desktop 기동 필요.

## 2. 배포

- **트리거**: `git push origin main` → Vercel 자동 배포(icn1 서울). 빌드 = `node scripts/migrate-deploy.mjs && next build`(마이그레이션 자동 적용).
- **배포 후 스모크 3종**: (1) 로그인→홈 렌더, (2) 응원 발신→수신 계정 인박스 도착, (3) 푸시 구독 왕복(설정→알림 켜기).

## 3. 인시던트 진단 트리

**"푸시가 안 와요"**
```
1. VAPID env 설정됐나?  NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (Vercel)
   → 없으면 push.ts는 조용한 no-op. docs/PUSH_SETUP.md 절차로 설정.
2. 수신자 NotificationSetting: globalEnabled? 카테고리(cheer/reward/relay/reminder)? DND 시간대?
3. PushSubscription 행 존재? (구독을 한 적 있나 — 브라우저 알림 권한 grant)
4. 리마인더/넛지면 cron 로그: GitHub Actions reminders.yml/daily-nudge.yml 최근 실행 성공?
   CRON_SECRET 일치?
```
**"500 에러"**
```
1. Vercel 함수 로그 확인.
2. 직렬화 충돌이면 isSerializationConflict()로 잡혀 503 반환됐어야 — cause 체인 확인.
3. 입력 검증 누락으로 Prisma 타입오류면 해당 라우트에 타입 가드 추가(PA-002/003 패턴).
```
**"UI가 옛날 버전"**
```
1. SW 캐시. public/sw.js CACHE_VERSION이 최근 캐싱 변경에서 범프됐나?
2. HTML navigation은 network-first여야(오래된 board URL이 stale 문서 잡는 문제).
3. 새 SW 활성화엔 앱 재오픈/새로고침 필요.
```

**버그 클래스 카탈로그 — 증상이 위 3개 트리에 없으면 여기서 클래스를 찾고 "진단 시작점"부터 연다** (이 코드베이스 고유의 6대 재발 클래스):

| # | 클래스 | 전형적 증상 | 진단 시작점 | 선례 |
|---|--------|------------|------------|------|
| 1 | 낙관 업데이트·직렬 큐 경합 | 채운 알이 되감김·완성 연출 오취소·유령 포도알 | `src/lib/boardFillState.ts`(mergeServerBoard·applyFillResult·rollbackFill) → board/[id] postFillSticker | #66·#74 병합 규칙 주석 |
| 2 | 포인터 제스처 | 스와이프/리프트/탭이 안 먹거나 스크롤 죽음 | home/page.tsx gAxis 축잠금·포인터 캡처·releaseCapture의 touchAction 복원, SwipeableBoardCard 주석 | #94~#103 드래그 회귀 |
| 3 | SW 캐시 stale | "UI가 옛날 버전"(위 트리) | `public/sw.js` CACHE_VERSION·navigate network-first | 구 보드 URL stale 문서 |
| 4 | 권한·마스킹 | 내용이 빈 문자열·403/404 혼동 | board GET `canSeeBody`·`isViewerPrivileged`, 균일 403 프로빙 방어(plant-gift) | 친구 뷰 보상 마스킹 |
| 5 | Serializable 충돌 | 간헐 500/503, P2034 없이 커밋 시점 충돌 | `isSerializationConflict()`(fillBoard.ts) — `e.code==='P2034'` 단독 검사 금지 | CLAUDE.md Prisma 7 절 |
| 6 | SSE·알림 지연 | 메시지가 "실시간이 아님"(최대 10초+재연결) | useSSE 10초 폴·4분 스트림 캡·lastCheck 스냅샷 | PRINCIPLES §6 |

수정 후엔 반드시 PRINCIPLES §10 3단계(가설→재현→적대 검증)를 통과시킨다.

## 4. cron 운영

- 3종: `reminders.yml`(5분), `daily-nudge.yml`(일간 KST 오전), `weekly-recap.yml`(주간). GitHub Actions가 `Authorization: Bearer $CRON_SECRET`로 `/api/cron/*` 호출(Vercel Hobby는 Vercel Cron 불가).
- **수동 발사**(로컬/디버그):
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-nudge
  ```
- `CRON_SECRET` 로테이션: Vercel env + GitHub Actions secret 양쪽 동시 갱신.

## 5. 환경변수 대장

| 변수 | 정의/사용 | 미설정 시 |
|------|-----------|-----------|
| `DATABASE_URL` | Neon pooled Postgres (prisma.config.ts) | 앱 구동 불가 |
| `JWT_SECRET` | JWT 서명 (auth.ts, ≥16자) | 앱 구동 불가 |
| `CRON_SECRET` | cron Bearer 인증 | cron 라우트 503 (리마인더·넛지·리캡 미발송) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | 웹푸시 (push.ts) | 푸시 전면 no-op(인앱 SSE는 동작) |
| `VAPID_SUBJECT` | 웹푸시 연락처 (기본 mailto:noreply@podoal.app) | 기본값 사용 |
| `GOOGLE/KAKAO/NAVER_CLIENT_ID/SECRET` | OAuth (oauth.ts) | 해당 provider "체험(게스트)" 모드 폴백 |
| `OAUTH_REDIRECT_BASE` | OAuth redirect 오버라이드 | 요청 host 사용 |
| `ENABLE_DEV_LOGIN` | prod에서 dev 로그인 허용 | prod에서 /api/auth/dev 404 |
| `NEXT_PUBLIC_DEV_TOOLS` | prod에서 dev 도구(seed-friends·dev-unlock) | prod에서 dev 라우트 403/404 |
| `UPSTASH_REDIS_REST_URL/TOKEN` | rate-limit 공유 스토어(선택) | 인메모리 rate-limit(단일 인스턴스) |
| (수익화, 미래) `TOSS_SECRET_KEY`/`TOSS_CLIENT_KEY` | PG 결제 (MONETIZATION_PLAN) | 결제 비활성 |

**규칙**: 코드가 새 env를 읽으면 `.env.example` + 이 표를 **동시 갱신**(감사 사례: VAPID·CRON_SECRET가 .env.example에서 누락돼 있었음 — 조용한 기능 정지 위험).

## 6. 정기 루틴

- **주간**: GitHub Actions cron 3종 최근 실행 성공 확인, Neon 용량·연결 수 점검.
- **분기(미니 감사)**: `docs/audit/AUDIT-2026-07-05.md` §1 방법론 체크리스트 재실행 — 특히 **CLAUDE.md·PRINCIPLES 사실성 대조**(코드가 문서를 앞선 곳). env 대장 ↔ .env.example 동기 확인.

## 7. 서브에이전트 오케스트레이션 규약

여러 모델(haiku/sonnet/opus)에 수정을 분담할 때. 총설계·리뷰·커밋은 최상위 모델(페이블)이 전담.

**태스크 카드 템플릿** (서브에이전트 프롬프트에 그대로):
```
## PA-NNN: <제목>
- Severity/분류 / 배정 모델
- 소유 파일 (이 목록 밖 수정 시 반려):
  - <경로들>
- 문제/재현 (자립적으로 — 카드만 보고 이해 가능하게)
- 원인: <파일:라인>
- 스펙 (시험 가능한 문장 — "비친구 수신자 → 403 '...'")
- 제약: CLAUDE.md 조항 인용 + 하지 말 것(리팩토링 금지 등)
- 검증법 (실행 명령 포함)
- 산출: diff + 검증 로그. **커밋 금지**(git add도 금지 — 페이블이 수행)
```

**모델 배정**:
| 티어 | 기준 | 예 |
|------|------|----|
| haiku | 판단 0·1파일·사실상 diff가 카드에 적힘 | env.example 추가, 단일 입력 가드(PA-002) |
| sonnet | 판단 낮음·≤3파일·모방 패턴 존재 | 친구 게이트(PA-006), 연계 링크(PA-008), 길이/개수 캡(PA-007) |
| opus | 트레이드오프·구조 이해 | 스키마+마이그레이션, 동시성, sw.js, auth 경로 |
| **fable 직접** | 핫파일·보안 설계·문구 결정 | store.ts, globals.css, types, Navigation, CLAUDE.md, schema.prisma |

**병렬 안전**: 서브에이전트는 작업 트리를 공유(worktree 미사용) → **웨이브 내 소유 파일 교집합 0**을 착수 전 기계 검증. 병렬 3~4 상한. 스키마 카드는 단독 웨이브.

**⚠ 모든 보고는 가설.** 2026-07-05 감사에서 탐색 에이전트의 "High 2건"(messages 스팸·NotificationSetting skip)이 재검증에서 전부 무효(과대/허위)였다. 서브에이전트 diff·탐색 보고는 상위 모델이 **코드로 재확인** 후 채택. 리뷰 게이트는 `docs/REVIEW_CHECKLIST.md` 7항. 반려 2회 → 상위 모델, 3회 → 최상위 모델 직접(절차는 PRINCIPLES §10).

**카드 저장소 (`docs/cards/`)** — 카드는 감사 보고서 인라인이 아니라 파일로 산다:

- 위치·이름: `docs/cards/YYYY-MM-DD-<웨이브>-<slug>.md` (예: `2026-07-06-W1-plant-gift-move.md`).
- 상태 헤더(첫 줄): `상태: 대기 | 진행 | 검증대기 | 완료 | 반려 n회` — 배정받은 모델이 직접 갱신.
- 필수 절(템플릿 항목에 추가): **필독** — 이 카드에 필요한 문서 절만 나열(예: "PRINCIPLES §5·CLAUDE.md 모션 규약"). 하위모델은 전 문서가 아니라 카드의 필독 목록만 읽는다.
- 완료 카드는 분기 로테이션 때 `docs/cards/_archive/`로 이동(위키 log 로테이션과 동일 주기).
- **백로그와의 관계**: ROADMAP 백로그 항목은 착수 결정 시 카드로 변환된 뒤에만 작업 가능 — 백로그에서 곧장 코드로 가지 않는다.

## 8. 디버깅 프로토콜 (재현 인프라)

**2계정 재현 절차** — 친구·선물·릴레이 버그는 계정 2개가 기본:

```bash
# 계정 A(dev): 웰컴 "🛠 개발자 모드" 버튼 또는
curl -s -c /tmp/a.jar -X POST localhost:3000/api/auth/dev
# 친구 3명 시드(test1234 비번, 수락된 친구관계 포함):
curl -s -b /tmp/a.jar -X POST localhost:3000/api/dev/seed-friends
# 계정 B(시드 친구로 로그인):
curl -s -c /tmp/b.jar -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"friend1@podoal.com","password":"test1234"}'
# 이후 -b /tmp/a.jar / -b /tmp/b.jar 로 두 시점을 오가며 재현
# (friend1 이메일은 seed-friends 응답에서 확인 — 시드 구현이 정본)
# 브라우저 2세션: 일반 창=A, 시크릿 창=B (또는 프로필 2개)
```

**재현 스크립트 자산화** — 일회용 재현 코드를 버리지 않는다:

- 위치: `scripts/repro/<slug>.mjs` (node 실행 가능, 상단 주석에 대상 버그·기대 출력 명시).
- 카드의 "검증법"이 이 스크립트를 가리키게 한다 — 수정 전 실패·수정 후 통과가 그대로 회귀 테스트.
- E2E 프레임워크 도입은 `scripts/repro/`에 3개 이상 쌓이면 그때 승격 검토(현재 자동 테스트 0 — lint+tsc+build만. 선제 도입은 과설계).

**베타 제보 → 카드 변환** — 사용자 문장("안 돼요")을 받으면 이 4질문으로 구조화 후 트리아지(PRINCIPLES §8) → `docs/cards/` 등재:

1. 어느 화면·버튼에서? (라우트 특정)
2. 어떤 계정·상태에서? (완성/미완성 보드, 친구 여부, 기기)
3. 기대한 것 vs 실제 본 것?
4. 재현되는가, 한 번뿐인가?
