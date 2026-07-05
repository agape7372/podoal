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

**⚠ 모든 보고는 가설.** 2026-07-05 감사에서 탐색 에이전트의 "High 2건"(messages 스팸·NotificationSetting skip)이 재검증에서 전부 무효(과대/허위)였다. 서브에이전트 diff·탐색 보고는 페이블이 **코드로 재확인** 후 채택. 리뷰 게이트는 `docs/REVIEW_CHECKLIST.md` 7항. 반려 2회 → 상위 모델, 3회 → 페이블 직접.
