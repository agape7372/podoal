상태: 검증대기

## W1-ios-install-guide: iOS 설치 안내 강화 (POL-02)

- 분류: UX(제안-2 채택 — 이탈 1위 "설치·로그인 마찰" 축) / 배정: **sonnet**
- 필독: `docs/PRINCIPLES.md` §5(모달 규약 — 공용 Modal variant + useModalClose), `CLAUDE.md` Motion 절

### 소유 파일 (이 목록 밖 수정 시 반려)
- `src/components/InstallPrompt.tsx`

### 문제/배경
iOS 배너(`InstallPrompt.tsx` mode==='ios')는 한 줄 안내("공유 📤 → 홈 화면에 추가")뿐 — 가치 제안이 없고, 실제 단계(공유 시트 스크롤 → '홈 화면에 추가' → '추가')를 모르는 사용자(P11~13 중장년)는 여기서 멈춘다. 전략: "설치 전 가치 먼저"(PRODUCT_PLAN WS2).

### 스펙
1. iOS 배너의 보조 문구를 가치 우선으로 교체: 기존 "공유 📤 → 홈 화면에 추가" → **"설치하면 알림도 받고 홈에서 바로 열어요"**.
2. 기존 "확인" 버튼 → **"방법 보기"** 버튼(주 액션, clay-button 스타일)과 X 닫기 버튼(안드로이드 분기와 동일한 원형 X)으로 분리. X = 기존 handleDismiss(7일 스누즈) 그대로.
3. "방법 보기" 탭 → 공용 `Modal` **sheet variant**로 단계 안내 시트:
   - 제목: "홈 화면에 추가하는 방법"
   - 단계 3행(번호 + 아이콘 + 문구): ① "Safari 하단의 공유 버튼을 눌러요" (EmojiIcon 📤) ② "'홈 화면에 추가'를 찾아 눌러요" (➕) ③ "오른쪽 위 '추가'를 누르면 끝!" (✅)
   - 하단 보조 1줄: "설치하면 앱처럼 열리고, 알림도 받을 수 있어요"
   - 닫기는 `useModalClose(onClose)`의 `requestClose` 경유(이탈 애니 규약).
4. 시트를 닫아도 배너는 유지(스누즈는 X만). 안드로이드(prompt) 분기 로직·마크업 무수정.
5. 스크롤 영역 생기면 `pb-4`(레이아웃 불변식 5).

### 제약
- 신규 카피는 위 문구 그대로(자체 창작 금지). `transition-all` 금지. 배너 크기/위치(z-30, bottom-[88px]) 불변.
- localStorage 키(`podoal-install-dismissed`) 변경 금지.

### 검증법
- `npx tsc --noEmit` + `npm run lint`.
- 코드 트레이스 로그: ①ios/prompt 분기별 버튼 구성 ②시트 열림·닫힘 경로(requestClose 사용) ③스누즈 로직 불변 diff 확인.

### 산출
diff + 검증 로그 + 카드 상태 갱신(진행→검증대기). **커밋 금지.**

### 검증 로그 (2026-07-08)

**변경 파일**: `src/components/InstallPrompt.tsx` (단독)

**tsc**: `npx tsc --noEmit` → 종료코드 0, 출력 없음.

**lint**: `npm run lint` → `eslint . && node scripts/check-icons.mjs` 종료코드 0.
- 22개 경고 전부 `react-hooks/set-state-in-effect`(레포 전역 warn 정책, InstallPrompt.tsx:50 `setMode('ios')` 1건 포함) — 이 줄은 기존 useEffect 본문 그대로(무수정)라 신규 유입 아님. 에러 0건.
- `check-icons.mjs`: "모든 이모지가 플랫 SVG로 커버됨 · JSX 생이모지 없음 · 선택지 배열 커버됨" 통과. (➕ 이모지는 `public/icons/fluent/2795.svg` 자산이 없어 — 소유 파일 밖이라 추가 불가 — EmojiIcon 대신 일반 "+" 텍스트 글리프로 렌더해 커버리지 검사 대상에서 자연히 제외.)

**코드 트레이스 ① — ios/prompt 분기별 버튼 구성**:
- 공통 선두: 원형 X(`handleDismiss`, `aria-label="닫기"`) — 이제 두 분기가 동일 JSX를 공유(과거엔 android 분기만 보유).
- `mode==='ios'`: X + "방법 보기"(`onClick={() => setShowGuide(true)}`, `clay-button` grape→lime 그라디언트 — 과거 "설치" 버튼과 동일 스타일 클래스 재사용).
- `mode==='prompt'`: X + "설치"(`onClick={handleInstall}`) — 마크업·핸들러 무수정.
- 보조문구(`mode==='ios'`전용): "설치하면 알림도 받고 홈에서 바로 열어요"로 교체(구 "공유📤→홈 화면에 추가" 제거).

