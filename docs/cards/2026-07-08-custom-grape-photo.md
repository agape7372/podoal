상태: 검증대기

## custom-grape-photo: 보드별 커스텀 알 사진 (사용자 요청, 로드맵 외 신규)

- 분류: 기능(사용자 직접 요청 — MONETIZATION_PLAN의 GrapeSkin 팔레트 시스템과 무관한 별개 기능) / 배정: 페이블(직접 구현)
- 필독: `docs/PRINCIPLES.md` §3(데이터 레이어 게이트, additive 허용) — 신규 스키마는 additive nullable 1개뿐이라 게이트 통과

### 배경 / 결정 경위
사용자가 "커스터마이징 구현"을 요청 → 처음엔 MONETIZATION_PLAN P3 스킨(고정 팔레트 카탈로그)로 해석했으나, 실제 요청은 **사용자가 사진을 업로드하면 그 사진이 포도알(채워진 것)에 적용되는 기능**. 별도 인터뷰(AskUserQuestion 2라운드)로 확정:
1. 범위: 결제 없음(R1 상당) — 스토리지 비용만 발생.
2. 적용 단위: **보드당 사진 1장**(알 개별 아님) — 채워진 알 전부가 그 사진으로 보임.
3. 노출 범위: **본인만** — 친구 열람·선물·릴레이 동료 뷰에서는 노출 안 됨(giftMessage와 동일 패턴 재사용).
4. 스토리지: **Vercel Blob**.

### 스키마 (additive, 완료)
```prisma
model Board {
  ...
  customImageUrl String?  // 업로드된 커스텀 알 사진 URL. null=기본 보라. 본인에게만 노출(GET에서 gating).
}
```
마이그레이션: `npx prisma migrate dev --name add-board-custom-image` (로컬 `podoal-pg` 컨테이너 사용).

### 소유 파일
- `prisma/schema.prisma` + 생성된 `prisma/migrations/*`
- `src/types/index.ts` — `BoardDetail.customImageUrl?: string | null` 추가
- `src/app/api/boards/[id]/route.ts` — GET 응답에 `customImageUrl` 추가, `isViewerPrivileged` 게이팅(giftMessage와 동일 패턴)
- `src/app/api/boards/[id]/custom-image/route.ts` (신규) — POST(업로드+저장)·DELETE(제거)
- `src/lib/blob.ts` (신규, 얇은 래퍼 — put/del 재사용)
- `src/components/GrapeSticker.tsx` — `customImageUrl?: string | null` prop, 채워진 알에 배경이미지 적용
- `src/components/GrapeBoard.tsx` — `board.customImageUrl`을 GrapeCell→GrapeSticker로 threading
- `src/components/CustomImageModal.tsx` (신규) — 업로드 바텀시트(클라 canvas 리사이즈+미리보기+제거)
- `src/app/(app)/board/[id]/page.tsx` — 소유자 전용 진입점(제목 옆 ✏️ 버튼 옆에 🖼️ 버튼) + 모달 연동
- `.env.example` — `BLOB_READ_WRITE_TOKEN` 등재
- `package.json` — `@vercel/blob` 의존성 추가

### 스펙
1. **업로드 전 클라 리사이즈**: `<canvas>`로 최대 640×640, JPEG quality 0.82로 축소 후 Blob 변환 — 원본을 그대로 올리지 않음(비용 방어, shareCard.ts의 기존 Canvas 패턴 재사용).
2. **POST `/api/boards/[id]/custom-image`**: `getCurrentUserId` + `board.ownerId===userId` 아니면 403. `multipart/form-data`(`file` 필드) 파싱. MIME 화이트리스트(`image/jpeg`·`image/png`·`image/webp`만, 그 외 400 — SVG 등 거부). 크기 상한 2MB(리사이즈 후 기준, 서버도 재검증). 기존 `customImageUrl` 있으면 교체 전 `del()`로 이전 blob 삭제(고아 스토리지 방지). `put(pathname, file, { access: 'public', addRandomSuffix: true })` → URL을 `Board.customImageUrl`에 저장. 레이트리밋 재사용(`rateLimit({ windowMs: 60*60_000, max: 10 })`, 로그인/회원가입과 동일 패턴).
3. **DELETE `/api/boards/[id]/custom-image`**: 소유자 확인 → blob `del()` → `customImageUrl: null`.
4. **GET `/api/boards/[id]`**: `isViewerPrivileged`(기존 변수) 기준 `customImageUrl: isViewerPrivileged ? board.customImageUrl : null` — giftMessage와 동일 줄에 추가.
5. **GrapeSticker**: `isFilled && customImageUrl` 이면 버튼에 `style={{ backgroundImage: \`url(${customImageUrl})\`, backgroundSize: 'cover', backgroundPosition: 'center' }}` 추가(기존 ripening용 `--ripen-p` style과 병합). `rounded-full`이 이미 원형이라 별도 마스크 불필요.
6. **CustomImageModal**: `<input type=file accept="image/*">` → canvas 리사이즈 → 미리보기 → "적용" 버튼(POST, FormData) / "기본으로 되돌리기" 버튼(DELETE, `customImageUrl` 있을 때만 노출). `EditBoardInfoModal` 스켈레톤(Modal, ClayButton, 에러 행) 재사용.
7. **board/[id]/page.tsx**: `showCustomImage` state, 제목 옆 `✏️` 버튼 우측에 `🖼️` 아이콘 버튼(owner 전용, `aria-label="알 사진 바꾸기"`) 추가. 저장 성공 시 `setBoard` optimistic 갱신(customImageUrl 필드만 교체).

