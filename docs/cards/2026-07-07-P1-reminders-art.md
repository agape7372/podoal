상태: 대기

## P1: 알림 설정 빈 상태에 EmptyState 도입 + 알람시계 아트 배선

- Severity/분류: 위생·일관성(P0 아트 이월) / 배정: sonnet
- 필독: PRINCIPLES §5(UI 체크리스트), `src/components/EmptyState.tsx` 헤더 주석
- 소유 파일 (이 목록 밖 수정 시 반려):
  - src/app/(app)/notifications/page.tsx

### 배경 (자립 설명)

P0에서 빈 상태 일러스트 세트를 배선했는데, 알림 설정 페이지의 "아직 리마인더가 없어요"만 공용 `EmptyState` 컴포넌트를 안 쓰고 일반 `<p>`(notifications/page.tsx L359 부근)라 아트를 못 꽂았다. 자산은 이미 존재: `/illustrations/empty/empty-reminders-v2.webp`(잎 위 알람시계, 투명 WebP).

### 스펙 (시험 가능)

1. 해당 빈 상태 블록을 `<EmptyState art="/illustrations/empty/empty-reminders-v2.webp" fallbackEmoji="⏰" title="아직 리마인더가 없어요" artSize={96} />`로 교체. 기존 문구 유지(제목 그대로), description은 주변에 이미 있으면 유지·없으면 생략.
2. 주변 레이아웃(리마인더 목록 컨테이너)의 여백이 EmptyState의 `py-12`와 이중으로 벌어지지 않는지 확인 — 과하면 `className`으로 py 축소.
3. 다른 빈 상태(알림 설정 페이지 내 다른 섹션)는 건드리지 않는다.

### 제약

- transition-all 금지. 카피 변경 금지(§7). EmptyState 컴포넌트 자체 수정 금지.

### 검증법

1. dev 서버 + dev 로그인 → /notifications → 리마인더 0개 상태에서 알람시계 아트 렌더(스크린샷).
2. 리마인더 1개 생성 → 빈 상태 사라짐(회귀 없음) → 삭제 → 아트 복귀.
3. `npm run lint` + `npx tsc --noEmit`.

### 산출: diff + 검증 로그. **커밋 금지**(git add도 금지).
