상태: 보류 (재현 대기 — 로컬 DB 불능으로 실행 재현 미수행, 수정 없음)

## relay-race-analysis: 릴레이 차례 이중 진행 레이스 (GAP-08) — 페이블 직접 분석

- 분류: 조사(제안-2 채택분, PRINCIPLES §10 1단계 완료·2단계 차단) / 담당: fable
- 재현 자산: `scripts/repro/relay-pass-race.mjs` (dev 서버 + 로컬 DB에서 `node`로 실행 — 판정 출력 `RACE_DETECTED`/`NO_RACE`)

### 가설 (원문 GAP-08: "릴레이 차례 표시 동시 진입 레이스")
`POST /api/relays/[id]/pass`가 자격 가드(참가자 active + 보드 완성)를 **tx 밖에서** 검사하고 기본 격리로 진행하므로, 동시 /pass 2건이 모두 가드를 통과하면 두 번째가 다음-다음 pending을 activate — active 참가자 2명(바통 이중 진행).

### 코드 분석 결과 (좌표 기반 — 2026-07-08)
- 자동 진행(마지막 알): `src/lib/fillBoard.ts` — 참가자 조회·상태 검사·advance가 **Serializable tx 내부**. 동시 채움은 P2002/P2034로 직렬화. **안전.**
- 수동 `/pass`: `src/app/api/relays/[id]/pass/route.ts:14-51` 가드가 tx 밖(기본 격리)인 것은 사실. **그러나** 가드의 두 조건(`participant.status==='active'`·`board.isCompleted`)은 `findUnique` **단일 쿼리 스냅샷**이고, 이 두 상태는 자동 진행 tx가 **원자적으로 동시에** 뒤집는다(완성=isCompleted=true 커밋 순간 participant는 completed). 즉 "active인데 보드 완성"인 /pass-합법 상태가 현행 생성 경로(relays POST는 새 보드, join은 완성 보드 부착 거부 `join/route.ts:51`, 선완성 pending은 advance가 completed로 스킵 `relay.ts:72-78`)에서 **도달 불가** — 이중 /pass의 전제 자체가 성립하지 않는다.
- 판정(§8 3분류): **② 유령 의심(방어 이미 충분)** — 2026-07-05 감사의 탐색 "High 2건" 무효 패턴과 동형. 단 §10 2단계(실행 재현)를 로컬 DB 불능(Docker 엔진 좀비 소켓 — PLAYBOOK 참고)으로 못 돌렸으므로 **확정하지 않고 보류**.

### 후속 (로컬 DB 복구 시)
1. `docker start podoal-pg` + `npx prisma migrate deploy` + dev 서버 → `node scripts/repro/relay-pass-race.mjs`.
2. `NO_RACE`면 이 카드 상태를 "완료(유령 확정)"로 닫고 ROADMAP P1 라인에서 제거.
3. `RACE_DETECTED`면(예상 밖) /pass 가드를 tx 내부 재검사 + Serializable로 승격하는 수정 카드 신설(자동 경로 fillBoard.ts 패턴 미러링).