### 제약 / 알려진 트레이드오프
- **선물 사본에 복사 안 함**: `giftBoard.ts`의 create 필드 목록에 `customImageUrl`을 추가하지 않음 — 자연히 null로 시작(기존 skinId 설계 문서의 권장과 동일 근거: 받는 사람이 자기 사진으로 꾸미게).
- **공유카드(ShareCardModal)에서 제외**: "본인만 노출"을 문자 그대로 해석 — 공유카드는 SNS 등 외부 공개가 목적이라 커스텀 사진을 카드 렌더링에 포함하지 않음(기본 보라 렌더 유지). 별도 확인 없이 보수적 선택 — 원하면 이후 별도 카드로 뒤집을 수 있음.
- **URL은 "추측 불가 랜덤"이지, 암호학적 접근제어는 아님**: Vercel Blob `access:'public'`은 URL을 아는 사람은 누구나 fetch 가능. "본인만 노출"은 **앱 UI/API 레벨**(GET 응답에서 타인에게 안 돌려줌)로 강제하는 것이며, URL 자체 유출까지 막는 서명 URL 체계는 이번 스코프 밖(과설계 판단). 사용자에게 고지 필요.
- **Vercel Blob 스토어 연결은 사용자 액션**: Vercel 프로젝트에 Blob 스토어를 만들고 `BLOB_READ_WRITE_TOKEN`을 프로덕션 env에 연결하는 것은 Vercel 대시보드 작업 — 코드로 대신할 수 없음. 로컬 개발도 `.env.local`에 토큰이 있어야 업로드 테스트 가능(없으면 업로드 API가 실패 — 이 카드에서 로컬 실업로드 검증은 스킵, 코드 정독+타입체크로 대체).

### 검증법
- `npx tsc --noEmit` + `npm run lint`
- 마이그레이션 생성·적용 확인(`prisma/migrations/` 신규 디렉토리)
- 코드 정독: GET 게이팅(본인 아니면 null), 선물 복사 미포함, 공유카드 미포함 — 각 좌표 기록

### 검증 로그 (2026-07-08)

**신규/수정 파일**
- `prisma/schema.prisma` — `Board.customImageUrl String?` (additive)
- `prisma/migrations/20260708110732_add_board_custom_image/` (신규, 로컬 `podoal-pg`에 적용 완료 + `prisma generate` 재생성 완료)
- `package.json` — `@vercel/blob` 추가(`npm install`)
- `src/types/index.ts:56-57` — `BoardDetail.customImageUrl?`
- `src/app/api/boards/[id]/route.ts:133-134` — GET 응답, `isViewerPrivileged` 게이팅(giftMessage와 동일 줄 패턴)
- `src/app/api/boards/[id]/custom-image/route.ts` (신규) — POST(업로드, MIME화이트리스트+2MB상한+userId 키 레이트리밋 10/시간+교체 시 이전 blob del)·DELETE(제거)
- `src/components/GrapeSticker.tsx` — `customImageUrl` prop, 채워진 알에 `backgroundImage` 인라인 스타일(ripening `--ripen-p` style과 병합)
- `src/components/GrapeBoard.tsx` — `GrapeCellProps.customImageUrl` threading(GrapeCell → GrapeSticker), 호출부에 `board.customImageUrl` 전달
- `src/components/CustomImageModal.tsx` (신규) — `createImageBitmap` 기반 클라 리사이즈(최대 640px, JPEG 0.82) + 미리보기(원형) + 적용/제거
- `src/app/(app)/board/[id]/page.tsx` — `showCustomImage` state, 제목 옆 📸 버튼(✏️ 옆), `handleSaveCustomImage`(FormData POST)·`handleRemoveCustomImage`(DELETE), 모달 렌더
- `.env.example` — `BLOB_READ_WRITE_TOKEN` 등재(사용자가 Vercel 대시보드에서 Blob 스토어 연결 필요 — 코드로 대신 불가)

**이모지 가드 이탈 1건**: 스펙엔 없었으나 초안에서 `🖼️`(framed picture)·`📷`(camera) 사용 → `check-icons.mjs` 커버리지 검사(둘 다 `public/icons/fluent/`에 SVG 없음)에 걸림. **이미 SVG가 있는 `📸`(camera-with-flash, `1f4f8.svg`)로 전량 치환**해 신규 에셋 추가 없이 회피(W2-cadence-create 카드가 쓴 것과 동일 전략 — "신규 이모지를 쓰지 않아 아이콘 가드 리스크 자체를 회피").

