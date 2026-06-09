# podoal 홈화면 위젯 — 네이티브 래퍼 기획

> 상태: **기획만**(미구현). 이번 라운드에 구현된 건 "웹 그라운드워크"(manifest `shortcuts` + 일일 푸시 넛지 + `/api/widgets/today` 데이터 엔드포인트)뿐이다. 진짜 홈화면 위젯은 아래 네이티브 래퍼가 있어야 가능하다.

## 0. 왜 네이티브 래퍼가 필수인가

iOS/Android **홈화면 위젯**은 OS가 **네이티브 코드로만** 렌더하도록 막아두었다(iOS=WidgetKit/SwiftUI, Android=Glance/RemoteViews). 순수 PWA는 위젯 영역에 진입할 수 없다. 따라서 podoal 웹앱을 **얇은 네이티브 셸**로 감싸 앱스토어/플레이스토어 앱으로 만들고, 그 셸에 위젯 익스텐션을 붙여야 한다. 화면 본체는 그대로 웹(podoal)을 띄운다.

- 비용은 제약 아님(사용자 확인): Apple Developer **$99/년**, Google Play **$25(1회)**.
- **절대 요건: 출시 전 일반인 접근 차단**(아래 §4).

## 1. 접근 방식 선택 — Capacitor 권장

| 방식 | 위젯 | 노력 | 비고 |
|------|------|------|------|
| **Capacitor**(권장) | iOS WidgetKit + Android Glance 익스텐션을 네이티브 프로젝트에 직접 추가 | 중 | Next.js PWA를 WKWebView/WebView로 래핑. 웹 본체 재사용 100%. 위젯만 플랫폼별 네이티브 |
| TWA(Bubblewrap) | Android만, 위젯 직접 지원 X | 하(Android) | iOS 불가. 위젯은 별도 AppWidget 코드 필요 → 이점 적음 |
| React Native 전면 재작성 | 가능 | 상 | 웹 자산 버리고 재구현 → 과대, 비권장 |

→ **Capacitor 셸 + 플랫폼별 위젯 익스텐션**. 셸은 `https://podoal-rouge.vercel.app`(또는 번들 자산)을 로드.

## 2. 위젯이 보여줄 것 (경쟁앱 벤치마크 반영)

Streaks/HabitBox/TickTick/Loop 등은 위젯에서 **오늘 진행 상황 + 원탭 체크오프**를 보여준다. podoal 위젯:

- **Small**: 가장 임박한 포도판 1개의 진행률(채운/전체 + 도넛/막대) + 탭 시 앱의 그 보드로 딥링크.
- **Medium**: 진행중 포도판 2~3개 진행률 + "한 알 채우기" 액션(딥링크 또는 iOS 17+ App Intent 원탭).
- 데이터 소스: 이번에 만든 **`GET /api/widgets/today`**(진행중 보드 + 진행률). 응답 형태 그대로 재사용.

## 3. 데이터 배관 — per-user 위젯 토큰 (additive)

위젯 프로세스는 웹 세션 쿠키를 공유하기 어렵다 → **토큰 기반 read-only 인증**을 추가한다(전부 비파괴 추가).

- **스키마(신규 테이블)**:
  ```prisma
  model WidgetToken {
    id        String   @id @default(cuid())
    userId    String
    token     String   @unique
    createdAt DateTime @default(now())
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    @@index([userId])
  }
  ```
- **신규 API**:
  - `POST /api/auth/widget-token` (정상 로그인 필요) → 토큰 발급, `GET`/`DELETE`로 조회/폐기.
  - `src/lib/auth.ts`에 `verifyWidgetToken(token)` 추가.
  - `GET /api/widgets/today`를 **토큰 또는 쿠키** 둘 다 허용하도록 확장(`?token=` 있으면 토큰 검증, 없으면 기존 쿠키). 현재는 쿠키만 — 토큰 분기만 추가하면 됨.
- **앱 흐름**: 셸이 로그인 후 위젯 토큰을 발급받아 네이티브 측 안전 저장소(iOS Keychain/App Group, Android EncryptedSharedPreferences)에 저장 → 위젯이 주기적으로 `/api/widgets/today?token=...` 호출 → 렌더. 탭 → 앱 딥링크(`podoal://board/<id>` 또는 `https://.../board/<id>`).
- **원탭 채우기(선택)**: `POST /api/widgets/fill?token=...` (다음 빈 칸 1개 채움) — 위젯 인터랙티브 액션. 보안: 토큰=read+limited-write 스코프. 우선순위 낮음.

### 플랫폼별
- **iOS**: WidgetKit 익스텐션(SwiftUI) + `TimelineProvider`. 앱↔위젯 데이터 공유는 **App Group** 컨테이너(토큰 + 마지막 today JSON 캐시). iOS 17+ App Intents로 인터랙티브 위젯.
- **Android**: **Glance**(Jetpack Compose for widgets) + `WorkManager`로 ~30분 주기 갱신. 토큰은 EncryptedSharedPreferences.

## 4. 출시 전 비공개 배포 — 절대 요건

"사람들이 출시 전에 접근하면 안 된다"(사용자) → 3중 잠금.

1. **스토어 트랙을 비공개로 유지**
   - iOS: **TestFlight 내부 테스트**(내부 테스터 ≤100, 앱 리뷰 없이 즉시) — App Store **Production 미공개**(미제출/미출시 상태 유지). 외부 테스트는 베타 리뷰가 붙으니 내부만.
   - Android: **Play Console 내부 테스트(Internal testing) 트랙**(이메일 지정 ≤100) 또는 Closed testing — **Production 승격 전까지 스토어 미노출**.
2. **계정 게이트**: 셸이 기존 podoal 로그인을 강제 → 빌드가 유출돼도 계정 없으면 무용.
3. **백엔드 베타 allowlist(권장)**: `User`에 `betaApproved Boolean @default(false)` 또는 env allowlist를 두고, 위젯/민감 API가 비-베타 계정을 거부. 정식 출시 시 게이트 해제.
   - ⚠️ **현재 웹(`podoal-rouge.vercel.app`)은 이미 공개**다. "제품 전체"를 출시 전 비공개로 원하면 **웹에도 allowlist 게이트**를 따로 적용해야 한다(별도 결정 필요 — 본 기획 범위 밖, 플래그만 남김).

## 5. 로드맵 / 노력 추정

1. **셸 + 토큰/위젯 API**(Capacitor init, WebView 셸, WidgetToken 테이블·엔드포인트, `/widgets/today` 토큰 분기): ~1~2주.
2. **Android Glance 위젯**(내부 테스트 배포): ~2~3주.
3. **iOS WidgetKit 위젯**(TestFlight 내부): ~3~4주(Xcode/Swift/App Group).
4. 인터랙티브(원탭 채우기) + 분석: 이후.

## 6. 이번 라운드에 이미 구현된 웹 그라운드워크

- `public/manifest.json` `shortcuts` — 홈 아이콘 꾹 누르면 "오늘 한 알 채우기"/"새 포도판" 바로가기(Android/iOS PWA).
- `GET /api/widgets/today` — 진행중 보드 + 진행률(쿠키 인증). 네이티브 위젯이 그대로 소비.
- 일일 푸시 넛지 `GET /api/cron/daily-nudge` + `.github/workflows/daily-nudge.yml`(오전 9시 KST). **활성화엔 VAPID 3종 + CRON_SECRET env 필요**(`docs/PUSH_SETUP.md`). 위젯은 아니지만 "잊지 않게" 하는 핵심 대용.
