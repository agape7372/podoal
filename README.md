# 🍇 포도알 (Podoal)

습관 형성 PWA — 포도판에 스티커를 채우며 목표 달성. Next.js 14 + Prisma(SQLite) + Zustand + Tailwind + PWA.

---

## 📱 핸드폰에서 5분 안에 띄우기 (Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fagape7372%2Fpodoal&env=JWT_SECRET,PODOAL_BOOTSTRAP_SQLITE,DATABASE_URL&envDescription=JWT_SECRET%E2%86%9032%EC%9E%90+%EC%9D%B4%EC%83%81+%EB%9E%9C%EB%8D%A4+%EB%AC%B8%EC%9E%90%EC%97%B4.+%EB%82%98%EB%A8%B8%EC%A7%80+2%EA%B0%9C%EB%8A%94+%EB%82%98%EB%A8%B8%EC%A7%80+%EA%B7%B8%EB%8C%80%EB%A1%9C+%ED%95%98%EB%93%9C%EC%BD%94%EB%94%A9%EB%90%9C+%EA%B0%92+%EB%B6%99%EC%97%AC%EB%84%A3%EA%B8%B0&project-name=podoal&repository-name=podoal)

위 버튼을 핸드폰 브라우저에서 탭하면 Vercel 가입/로그인 후 자동으로 import 화면이 뜹니다.

### 환경변수 입력 화면이 뜨면 이렇게 채워주세요

| Name | Value |
|---|---|
| `JWT_SECRET` | **32자 이상 아무 랜덤 문자열**. 예: `Hjm1342-podoal-prod-key-asdfghjklzxcv` (대충 키보드 마구 두드리면 됨) |
| `PODOAL_BOOTSTRAP_SQLITE` | `1` |
| `DATABASE_URL` | `file:/tmp/dev.db` |

### Deploy 클릭 → 1~2분 대기

빌드 성공하면 화면에 URL이 뜹니다. 그게 본인 포도알 사이트예요.

### ⚠️ 패치본을 보고 싶다면

처음 import한 직후 production 브랜치는 `main`입니다. 코드 리뷰 패치는 `claude/stoic-keller-jCTap` 브랜치에 있어요.
**Project Settings → Git → Production Branch**에서 `claude/stoic-keller-jCTap`로 바꾼 뒤 다시 deploy하거나, **Deployments 탭에서 이 브랜치의 Preview URL을 직접 열기**.

### 로그인

- 메인 화면의 **개발자 모드** 버튼 탭
- 또는 `dev@podoal.com` / `dev1234`

### 폰 홈화면에 추가 (PWA로 깔기)

- iOS Safari: 공유 버튼 → "홈 화면에 추가"
- Android Chrome: 우측 점 3개 → "홈 화면에 추가" 또는 자동 팝업

---

## ⚠️ 알아두실 한계

- **Vercel 서버리스 + SQLite**: 콜드스타트마다 `/tmp/dev.db`가 초기화돼 입력한 데이터가 사라집니다. 데모용으론 충분하지만 영구 저장이 필요하면 Neon(Postgres) 또는 Turso(libSQL)로 교체하세요.
- **친구 / 메시지 / 릴레이**: 다른 계정과의 상호작용이 필요한 기능이라 단일 폰에서는 UI만 시연 가능합니다. 두 디바이스에서 다른 계정으로 로그인해야 실제 송수신 동작 확인 가능.
- **리마인더**: 앱(탭)이 열려 있는 동안에만 알림이 발송됩니다. 백그라운드 푸시는 별도 작업이 필요합니다.

---

## 💻 로컬 개발

```bash
git clone https://github.com/agape7372/podoal.git
cd podoal
cp .env.example .env
# .env 열어 JWT_SECRET 채우기 (16자 이상)
#   - macOS/Linux:  openssl rand -base64 32
#   - 안 되면 그냥 키보드로 16자 이상 마구 입력
npm install
npm run db:push     # Prisma 스키마 동기화
npm run dev         # http://localhost:3000
```

### 주요 명령

```bash
npm run dev          # 개발 서버
npm run build        # 프로덕션 빌드 (prisma db push가 prebuild로 자동 실행)
npm run lint         # ESLint
npm run db:generate  # Prisma 클라이언트 재생성
npm run db:push      # 스키마 → DB 동기화
npm run db:seed      # 샘플 데이터
npm run db:studio    # Prisma Studio GUI
```

---

## 🧰 기술 스택

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Zustand, Tailwind CSS, PWA
- **Backend**: Next.js API routes, Prisma ORM, SQLite (로컬) / 서버리스용 `/tmp` SQLite (Vercel)
- **Auth**: JWT (jose), HTTP-only 쿠키, Origin 기반 CSRF 가드
- **레이트리밋**: 인메모리 슬라이딩 윈도우 (login 10/min, register 5/hr, search 30/min)

---

## 📚 추가 자료

- 프로젝트 가이드: [`CLAUDE.md`](./CLAUDE.md)
- 환경변수 템플릿: [`.env.example`](./.env.example)
- 진행 중 PR: [#1 전체 코드 리뷰 후속 수정](https://github.com/agape7372/podoal/pull/1)