**빌드 검증**
- `npx tsc --noEmit` → 에러 0
- `npm run lint` → **0 errors**, 69 warnings(전부 기존 파일의 `react-hooks/set-state-in-effect` — 이번 카드가 건드린 5개 파일 중 경고 0건 확인됨) + `check-icons` 통과
- `npm run build`(dev 서버 기동 포함 실제 업로드 왕복)는 수행 안 함 — `BLOB_READ_WRITE_TOKEN`이 로컬 env에 없어 실업로드는 애초에 불가(사용자가 Vercel Blob 스토어 연결 후에나 검증 가능). 코드 정독으로 대체.

**프라이버시 가드 코드 정독 확인** (grep으로 좌표 확인, 아래 3곳)
1. GET `/api/boards/[id]`: `customImageUrl: isViewerPrivileged ? board.customImageUrl : null` — 친구·릴레이 동료 뷰에선 항상 null.
2. `src/lib/giftBoard.ts`: `customImageUrl` 문자열 매치 0건 — 선물 사본 생성 시 자동으로 복사 안 됨(create 필드를 명시 나열하는 기존 구조상 별도 작업 불필요).
3. `src/components/ShareCardModal.tsx` / `src/lib/shareCard.ts`: `customImageUrl` 매치 0건 — 공유카드 렌더링에 원천적으로 개입 안 함(기본 보라 렌더 유지).

### 4차원 병렬 리뷰 (2026-07-08, sonnet 4기 — 버그/보안/관례/통합)

**수정 반영 2건** (리뷰 후 페이블 검증·적용, tsc/lint 재통과):
1. `CustomImageModal.tsx` — `URL.createObjectURL` revoke 누락 → previewUrl 교체·언마운트 시 blob: URL만 revoke하는 cleanup effect 추가(http(s) URL 제외).
2. `custom-image/route.ts` — `put()` pathname에 확장자가 없어 contentType 자동감지 실패(generic octet-stream 서빙 → MIME 스니핑 여지) → `contentType: file.type` 명시(화이트리스트 통과값).

**문서화만 (수정 안 함 — 판정 근거)**:
- 동시 업로드 레이스(2탭 근접 제출): 이전 blob del을 서로 모르고 지나가 고아 blob 1개 잔존 가능. DB 정합성은 안 깨짐(last-write-wins). 클라 busy-disabled로 같은 탭은 차단됨. 락 추가는 트래픽 규모 대비 과설계 — 알려진 한계로 기록.
- 구형 Safari/WebView EXIF 회전: `createImageBitmap` 기본값(from-image)이 최신 브라우저에서 자동 처리. iOS 16.4 미만에서 세로 사진 눕는 문제 이론상 가능 — 실기기 확인 항목.
- 레이트리밋 인메모리 다중 인스턴스 한계: 기존 전 라우트 공통(Upstash 설정으로 해소되는 구조), 신규 아님.

**문제없음 확정 (통합 리뷰 코드 좌표 판정)**:
- 캐시 정합: `board/[id]/page.tsx:139-145`의 write-through effect(`syncBoardCaches`)가 setBoard마다 자동 실행 — 신규 핸들러도 기존 관례대로 커버됨.
- SW: Blob URL은 cross-origin이라 `sw.js` `isCacheableAsset`(same-origin 조건)에 안 걸림 + addRandomSuffix로 URL 교체라 stale 불가.
- 낙관 채움 파이프라인(`boardFillState.ts` 4함수): 전부 스프레드 기반이라 customImageUrl 유실 불가. `mergeServerBoard`는 server 스프레드 — 서버 authoritative.
- 홈 미니보드(grape-filled-mini)는 단색 점 렌더라 사진 미노출이 기존 요약/상세 비대칭과 일치(의도된 스코프).
- giftedTo 게이팅: 선물 사본은 항상 ownerId===giftedToId 불변식(giftBoard.ts) — "본인만" 요구와 실질 일치.
- 관례 10항목(모달 패턴·transition-all·해요체·a11y·EmojiIcon·z사다리·memo 등) 위반 0건.

**실기기 확인 항목(배포 후)**: 사진 위 클레이 광택(box-shadow 인셋 하이라이트)이 시각적으로 자연스러운지 · 구형 iOS EXIF 회전.

**알려진 한계 (사용자 고지 필요)**
- Vercel Blob `access:'public'` — URL은 추측 불가 랜덤이지만 URL 자체가 유출되면 누구나 열람 가능(서명 URL 아님). "본인만"은 앱 UI/API 레벨 강제.
- 이 기능이 실제로 동작하려면 **Vercel 대시보드에서 Blob 스토어를 만들고 프로젝트에 연결**해야 함(자동 주입되는 `BLOB_READ_WRITE_TOKEN`) — 코드 배포만으론 업로드가 500으로 실패함.
- 실기기/실브라우저에서 업로드 왕복 자체는 검증 못 함(로컬 토큰 부재) — 배포 후 실사용 확인 필요.
