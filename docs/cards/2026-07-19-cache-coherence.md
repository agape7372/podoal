상태: 완료 (2026-07-19 — 게이트 7항 통과. 원버그 1차 감사(9 에이전트) + 앱 전수 스윕(64 에이전트: 조사 18·적대 검증 46, 137건 중 136건 검증 통과 — 치명 7·중대 66·경미 63)이 §3 게이트의 재현 근거. 상세 판정 로그는 세션 산출물, 요지는 본 카드)

## COHERENCE: 캐시 정합 일괄 수정 — 완채 후 홈 100% 지연·수확 차단 원버그 + 동류 전수

- Severity: Critical(사용자 직접 제보 — "다 채워도 메인 100% 지연 → 숙성 불가") / 분류: 정합성 / 배정: fable 주도 + sonnet 위임 7(소유 파일 교집합 0)
- 필독: PRINCIPLES §3, LEAD-REVIEW-2026-07-14 §상태관리, 2026-07-18-perf-skeleton-audit.md(전편 — TTL 도입 카드)

### 원인 사슬 (원버그, 전건 적대 검증 CONFIRMED)
1. cachedApi에 구독/알림 부재 — 채움 확정의 `/api/boards` write-through(syncBoardCaches)가 Map만 갱신, **마운트된 홈은 영원히 리페인트 안 됨**(수확 스와이프는 캐시 isCompleted로 게이트 → 차단).
2. 전편 카드의 mount TTL 5s가 "채우고 5초 내 홈 복귀" remount 재검증까지 생략 — 전편의 "신선도는 기존 재검증 불변" 전제가 변이-후-복귀 흐름에서 깨져 있었다(본 카드가 정정).
3. 재검증 GET이 직렬 채움 큐와 경쟁해 커밋 전 스냅샷으로 최신 write-through를 되덮음.

### 메커니즘 수정 (src/lib/cachedApi.ts)
- **키별 구독 알림**: cacheSet·invalidateCachedApi(Prefix)가 마운트된 훅에 통지 — 값 통지=setData, 무효화 통지=즉시 재검증(join). 원버그의 기존 write-through가 그대로 홈을 라이브 리페인트.
- **변이의 TTL 오염**: writeCachedApi/mutate가 lastSuccessAt 삭제 + lastLocalWriteAt 스탬프. `markCachedApiStale(Prefix)` 헬퍼(값 유지, TTL만 오염) 신설.
- **역행 GET 가드**: refresh가 fetch 시작 후의 로컬 쓰기를 감지하면 응답 폐기(cacheEpoch 가드와 동族).
- **fresh refresh**: 훅 반환 refresh는 in-flight join 우회(변이 전 GET 합류로 스테일 받던 문제 — 릴레이 수락·와이너리).

### 작성자 측 수정 (스윕 확정분 매핑)
- board/[id]: 삭제·선물거절 성공 시 상세 무효화+리스트 제거(**삭제 고스트**, 치명), 채움마다 stats/vine(완료 시 winery, 해금 시 rewards) TTL 오염, 포도동 연결 보드는 모든 채움에서 relays prefix 무효화, 미검증 시드 write-back 게이트(serverSyncedId — 알림 도입 후 스테일 역류가 라이브 오염이 되므로 필수), fetchBoard latestGuard, fill 응답 completedAt additive(fillBoard.ts) 흡수.
- boardFillState: mergeServerBoard giftOpenedAt 단조 병합(개봉 무음 롤백 차단).
- winery: 수확 성공 시 홈 리스트·상세 harvestedAt write-through(이중 수확→서버 타임스탬프 리셋 차단). home: 수확 성공 시 winery 무효화, confirmDelete catch(404=이미 삭제), 수확·삭제 실패 토스트, 프리페치 좀비 쓰기 가드(cancelled+localWriteAt).
- friends 계열: 즐겨찾기 형제 키 교차 write-through(목록↔상세 이중 키 분기), 수락/거절 시 notifications 무효화+배지 강제 동기화, 수락 실패 catch+스피너 해제+토스트(404=철회로 간주).
- notifications 계열: refreshUnreadCount가 피드를 캐시에 write-through(배지·피드 단일 출처), 메시지 읽음/삭제 시 notifications 무효화, 인박스 read-all `validated` 게이트, SSE 수신 시 강제 동기화(마운트된 알림함 라이브 갱신), **죽은 '메시지 팝업' 토글 수리**(showMessagePopup 게이트).
- relay 계열: PodongList를 useCachedApi('/api/relays')로 이관(store.relays 이중 저장 해소 — LEAD-REVIEW 권위 분할 지적), 초대 수락/거절·보상 열람 시 notifications 동기화.
- 스케줄러/계정: useReminderScheduler 클로저 캐시 invalidateReminderCache() + 알림 설정 전 변이 지점 배선, dayResetHour 변경 시 stats/vine/boards TTL 오염, store.resetEphemeral()(휘발 슬라이스 계정 전환 잔재)를 로그인/가입/dev/로그아웃/탈퇴/401에 배선, 로그아웃·탈퇴 시 분석 동의 리셋(다음 계정 상속 차단).

### 제약 준수
- 낙관 채움 파이프라인(직렬 큐·mergeServerBoard/applyFillResult 골격·600ms isJustFilled) 무접촉 — 병합 규칙에 단조 필드 2개(giftOpenedAt·completedAt)만 additive.
- API 변경은 fill 응답 completedAt 1건(additive, 미완료 시 필드 생략) — rename/제거 없음. store 기존 키·액션 시그니처 불변(resetEphemeral additive).

### 잔여 (minor 63건 중 미채택분 + 별도 결정)
- vine 페이지네이션(P4 트리거), SSE 공유 채널(B12 — 설계 문서 선행), 세션 동반 쿠키, relay/create 스텝 진입 시 친구 재검증(타 기기 수락), 스윕 minor 잔여는 스윕 로그 참조.

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test && npx next build   # 전부 통과(2026-07-19)
# 수동: 마지막 알 채움 → 즉시 홈 복귀 → 카드 100%·수확 스와이프 즉시 동작
# / 보드 삭제 → 홈에 고스트 없음 / 와이너리 수확 → 홈 탭 즉시 반영
```