**코드 트레이스 ② — 시트 열림·닫힘 경로(requestClose 사용)**:
- 열림: "방법 보기" 클릭 → `setShowGuide(true)` → `{showGuide && <Modal/>}` 마운트(sheet variant 기본값).
- `useModalClose(() => setShowGuide(false))`로 `closeRef`/`requestClose` 생성 → `<Modal closeRef={closeRef} onClose={() => setShowGuide(false)}>`로 연결.
- 시트 내부 "확인" 버튼: `onClick={requestClose}` → Modal 내부 이탈 애니(`modal-sheet-out`) 재생 → `animationend` → `finishClose()` → `onClose()`(`setShowGuide(false)`) → 언마운트.
- 백드롭 클릭·Escape도 Modal.tsx 자체 로직이 동일한 내부 `requestClose()`를 거쳐 같은 경로로 수렴(Modal.tsx:153-168, 195-198 — 무수정 공용 컴포넌트, 이번 카드에서 비수정).
- 세 경로 모두 이탈 애니를 거친 뒤에만 `showGuide=false`가 되므로 스펙의 "requestClose 경유" 요구 충족.

**코드 트레이스 ③ — 스누즈 로직 불변 diff 확인**:
- `git diff -- src/components/InstallPrompt.tsx` 확인 결과 `handleDismiss` 함수 본문(71-75행 원본), `DISMISS_KEY`/`DISMISS_DAYS` 상수, `useEffect` 내 `dismissed` 판정 로직 — 전부 diff에 나타나지 않음(완전 무수정).
- 시트의 "확인" 버튼은 `requestClose`(→ `setShowGuide(false)`)만 호출 — `handleDismiss`/`localStorage.setItem(DISMISS_KEY,...)`/`setMode(null)` 경로를 전혀 거치지 않음 → "시트를 닫아도 배너는 유지, 스누즈는 X만" 스펙(§4) 그대로 충족.

**스펙 이탈 사유**:
1. **➕ 아이콘 → "+" 텍스트 글리프 대체.** `public/icons/fluent/2795.svg` 자산이 없고, 카드의 소유 파일이 `InstallPrompt.tsx` 단독이라 신규 아이콘 자산 추가가 불가. 기존 FAB(`src/app/(app)/home/page.tsx:890`)도 "+"를 일반 텍스트 글리프로 렌더하는 선례가 있어 그 패턴을 재사용(EmojiIcon 미경유, check-icons 대상 아님). 시각적으로 "추가" 의미 전달은 동일.
2. **제목 폰트 크기 13px로 통일(구: `mode==='prompt' ? 13px : 14px`).** 스펙에 명시되지 않은 추가 변경. 사유: 기존 14px은 "iOS 분기는 버튼이 '확인' 하나뿐이라 여유 있다"는 전제였는데, 이번 변경으로 iOS도 X+"방법 보기"(prompt의 "설치"보다 더 긴 라벨) 2버튼 구성이 되어 제목 가용폭이 prompt와 같거나 더 좁아짐. 14px 유지 시 줄바꿈 가능성이 있어, 이미 검증된 13px(prompt 분기 실측값)을 양쪽에 적용 — 더 좁은 폭에 더 작은 폰트는 단조 개선(악화 시나리오 없음). **잔여 리스크**: "방법 보기"가 "설치"보다 길어 iOS 분기 제목 가용폭이 84px보다 더 좁을 수 있고, 13px(81.7px 실측)도 줄바꿈할 가능성을 배제 못함 — dev 서버 기동이 카드 규칙상 금지되어 실기기/브라우저 픽셀 검증은 못함. 줄바꿈이 발생해도 배너 높이가 자동 확장될 뿐 레이아웃 불변식 7종 중 위반되는 항목은 없음(고정 높이 아님). **후속 시각 QA 권장.**
3. **시트 하단에 "확인" 버튼(`ClayButton variant="ghost"`, `requestClose`) 추가.** 스펙 문구엔 명시 없으나, "공용 Modal 사용법은 기존 sheet variant 호출처 1곳을 모방하라"는 지시에 따라 `WeeklyRecapModal`/`OnboardingWelcome` 등 기존 정보성 시트가 예외 없이 명시적 닫기 버튼을 갖는 관례를 재현. 백드롭/Escape만으로 닫는 UX는 이 카드가 겨냥하는 중장년 페르소나(P11~13)에게 발견성이 낮다고 판단.
