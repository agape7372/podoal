상태: 검증대기 (구현·런타임 검증 완료 2026-07-06 — 탈퇴: 2계정 시나리오(심기 201·선물 201·메시지 201 후 DELETE 200, 재로그인 401, 상대 화면 4종 200, 선물 복사본 생존+giftedFrom null, 친구·메시지 정리) ✓ / 비번: 오현재 403·6자미만 400·변경 200·구비번 401·신비번 200 ✓ / logout 200 후 me 401 ✓. 발견 기록: POST /api/auth/me가 이미 로그아웃 역할(레거시) — 전용 /api/auth/logout는 buildClearAuthCookie 재사용해 신설(me POST는 계약 유지 위해 보존). 소유권 이전 불필요 판명 — giftBoardCopy가 복사본 ownerId=수령자라 타인 진행 훼손 자체가 불가능, giftedFromId null 절단만 수행. 방어 삭제 1건 추가(타인 보드 위 내 스티커 — 정상 데이터면 0행))

## W1-D-API: 계정 관리 API — logout·password·탈퇴 (데이터 레이어 게이트 대상)

- Severity/분류: 기능 추가(additive) / 배정: **fable 직접** (auth 경로 + 탈퇴 트랜잭션)
- 필독: PRINCIPLES §3(게이트 체크리스트 전항)·§10, PLAYBOOK §5(env 대장 — 해당 없음 확인)
- 소유 파일:
  - src/app/api/auth/logout/route.ts (신규)
  - src/app/api/auth/password/route.ts (신규)
  - src/app/api/auth/me/route.ts (DELETE 추가)
  - (참조만) src/lib/auth.ts — 쿠키명·옵션 재사용, 수정 금지 목표

### 스펙

1. `POST /api/auth/logout`: 세션 쿠키 만료 재설정 → `{ok:true}`. 인증 불요(이미 로그아웃이어도 200).
2. `PATCH /api/auth/password`: getCurrentUserId 가드. body 타입·길이 검증(validate 헬퍼 스타일, 새 비번 6~72자). `user.password === null`(OAuth-only) → 400 "소셜 계정은 비밀번호가 없어요". bcrypt.compare 불일치 → 403 "현재 비밀번호가 맞지 않아요". 성공: bcrypt.hash 갱신 → `{ok:true}`.
3. `DELETE /api/auth/me`: 2계정 관계를 고려한 **트랜잭션 순차 삭제** (스키마 무변경 — User 참조 대부분 onDelete 없음/Restrict 실측). 정책(이 카드에서 확정):
   - 내가 심은 PlantedGift(타인 보드 포함) 삭제 — 미공개 선물은 사라짐(수용).
   - 내가 보낸/받은 Message 삭제. Friendship 양방향 삭제. Reminder·NotificationSetting·TimeCapsule(내 userId) 삭제. PushSubscription은 cascade.
   - 타인 보드 위 내 Sticker(선물받은 보드에 채운 것 등) 삭제.
   - 릴레이: 내 RelayParticipant 삭제. **내가 만든 Relay는 통째 삭제**(participants cascade) — 베타 정책: 동료가 있어도 삭제(고지 문구는 UI 2차 확인에 이미 포함). 동료의 linked board는 남음(RelayParticipant.board는 참조만).
   - 내 Board 전부 삭제(Sticker/Reward/TimeCapsule/PlantedGift cascade, Message.boardId SetNull). **내가 선물해서 상대가 쓰고 있는 보드(ownerId=나, giftedToId≠null)는 소유권을 수령자에게 이전**(ownerId=giftedToId, giftedFrom 유지) — 받은 사람 진행 보호.
   - 마지막에 User 삭제 + 쿠키 클리어.
   - 순서: FK Restrict를 만족하도록 자식 → 부모. 트랜잭션 1개(길면 interactive tx 타임아웃 상향).
4. 404/403 규약·해요체·게이트 체크리스트 전항 준수.

### 검증법

- 로컬 2계정: A가 B에게 보드 선물 + B 보드에 선물 심기 + 릴레이 생성 후 A 탈퇴 → B의 선물 보드 생존(소유 이전)·A 데이터 소멸·A 재로그인 불가·B 화면 정상 로드(고아 참조 500 없음).
- `npm run lint` + `npx tsc --noEmit`.

### 산출: diff + 검증 로그. 커밋은 게이트 후.
