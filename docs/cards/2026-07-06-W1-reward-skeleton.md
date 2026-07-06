상태: 완료 (2026-07-06 커밋 b724c9f — 검증 상세는 아래 이력 참조)

## W1-B: 완성 보상 스켈레톤/본문 미표시 — 클라 3갭 봉합 + 완성 후 자동 오픈

- Severity/분류: Med(보상 개봉 UX 신뢰 훼손 — 핵심 쾌감 경로) / 배정: **fable 직접** (핫파일 — 직렬 큐·낙관 병합)
- 필독: PRINCIPLES §6(낙관적 채우기 행)·§10, CLAUDE.md Feedback System
- 소유 파일:
  - src/app/(app)/board/[id]/page.tsx
  - src/components/RewardRevealModal.tsx (필요 시)
  - src/lib/fillBoard.ts (W2-A 병합분: celebration 메시지 위치 문구)
  - src/app/api/boards/[id]/route.ts (W2-A 병합분: myPlantedGifts additive)

### 문제/재현 (2026-07-06)

- 로컬(RTT≈0)에서는 재현 불가 — 채움 2탭 후 55ms 내 보상 탭에도 본문 즉시 표시(unlock 응답 선착). 프로드(Neon us-east ~400ms+모바일)에서 갭 발현.
- 코드로 확정한 갭 3:
  1. `openReward`(≈L673)가 `pendingUnlockContentRef` 버퍼를 **즉시 소비하지 않음** — 안전망 useEffect(≈L540)의 첫 시도는 5초 뒤. 완성 직후 탭 시 불필요한 스켈레톤 창.
  2. 완성 직후 fetchBoard 도착 전 board 상태의 reward.content='' (unlock 전 마스킹 잔존) → loading 판정만 있고 버퍼 미확인.
  3. `revealedAt` 있는데 content ''인 stale 상태 → `loading=false` + reveal 재발사 없음(L679 `if (!reward.revealedAt)`) → **본문 없는 모달**. reveal은 멱등이라 재발사 안전.

### 스펙 (시험 가능)

1. openReward 진입 시 버퍼 우선 소비: `pendingUnlockContentRef.get(reward.id)` 있으면 그 내용으로 즉시 loading=false 오픈(왕복 0).
2. `revealedAt && !content && !imageUrl`이면 loading=true로 열고 reveal 재발사(멱등 응답이 본문 채움).
3. 안전망 첫 폴링 5000ms → 800ms(이후 기존 백오프 유지). 큐 드레인 대기 경로는 유지.
4. **완성 자동 오픈**: 보드 완성 연출(액체 차오름 — 임팩트+1650ms 비트) 종료 후 최종 보상 팝업 자동 오픈(unlock 응답 내용 버퍼 소비, 이미 열려 있으면 no-op). 사용자 기대("완성하면 보상이 나온다")와 일치. reduced-motion 사용자도 동일 타이밍.
5. 친구 뷰(비특권)의 마스킹 보상: 탭 시 스켈레톤 대신 "보상은 주인만 볼 수 있어요" 상태 표시(또는 칩 비활성) — 프라이버시 의도 유지하며 빈 모달 제거.
6. (W2-A 병합) fillBoard.ts 심은 선물 공개 celebration 메시지에 위치 포함: `"{이름}님이 {position+1}번째 알에 숨겨둔 선물을 발견했어요!"` (현행: 위치 없음 — 문구 변경은 메시지 예외 조항, 현행/제안 병기 완료). board GET에 `myPlantedGifts: [{position, revealedAt}]` additive 필드(뷰어 본인이 심은 것만 — 주인에게는 위치 비노출 유지).

### 검증법

- fetch 지연 몽키패치(800ms)로 프로드 RTT 시뮬: 마지막 알 채움 → 즉시 보상 탭 → 스켈레톤 ≤1왕복, 본문 표시. 연출 후 자동 오픈 확인.
- revealedAt+content'' 상태 강제(캐시 시드 조작) → 재열람 시 본문 회복.
- 회귀: 중간 보상 비트 오픈, 400 대기 경로(큐 드레인 중 탭), 실패 시 배너, 포도밭(RewardList) 동일 내용.

### 산출: diff + 검증 로그. 커밋은 게이트 후.

### 검증 이력 (2026-07-06)

- 800ms 지연 시뮬: 조기 탭 → 스켈레톤 ~750ms(1왕복, '저장 중' 문구) → 본문 ✓ / 무탭 완성 → +2.4s 자동 개봉, 스켈레톤 없이 본문 ✓ / 재열람 즉시 본문(reveal 영속 입증) ✓.
- 적대 검증 반례 1건 발견·봉합: 2.4s 안에 열고 닫으면 자동 재개봉 → rewardSeenRef 가드.
- 스펙 5(친구 뷰)는 수정 불필요 판명 — 보상 섹션이 렌더부터 isOwner 전용 + 선물 복사본 ownerId=수령자(의도적 동작 기록).
