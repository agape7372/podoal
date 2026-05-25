# 🍇 포도알 (Podoal)

습관 형성 PWA — 포도판에 스티커를 채우며 목표 달성. 친구와 응원 메시지, 시간 캡슐, 릴레이 챌린지까지.

**Stack**: Next.js 14 (App Router) · React 18 · TypeScript · Prisma (PostgreSQL/Neon) · Zustand · Tailwind · PWA

---

## 📱 라이브 데모

본 저장소의 `main` 브랜치는 다음 URL에 자동 배포됩니다:

- Production: **https://podoal-rouge.vercel.app**

가입 방식 4가지가 첫 화면에서 모두 동작:
- 💬 **카카오** / N **네이버** / G **Google** — OAuth credentials 미설정 시 자동으로 "체험" 게스트 모드로 즉시 로그인 (랜덤 이름 부여)
- 📧 **이메일** — 정식 가입 (bcrypt + JWT)
- 🛠 **개발자 모드** — `dev@podoal.com` 자동 생성 + 샘플 보드

폰에서 홈화면 추가:
- iOS Safari: 공유 → "홈 화면에 추가"
- Android Chrome: 우측 점 3개 → "홈 화면에 추가"

---

## 🚀 자기 인스턴스 띄우기 (Vercel + Neon)

### 1. Neon Postgres DB 만들기 (2분)

1. https://neon.tech → GitHub 로그인 (무료, 카드 등록 X)
2. **Create project** → Region: `AWS Asia Pacific 1 (Singapore)` 권장 (한국 응답 빠름)
3. **Connection Details** → **Pooled connection** 토글 ON → connection string 복사 (`postgresql://...?sslmode=require`)

### 2. Vercel에 배포

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fagape7372%2Fpodoal&env=DATABASE_URL,JWT_SECRET&envDescription=DATABASE_URL%E2%86%92Neon+pooled+connection+string.+JWT_SECRET%E2%86%9232%EC%9E%90+%EC%9D%B4%EC%83%81+%EB%9E%9C%EB%8D%A4+%EB%AC%B8%EC%9E%90%EC%97%B4&project-name=podoal&repository-name=podoal)

위 버튼 → Vercel 가입/로그인 → import 화면에서 env 입력:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon에서 복사한 pooled connection string |
| `JWT_SECRET` | 32자 이상 랜덤 문자열 (예: `openssl rand -base64 32` 결과) |

빌드 시점에 `prisma db push`가 자동 실행되어 Neon에 11개 테이블 생성. 1~2분 후 배포 완료.

### 3. (선택) 소셜 로그인 실제 연동

`docs/OAUTH_SETUP.md` 참고. 각 provider 콘솔에서 OAuth 앱 등록 후 다음 환경변수 추가:

| Key | 사용처 |
|---|---|
| `KAKAO_CLIENT_ID` (+ 선택 `KAKAO_CLIENT_SECRET`) | https://developers.kakao.com |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | https://developers.naver.com |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | https://console.cloud.google.com/apis/credentials |

각 provider 콘솔의 Redirect URI에는 `{배포 URL}/api/auth/oauth/{kakao|naver|google}/callback` 형식 등록.

환경변수 설정 → Vercel 자동 재배포 → 해당 버튼이 "체험" 배지가 사라지고 실제 OAuth로 자동 전환.

---

## 💻 로컬 개발

```bash
git clone https://github.com/agape7372/podoal.git
cd podoal
cp .env.example .env
# .env 열어 DATABASE_URL (로컬 Postgres 또는 Neon dev branch) + JWT_SECRET 채우기
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

---

## 🧰 아키텍처

- **DB**: PostgreSQL on Neon (pooled connection, 모든 lambda가 같은 DB 공유)
- **Auth**: bcrypt 비밀번호 + JWT (jose) + HttpOnly Secure 쿠키 + Origin/CSRF 가드
- **OAuth**: Google/Kakao/Naver Authorization Code flow + state 쿠키. credentials 미설정 시 게스트 fallback (랜덤 식별자 발급)
- **레이트리밋**: 인메모리 슬라이딩 윈도우 (login 10/min, register 5/hr, search 30/min)
- **실시간**: SSE (`/api/messages/sse` 3초 폴링)
- **클라이언트 상태**: Zustand persisted to localStorage
- **PWA**: Service Worker (cache-first static, network-first API) + manifest + install prompt
- **사운드/햅틱**: Web Audio API 30개 효과음 + Vibration API

---

## ⚠️ 한계

- **OAuth 실제 사용자 공개**: 카카오/네이버는 "개인" 모드 앱이면 본인 + 팀원만 로그인 가능. 일반 공개 시 비즈니스 앱 전환(검수) 필요. 그 전까지는 게스트 fallback이 채워줌.
- **리마인더 푸시**: 앱(탭)이 열려 있을 때만 발송. 백그라운드 푸시는 별도 작업.
- **모바일 친구간 시연**: 단일 폰에서는 친구·메시지·릴레이의 UI만 보임. 두 디바이스에서 다른 계정으로 로그인해야 실제 송수신 확인 가능.

---

## 📚 추가 자료

- 프로젝트 가이드: [`CLAUDE.md`](./CLAUDE.md)
- OAuth 콘솔 설정 단계별 가이드: [`docs/OAUTH_SETUP.md`](./docs/OAUTH_SETUP.md)
- 환경변수 템플릿: [`.env.example`](./.env.example)
