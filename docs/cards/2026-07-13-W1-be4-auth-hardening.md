상태: 완료 (2026-07-13 — 게이트 7항 + 로그인 타이밍 수동 대조: 존재 0.14~0.26s vs 부재 0.15~0.21s 프로파일 겹침, 계통적 격차 소멸)

## BE-4: 인증·레이트리밋 경화 — 열거 오라클·RL 키 (B3·B7)

- Severity: Low(보안 경화) / 분류: 보안 / 배정: opus (auth 경로)
- 필독: PRINCIPLES §3 데이터 레이어 게이트(응답 계약 불변), REVIEW_CHECKLIST 게이트 4

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/app/api/auth/login/route.ts`
- `src/app/api/messages/route.ts`

### 문제/재현
1. **B3** `auth/login/route.ts:34-39`: 유저 부재 시 `bcrypt.compare` 없이 즉시 401 → 존재 계정만 bcrypt 지연 발생. 계정 존재 여부가 응답 시간으로 노출(열거 타이밍 오라클).
2. **B7** `messages/route.ts:46-50`: 인증 후 엔드포인트인데 RL 키가 `clientKey(request)`(IP-only) — 공유 NAT(회사·학교) 사용자들이 서로의 전송 한도를 소진. friends/search는 `${userId}:${clientKey}`, custom-image는 `userId` 사용.

### 스펙 (시험 가능한 문장)
- B3: 유저 부재(또는 password null) 경로에서 **고정 더미 bcrypt 해시**에 대해 `bcrypt.compare`를 실행한 뒤 동일 401 반환 — 응답 문구·상태코드·타이밍 프로파일 평준화. 더미 해시는 모듈 상수(빌드타임 생성 금지 — 리터럴). **OAuth-only 계정의 409 안내는 의도된 제품 결정(존재 노출 수용) — 현상 유지.**
- B7: messages POST의 RL 키를 `userId` 기반으로 교체 (custom-image/route.ts:22 패턴 모방). 한도값(20/m)은 불변.
- 응답 계약(문구·코드) 전부 불변.

### 제약
- `src/lib/auth.ts`는 데이터 레이어 동결 파일 — 접근 금지. 변경은 라우트 내에서만.
- 에러 문구 변경 금지(한국어화 등 카피 작업은 이 카드 범위 외).

### 검증법
```bash
npx tsc --noEmit && npm run lint && npm test
# 수동: 존재/부재 계정 로그인 각 5회 curl 타이밍 육안 비교(큰 격차 소멸 확인)
```

### 보고 전 자가검증
각 주장을 이 세션의 도구 결과와 대조 — 증거를 가리킬 수 있는 작업만 보고. 검증 안 된 것은 "미검증" 명시. 테스트 실패는 출력과 함께. 완료·검증된 것은 헤징 없이 완료로.

### 산출
diff + 검증 로그. **커밋 금지** (git add도 금지 — 페이블이 수행).
