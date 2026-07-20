상태: 완료·배포 (2026-07-20 — main df63acb, CI green, Vercel Production success. 사용자 재제보 영상 기점. 멀티에이전트 4파트 병렬 + 적대 리뷰 3회(MAJOR 2건 in-PR 수정). 상세 판정은 세션 산출물, 요지는 본 카드. 패턴 정본 = 위키 optimistic-queue-consistency §확장)

## BATCH-FILL: 연타 채움 배치화 + 홈 라이브 — 완채 후 홈 즉시 100%·즉시 수확

- Severity: Critical(사용자 직접 재제보 영상 — "#133 후에도 우다다다 채우면 홈이 조금씩 차고 수확 즉시 안 됨") / 분류: 성능·정합성 / 배정: Fable 주도(서버 txn·코얼레싱·리뷰) + Sonnet 위임(모듈 이동·홈 배선) + Opus 조율
- 필독: PRINCIPLES §3, 2026-07-19-cache-coherence.md(전편 — 표시 계층 수정), 위키 optimistic-queue-consistency

### 원인 사슬 (전건 적대 검증 CONFIRMED)
전편 #133이 캐시 계층(표시)을 고쳤으나 **지연 본체는 잔존**:
1. 채움 POST가 알 하나씩 직렬 큐(board/[id]/page.tsx). Neon cold + Serializable 백오프로 알당 최대 ~9.6s.
2. `board.isCompleted`는 **마지막 알의 txn**에서만 set(fillBoard.ts). 수확은 클라 5곳 + **서버 게이트**(boards/[id]/route.ts — !isCompleted면 PATCH 400)가 전부 이 플래그 기준 → 큐 완전 드레인 전엔 수확 물리 불가.
3. 홈은 in-flight 큐를 몰라, 서버가 확정해도 다음 재검증까지 부분 수 표시.

### 서버 수정 (src/lib/fillBoard.ts + boards/[id]/stickers/route.ts)
- **`fillBoardGrapeBatch`**: 여러 칸을 단일 Serializable txn으로 저장(createMany skipDuplicates + count 재계산). 완성·릴레이·보상·깜짝선물 exactly-once = txn 내 **isCompleted 재확인 가드**(전량-중복 no-op 배치가 threshold 유일성 깨는 것 봉쇄) + 기존 `unlockedAt:null`/`revealedAt:null` 프리미티브 재사용. `unlockedRewards[]` 배열 반환(content 동봉 — 무한로딩 #89 계약 유지), `completedAt` additive 반환.
- 라우트: 기존 POST에 additive `{positions[]}` 분기. `{position}` 단건 경로 무변경(byte-identical).

### 클라 수정 (src/app/(app)/board/[id]/page.tsx + boardFillState.ts)
- FREE 보드 연타를 200ms 디바운스 **배치 버퍼**로 코얼레싱. 보상 triggerAt 경계·완성 칸·캡 30은 즉시 flush(`planFillBatches` 순수 플래너 — 응답당 보상 ≤1로 팝업 UX 보존). reconcile은 `applyBatchFillResult`(applyFillResult fold, filledCount≡length·monotonic isCompleted). 실패 = 배치 원자 롤백 + fillResumeAt=min(batch).
- **pagehide/visibilitychange(hidden) keepalive 플러시**(모듈 레벨) — 백그라운드 킬 시 미플러시 버퍼 유실 봉쇄(take-and-clear 멱등).
- 텀 보드·RipeningSheet 오버라이드는 기존 단건 경로 유지(배치 = FREE 연타 전용). #133 위생 배선(inRelay relays 무효화·stats/vine/winery/rewards TTL 오염)을 배치 reconcile에도 이식.

### 홈 라이브 (src/lib/fillQueue.ts + home/page.tsx + SwipeableBoardCard.tsx)
- 큐 상태 4 Map을 `fillQueue.ts`로 이동 + `pendingFillCount`/`drainPromise`/`applyPendingOverlay`(순수).
- 홈 `effectiveBoards` = 서버확정 수 위에 in-flight pending 오버레이(min 클램프) → 첫 프레임 100%. displayBoards·counts memo 소비.
- `harvestBoard`: 낙관 완성 시 드레인 await → 서버 재확인(readCachedApi) → 미완성이면 토스트+중단(자기교정). 이중진입 가드 ref, "수확 중…" 상태(harvesting prop).
- 홈 리페인트는 #133의 키 구독 notify에 편승(우리 초기 pub/sub 구현은 화해 시 폐기).

### #133 화해 (b8d4d48)
- 병행 세션 #131~#133이 원격 main 선착. cachedApi = **#133 전채택**(우리 pub/sub·writeVersions·테스트 10개 폐기 — #133이 상위집합). M2(스테일 GET가 write-through 덮음)는 #133 startedAt/lastLocalWriteAt 역행 가드가 포섭(mutate까지 커버 — 우리 것보다 강함). 채움 파이프라인 = 우리 것 유지.

### 제약 준수
- API 변경 = 배치 응답 계약 + `{positions[]}` 요청(전부 additive). 단건 경로·서버 게이트·rename/제거 없음.
- exactly-once 프리미티브 재사용(신규 없음). 배치는 FREE 한정 — 케이던스·early/backfill 플래그가 배치에 실릴 경로 없음(서버 측도 봉인).

### 잔여 (비차단)
- cachedApi 유닛테스트 0개(#133 이관 시 우리 것 폐기, main 원래 없음) — #133 API 표면 맞춤 복원 권장.
- `boardRef.current?.inRelay` 좀비 인스턴스 노트(단건 경로도 동일 패리티, 오판해도 TTL 치유).
- 드레인 중 재스와이프 시 commit-armed 시각 연출 비억제(harvestingRef로 액션은 inert — 코스메틱).

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test   # 220 pass/0 fail (2026-07-20)
TEST_DATABASE_URL=... npm run test:integration  # 16/16 (동시 배치 race·이중 triggerAt·릴레이 exactly-once)
# 실브라우저: FREE 보드 연타 → 네트워크 {positions[]} POST 소수 건 → 홈 복귀 첫 프레임 100% → 스와이프 수확 PATCH 200
```
