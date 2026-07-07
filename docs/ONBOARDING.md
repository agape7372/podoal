# podoal 온보딩 — 세션 첫 5분 (모든 모델 공통)

> 목적: 어떤 모델이든(haiku~최상위) 이 1장으로 "무엇을 읽고, 무엇을 하면 안 되고, 언제 끝났다고 말할 수 있는지"를 안다. 전 문서를 다 읽지 마라 — **아래 트리에서 자기 경로만.**

## 0. 30초 요약

- 제품: 습관 추적 PWA "포도알" — 클레이모피즘, 전 UI 한국어, 진행은 영원히 무료.
- 스택: Next.js 16(App Router) + React 19 + Prisma 7(PostgreSQL/Neon) + Tailwind 4(@theme in globals.css) + Zustand + PWA.
- 컨벤션 정본: `CLAUDE.md`. 판단 절차: `docs/PRINCIPLES.md`. 운영·명령어: `docs/PLAYBOOK.md`.
- **철칙 3개**: ① 재현 없이 수정 없음(PRINCIPLES §10) ② 카드 소유 파일 밖 수정 금지 ③ 하위모델은 커밋 금지(diff+검증 로그까지).

## 1. 작업 유형 → 경로 (자기 것만 읽기)

```
받은 작업이 무엇인가?
├─ 태스크 카드(docs/cards/*.md)를 받았다
│   → 카드의 "필독" 절에 적힌 문서 절만 읽는다. 그 외 아무것도 읽지 않아도 된다.
│     끝나면: 카드 상태 갱신(진행→검증대기) + diff + 검증 로그. 커밋 금지.
├─ 버그를 잡아야 한다 (카드 없음)
│   → PRINCIPLES §2 분류기 → §10 사고 프로토콜(가설→재현→적대검증)
│   → 증상이 익숙하면 PLAYBOOK §3 인시던트 트리 + 버그 클래스 카탈로그
│   → 재현엔 PLAYBOOK §1 부트스트랩 + §8 2계정 프로토콜
├─ UI·모션을 바꾼다
│   → PRINCIPLES §5 UI 체크리스트 + CLAUDE.md "Styling"·"Motion" 절
│     (transition-all 금지 / Modal variant / 레이아웃 불변식 7종이 지뢰밭)
├─ API·권한·검증을 바꾼다
│   → PRINCIPLES §3 데이터 레이어 게이트(허용/금지/체크리스트) — rename·키 변경·응답 필드 제거는 승인 필요
├─ Prisma 스키마를 바꾼다
│   → PRINCIPLES §4 + docs/MIGRATIONS.md. 단독 웨이브 전용 — 다른 작업과 병렬 금지.
├─ 카피·문구를 바꾼다
│   → PRINCIPLES §7 — 원칙적 불변. 선물·공유·메시지 문구만 예외(현행 vs 제안 병기).
├─ 새 기능을 제안·설계한다
│   → docs/ROADMAP.md에서 위치 확인(P0~P4·백로그). 백로그 항목은 카드 변환 후에만 착수.
│     수익화·구독·스킨이면 docs/MONETIZATION_PLAN.md 가드레일 필수.
│     전략적 우선순위·페르소나 근거는 docs/PRODUCT_PLAN.md.
└─ 감사·리뷰를 한다
    → PRINCIPLES §8 트리아지 + §10. 발견은 ①수정 카드 ②의도적 동작(근거) ③제안, 셋 중 하나로만.
```

## 2. 세션 시작 체크 (코드 만지기 전)

- [ ] `git status` — 남의 진행 중 작업이 있는지. 있으면 건드리지 말고 보고.
- [ ] 로컬 실행이 필요한 작업이면 PLAYBOOK §1 부트스트랩 (docker start podoal-pg → seed는 **DATABASE_URL이 localhost인지 확인 후에만**).
- [ ] 내 작업의 소유 파일 목록을 확정했는가(카드에 있음 / 없으면 착수 전에 스스로 명시).

## 3. 세션 종료 체크 (끝났다고 말하기 전)

- [ ] PRINCIPLES §10 3단계 통과 기록이 있는가 (재현 커맨드 → 수정 → 반례 시도 로그).
- [ ] `npm run lint` + `npx tsc --noEmit` 통과.
- [ ] 커밋 전이면 `docs/REVIEW_CHECKLIST.md` 7게이트 (하위모델은 여기서 멈춤 — 커밋은 상위 모델).
- [ ] 새 env를 읽는 코드를 넣었으면 `.env.example` + PLAYBOOK §5 대장 동시 갱신.
- [ ] 카드 작업이면 카드 상태·검증 로그 갱신. 재사용 가치 있는 재현 코드는 `scripts/repro/`로.

## 4. 절대 금지 (모델 불문)

1. 재현·근거 없는 추측 수정 (PRINCIPLES §10 1·2단계 위반).
2. 카드 소유 파일 밖 수정, 범위 밖 리팩토링 (§9 diff 최소주의).
3. `store.ts` localStorage 키·기존 API 응답 필드·env 이름 변경 (§3 금지 목록).
4. `tailwind.config.ts` 재생성, `@source`에 `src/lib/**` 추가, `transition-all` 신규 사용 (§5).
5. 프로덕션 DB(Neon)에 seed 실행 — seed는 전 테이블 deleteMany다 (PLAYBOOK §1 경고).
6. 하위모델의 git commit/add — 산출물은 diff+검증 로그까지.

## 5. 문서 지도 (링크 허브)

| 문서 | 한 줄 |
|------|------|
| `CLAUDE.md` | 컨벤션·스택·디자인 토큰 정본 |
| `docs/PRINCIPLES.md` | 판단 절차 — 분류기·게이트·트리아지·사고 프로토콜(§10) |
| `docs/PLAYBOOK.md` | 부트스트랩·인시던트 트리·버그 클래스·카드 규약(§7)·디버깅 프로토콜(§8) |
| `docs/REVIEW_CHECKLIST.md` | 커밋 전 7게이트 (1분) |
| `docs/ROADMAP.md` | P0(현재)~P4 + 백로그 — "다음 할 일"은 여기서 |
| `docs/cards/` | 실행 단위 태스크 카드 (상태 헤더 참조) |
| `docs/MONETIZATION_PLAN.md` | 결제·구독·스킨 — 가드레일 6항 |
| `docs/PRODUCT_PLAN.md` | 전략층(비전·WS·KPI·확장 게이트) — phase 정본은 ROADMAP |
| `docs/PERSONA_REVIEW_2026-07.md` | 페르소나 22명 리뷰 — 불변 시뮬레이션 스냅샷 |
| `docs/FILL_CADENCE_PLAN.md` | 채움 텀·숙성 시스템 기획(구현 전) |
| `docs/MIGRATIONS.md` | 스키마 변경 절차 |
| `docs/audit/` | 감사 스냅샷 (불변 리포트) |
