# podoal

**podoal**은 포도판에 한 알씩 채우며 목표를 달성하는 습관 추적 PWA입니다. 친숙하고 가독성 높은 클레이모피즘 UI 위에 한 알씩 채우는 습관 추적, 친구 응원, 시간 캡슐, 릴레이 챌린지 등 핵심 경험을 담았습니다.

**Stack**: Next.js 14 (App Router) · React 18 · TypeScript · Prisma (PostgreSQL/Neon) · Zustand · Tailwind · PWA

---

## ✨ 디자인 리뉴얼 하이라이트

- **컬러 팔레트 정리**: tailwind `grape-*`와 globals.css `--grape-primary` 동기화. 새 액센트 `juice-*`, `leaf-*`, `sunshine-*` 추가로 단조롭던 라벤더 일색에 따뜻함을 더함.
- **컬러드 섀도**: 모든 클레이 그림자가 검정이 아닌 보라-웜 틴트 `rgba(73,50,100,…)`. "AI가 그리지 않는" 한 줄.
- **디스플레이 폰트**: Maru Buri(네이버 무료 한글 휴머니스트)를 헤더·큰 숫자에 추가. 본문은 Noto Sans KR 그대로 — 유아틱하지 않은 손맛.
- **마스코트 정물 일러스트**: 표정 없는 정적인 포도송이 SVG가 웰컴/빈 상태/InstallPrompt에 등장. 캐릭터로 행동시키지 않고 정체성 마커로만 사용.
- **일러스트 라이브러리**: VineLeaf · Sparkle (+ GrapeStem). 페이지 섹션당 1개 이내로만 절제해 사용.
- **GrapeBoard·GrapeSticker 시각 강화**: 추출한 `<GrapeStem />`(세이지 잎 캐노피), 사진 같은 알맹이 하이라이트, isJustFilled 시 미세 위글.
- **Navigation·InstallPrompt 플로팅 알약**: 풀폭 바 → 떠있는 `clay-puffy` 알약. 활성 탭은 작은 점 1개로 표시.
- **WineBottle 깊이감**: 호일 캡슐, 라벨 종이 텍스처 오버레이(noise SVG), 빈티지에 따른 자연스러운 색 램프.
- **데이터·콘텐츠는 손대지 않음**: 7개 카테고리·38개 템플릿·7-tier 와이너리 이름(포도알 새싹~포도 마스터)·30개 사운드·보상 유형(편지/기프티콘/소원권) 모두 그대로 유지.

---

## 🚀 자기 인스턴스 띄우기 (Vercel + Neon)

### 1. Neon Postgres DB 만들기

1. https://neon.tech → GitHub 로그인 (무료, 카드 등록 X)
2. **Create project** → Region: `AWS Asia Pacific 1 (Singapore)` 권장
3. **Connection Details** → **Pooled connection** 토글 ON → connection string 복사 (`postgresql://...?sslmode=require`)

### 2. Vercel에 배포

env 입력:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon에서 복사한 pooled connection string |
| `JWT_SECRET` | 32자 이상 랜덤 문자열 (`openssl rand -base64 32` 결과) |

빌드 시점에 `prisma db push`가 자동 실행되어 Neon에 11개 테이블 생성.

### 3. (선택) 소셜 로그인 실제 연동

`docs/OAUTH_SETUP.md` 참고. 각 provider 콘솔에서 OAuth 앱 등록 후:

| Key | 사용처 |
|---|---|
| `KAKAO_CLIENT_ID` (+ 선택 `KAKAO_CLIENT_SECRET`) | https://developers.kakao.com |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | https://developers.naver.com |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | https://console.cloud.google.com/apis/credentials |

각 provider 콘솔의 Redirect URI에는 `{배포 URL}/api/auth/oauth/{kakao|naver|google}/callback` 등록.

환경변수 미설정 시 자동 게스트 모드로 즉시 로그인 가능.

---

## 💻 로컬 개발

```bash
git clone https://github.com/agape7372/podoal.git
cd podoal
cp .env.example .env
# .env 열어 DATABASE_URL + JWT_SECRET 채우기
npm install
npm run db:push     # Prisma 스키마 동기화
npm run dev         # http://localhost:3000
```

### 주요 명령

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드 (prisma db push → next build)
npm run lint         # ESLint
npm run db:generate  # Prisma 클라이언트 재생성
npm run db:push      # 스키마 → DB 동기화
npm run db:seed      # 샘플 데이터
npm run db:studio    # Prisma Studio GUI
```

개발자 모드: 인증 화면의 "🛠 개발자 모드" 버튼 또는 `dev@podoal.com` / `dev1234`.

---

## 🧰 아키텍처

- **DB**: PostgreSQL on Neon
- **Auth**: bcrypt + JWT (jose) + HttpOnly Secure 쿠키
- **OAuth**: Google/Kakao/Naver Authorization Code flow + 게스트 fallback
- **레이트리밋**: 인메모리 슬라이딩 윈도우
- **실시간**: SSE (`/api/messages/sse`)
- **클라이언트 상태**: Zustand persisted to localStorage
- **PWA**: Service Worker + manifest + install prompt
- **사운드/햅틱**: Web Audio API 30개 효과음 + Vibration API

---

## 📚 추가 자료

- 프로젝트 가이드: [`CLAUDE.md`](./CLAUDE.md)
- OAuth 콘솔 설정: [`docs/OAUTH_SETUP.md`](./docs/OAUTH_SETUP.md)
- 환경변수 템플릿: [`.env.example`](./.env.example)

## 크레딧

- 아바타·이모지 일러스트: [Microsoft Fluent UI Emoji](https://github.com/microsoft/fluentui-emoji) (MIT) — `public/avatars/` 8개 fruit SVG + `public/icons/fluent/`.
- 본문 폰트: [Maru Buri](https://github.com/naver/nanumfont) (네이버 무료 폰트, 상용 가능).
- 그 외 일러스트·마스코트·디자인 토큰은 podoal 자체 제작.
