# 소셜 로그인 설정 가이드

포도알은 4가지 가입 방식을 지원합니다:
- 📧 **이메일** — 기본, 설정 불필요
- 🛠 **개발자 모드** — 기본, 설정 불필요
- 💬 **카카오** — Kakao Developers 등록 필요
- N **네이버** — Naver Developers 등록 필요
- G **Google** — Google Cloud Console 등록 필요

소셜 로그인 3종은 **각 provider 콘솔에 본인 명의로 앱 등록 후, 발급받은 키를 Vercel 환경변수에 입력**해야 활성화됩니다.

설정 안 한 provider는 가입 화면에서 회색 "(준비 중)" 으로 표시되고, 클릭해도 친절한 에러만 뜹니다. 하나만 먼저 등록해도 그 버튼만 활성화돼요.

---

## 공통: Redirect URI

모든 provider 콘솔에 등록할 콜백 주소 패턴:

```
https://{YOUR_DEPLOY_URL}/api/auth/oauth/{provider}/callback
```

예시 (현재 podoal 배포):
- Production: `https://podoal-rouge.vercel.app/api/auth/oauth/kakao/callback`
- Preview (이 PR): `https://podoal-git-claude-stoic-keller-jctap-jirings-projects.vercel.app/api/auth/oauth/kakao/callback`
- 로컬: `http://localhost:3000/api/auth/oauth/kakao/callback`

`{provider}` 자리에 각각 `kakao`, `naver`, `google`을 넣어서 3개씩 등록. Vercel preview / production 둘 다 사용한다면 둘 다 등록.

---

## 1. Kakao (가장 쉬움, 5분)

### A. 카카오 개발자 사이트 가입
1. https://developers.kakao.com 접속
2. 우상단 **로그인** (카카오 계정으로) → 처음이면 **약관 동의**

### B. 앱 만들기
1. **내 애플리케이션** → **애플리케이션 추가하기**
2. 입력:
   - **앱 이름**: `포도알`
   - **사업자명**: 본인 이름
   - **카테고리**: `라이프스타일` 등
3. **저장**

### C. 카카오 로그인 활성화
1. 만든 앱 클릭 → 좌측 **카카오 로그인**
2. 화면 상단 **활성화 설정** → **ON** 토글
3. 같은 페이지 **Redirect URI 등록** → 위 "공통" 섹션 참고하여 등록

### D. 동의 항목 설정
1. 좌측 **카카오 로그인 → 동의항목**
2. 다음 두 가지를 **설정** 클릭 후 선택/필수 동의로:
   - **카카오계정(이메일)** — 선택 동의 권장
   - **닉네임** — 필수 동의

### E. 키 발급
1. 좌측 **앱 설정 → 앱 키**
2. **REST API 키** 복사 ← Vercel `KAKAO_CLIENT_ID`
3. (선택) **카카오 로그인 → 보안** → **Client Secret** 생성 → "사용함" 저장 → 값 복사 ← Vercel `KAKAO_CLIENT_SECRET`

### F. Vercel 환경변수
https://vercel.com/{team}/podoal/settings/environment-variables → **Add Another**:

| Key | Value |
|-----|-------|
| `KAKAO_CLIENT_ID` | REST API 키 |
| `KAKAO_CLIENT_SECRET` | (선택) Client Secret |

Production + Preview 둘 다 체크 → **Save**.

---

## 2. Naver (10분)

### A. 가입 + 앱 등록
1. https://developers.naver.com 접속 → 네이버 로그인
2. **Application → 애플리케이션 등록**
3. 입력:
   - **애플리케이션 이름**: `포도알`
   - **사용 API**: **네이버 로그인** 체크
   - **제공 정보 선택**: `이메일`, `이름` (`별명`도 추천)
4. **로그인 오픈 API 서비스 환경**:
   - **PC웹**: 서비스 URL = 배포 URL (예: `https://podoal-rouge.vercel.app`)
   - **Callback URL**: `https://podoal-rouge.vercel.app/api/auth/oauth/naver/callback` (production)
   - Preview도 등록하려면 추가 도메인으로

### B. 키 발급
1. 등록 완료 후 **내 애플리케이션** → 방금 만든 앱 클릭
2. **Client ID** 복사 ← Vercel `NAVER_CLIENT_ID`
3. **Client Secret** 복사 ← Vercel `NAVER_CLIENT_SECRET`

### C. Vercel 환경변수
| Key | Value |
|-----|-------|
| `NAVER_CLIENT_ID` | Client ID |
| `NAVER_CLIENT_SECRET` | Client Secret |

---

## 3. Google (10분, 영문 콘솔)

### A. Google Cloud Project 만들기
1. https://console.cloud.google.com 접속 → 우상단 본인 이메일로 로그인
2. 상단 프로젝트 선택 드롭다운 → **NEW PROJECT**
3. **Project name**: `podoal` → **CREATE**

### B. OAuth Consent Screen 설정
1. 좌측 **APIs & Services → OAuth consent screen**
2. **External** 선택 → **CREATE**
3. 입력:
   - **App name**: `포도알`
   - **User support email**: 본인 이메일
   - **Developer contact**: 본인 이메일
   - (선택) App logo
4. **SAVE AND CONTINUE** 계속 클릭
5. **Scopes**: `userinfo.email`, `userinfo.profile`, `openid` 추가 → SAVE AND CONTINUE
6. **Test users**: (외부 공개 전이라면) 테스트할 본인 Gmail 추가
7. **SAVE AND CONTINUE** → 대시보드로 돌아오기

### C. OAuth 2.0 Client ID 발급
1. 좌측 **APIs & Services → Credentials**
2. 상단 **+ CREATE CREDENTIALS** → **OAuth client ID**
3. **Application type**: **Web application**
4. **Name**: `Podoal Web`
5. **Authorized JavaScript origins**: 배포 URL 추가
   - `https://podoal-rouge.vercel.app`
6. **Authorized redirect URIs**: 추가
   - `https://podoal-rouge.vercel.app/api/auth/oauth/google/callback`
   - (Preview도 쓸 거면 추가)
7. **CREATE**
8. 팝업에 **Client ID** + **Client Secret** 표시 → 복사

### D. Vercel 환경변수
| Key | Value |
|-----|-------|
| `GOOGLE_CLIENT_ID` | OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret |

---

## 검증

환경변수 추가 후 Vercel가 자동 재배포 (1-2분). 확인 방법:

1. 배포 URL의 가입 화면에서 등록한 provider 버튼이 회색 → 컬러로 활성화됨
2. 또는 `/api/auth/providers` 호출:
   ```
   curl https://YOUR_DEPLOY_URL/api/auth/providers
   ```
   해당 provider가 `true`로 바뀌어 있어야 함.
3. 클릭해서 실제 OAuth 흐름 확인 → 로그인 성공 시 `/home`으로 이동.

문제 시 Vercel **Runtime Logs**에서 에러 메시지 확인 (`OAuth token exchange failed` 등).

---

## 보안 메모

- `*_CLIENT_SECRET`은 절대 GitHub 등 공개 저장소에 커밋하지 마세요. `.env*`은 `.gitignore`에 있음.
- 본 코드는 OAuth `state` 파라미터로 CSRF 방어. 별도 추가 보안 작업 불필요.
- 사용자 비밀번호는 bcrypt 해시(이메일 가입) 또는 null(소셜 가입)로 저장. 원본 비밀번호 저장 안 함.
