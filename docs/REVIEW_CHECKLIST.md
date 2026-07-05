# 커밋 전 리뷰 체크리스트

> 커밋·PR 전 1분 훑기. 서브에이전트 diff 리뷰 게이트의 압축판(`docs/PLAYBOOK.md` 서브에이전트 규약과 동일 출처). 원칙 전문은 `docs/PRINCIPLES.md`.

## 7항 게이트

1. **스코프** — `git diff --stat`의 파일이 의도한 범위뿐인가? 카드/요청 밖 파일이 끼면 반려.
2. **스펙 충족** — 요구한 동작을 실제로 하는가? 검증 명령을 최소 1건 직접 재실행했는가?
3. **컨벤션 grep** — 신규 diff에 아래가 없어야:
   ```bash
   git diff | grep -nE 'transition-all|window\.confirm|focus:outline-none|text-warm-light|: any'
   ```
   (기존 코드의 잔존은 대상 아님 — 신규 추가만.)
4. **데이터 레이어 패턴** — API 변경이면: `getCurrentUserId`+`authResponse` 가드 / 입력 검증(타입+길이+범위) / 404 vs 403 구분 / 한국어 해요체 에러 / 직렬화 충돌은 `isSerializationConflict()`.
5. **커플링 부작용** — 수정 함수의 호출자를 grep했는가? 낙관적 업데이트·dual-store·SSE·`isJustFilled` 600ms 등 알려진 커플링에 걸리는가?
6. **레이아웃 불변식** — UI 변경이 PRINCIPLES §5의 7종 불변식 중 하나라도 건드리면 실기기/브라우저로 확인.
7. **검증 통과** — `npx tsc --noEmit` && `npm run lint` && `npm test` 로컬 녹색. sw.js/캐시 건드렸으면 `CACHE_VERSION` 범프.

## 커밋 규칙

- 발견/카드당 **원자 커밋**, `type(scope): 한국어 요약`.
- 끝에 트레일러: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- main 직접 커밋 시 웨이브 게이트(1~7) 후 push. 문제 시 카드 단위 revert.
