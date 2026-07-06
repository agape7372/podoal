# podoal 수익화 기획 — 포도알 꾸미기(스킨) + 지갑 + 광고 보상

> 상태: **기획(구현 전)**. 실구현은 PG 계약·사업자 등록·앱스토어 계정 등 외부 의존이 있어 로드맵 phase로 편성(`docs/ROADMAP.md` P3). 이 문서는 하위모델이 바로 착수할 수 있는 상세도로 스키마·API·정책·단계를 못박는다.
>
> **핵심 철학(가드레일)**: podoal의 진행(포도알 채우기·보상·릴레이·와이너리)은 **영원히 무료**. 유료는 **꾸미기(코스메틱)뿐**. 습관 형성 제품이 결제 압박·다크패턴을 쓰면 신뢰가 무너진다. 아래 §5 가드레일은 `docs/PRINCIPLES.md`에도 병기한다.

## 0. 한눈에

| 축 | 결정 |
|----|------|
| 무엇을 판다 | 포도알 **스킨**(품종 컨셉: 샤인머스캣·거봉·캠벨·청포도…)과 보드 배경/잎사귀 테마 |
| 과금 모델 | 선충전 **지갑**(포도씨앗 재화) → 스킨 1개 ≒ 200원 상당 차감. + **광고 시청 보상**(무과금 경로) |
| 결제 수단 | 웹 PWA = 국내 PG(토스페이먼츠 결제위젯 1순위). 네이티브 앱 = 스토어 IAP(§4 결정 트리) |
| 광고 | 웹 rewarded 제약 → 현실 경로는 **네이티브 셸(Capacitor)+AdMob rewarded**(WIDGETS_NATIVE_PLAN과 합류) |
| 롤아웃 | R1 스킨 무료 출시 → R2 지갑+PG → R3 광고 보상 |

## 1. 상품 설계 — 스킨

포도알은 이미 이 앱의 시각 심장(GrapeBoard, 히트스톱, 액체 차오름). 여기에 **품종 스킨**을 얹는다 — 세계관 내에서 자연스럽고(포도 마스터가 여러 품종을 기른다), 진행에 영향 없는 순수 코스메틱.

- **무료 기본**: 현재 보라 포도(`grape-*` 팔레트). 항상 무료·기본값.
- **유료 카탈로그(예시)**: 샤인머스캣(연둣빛), 거봉(짙은 자주), 캠벨(적포도), 청포도, 흑포도, 골든(반짝 이펙트) 등. 시즌 스킨(체리블라섬, 눈포도)도 가능.
- **적용 단위 — 옵션 비교**:

| 옵션 | 설명 | 장 | 단 | 권장 |
|------|------|----|----|------|
| A. 계정 전역 | 산 스킨을 프로필에서 하나 선택, 전 보드 적용 | 단순·구현 최소 | 표현 다양성 낮음 | |
| B. **보드 단위** | 보드마다 스킨 지정(`Board.skinId`) | 보드별 개성, 선물 보드에도 실림 | 약간 복잡 | **✅ 권장** |
| C. 알 단위 | 알 하나하나 다른 스킨 | 극한 커스텀 | 구현·UX 과잉, 결제 마찰 | |

→ **B(보드 단위)** 채택. 스킨은 "1회 구매 후 영구 보유(`UserSkin`)", 적용은 보유 스킨 중 보드에 지정. 구매=차감, 적용=무료·무제한. (사용자가 말한 "하나에 200원"은 **구매** 시점 1회, 적용 반복은 무료.)

## 2. 재화·가격

- **지갑 재화명(세계관)**: "포도씨앗"(🌰) 또는 "햇살"(sunshine 팔레트와 연결). 1스킨 ≒ 200원 상당.
- **선충전 패키지(예시)**: ₩1,100(6씨앗) / ₩3,300(20씨앗+보너스2) / ₩5,500(35씨앗) — VAT 포함 표시. 낱개 200원 결제는 PG 최소금액·수수료 구조상 비효율 → **충전 후 차감** 모델(사용자 의도와 일치).
- **광고 보상 경로**: rewarded 광고 N회(예: 5회) 시청 = 1씨앗. 무과금 유저도 시간 투자로 스킨 획득 → 결제 강제 없음(가드레일).
- **환불**: 미사용 충전분 환불 정책 명시(전자상거래법). 사용(스킨 교환) 완료분은 디지털 콘텐츠 환불 예외 고지 후 동의.

## 3. 스키마 draft (additive — 기존 데이터 레이어 불변, 신규 테이블·nullable 컬럼만)

```prisma
model GrapeSkin {                    // 카탈로그(서버 시드/관리)
  id        String   @id @default(cuid())
  key       String   @unique         // 'shine' | 'geobong' | 'campbell' ... (렌더러가 팔레트 매핑)
  name      String                   // '샤인머스캣'
  priceSeed Int                      // 씨앗 가격 (0 = 무료/기본)
  isDefault Boolean  @default(false)
  season    String?                  // 시즌 한정 태그(null=상시)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  owners    UserSkin[]
}

model UserSkin {                     // 보유(구매 이력)
  id         String   @id @default(cuid())
  userId     String
  skinId     String
  acquiredVia String  @default("purchase") // 'purchase' | 'ad' | 'grant'
  createdAt  DateTime @default(now())
  user User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  skin GrapeSkin @relation(fields: [skinId], references: [id])
  @@unique([userId, skinId])         // 중복 보유 방지
  @@index([userId])
}

model Wallet {
  userId    String   @id            // 1:1 유저
  balance   Int      @default(0)    // 씨앗 잔액 (음수 불가 — 앱 레벨 가드 + 트랜잭션)
  updatedAt DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model WalletTransaction {           // 원장(멱등·감사)
  id           String   @id @default(cuid())
  userId       String
  delta        Int                  // +충전/+광고보상 / -스킨구매
  reason       String               // 'topup' | 'ad_reward' | 'skin_purchase' | 'refund'
  idempotencyKey String @unique     // PG 주문번호·광고 세션·구매요청 UUID — 중복 반영 차단(필수)
  balanceAfter Int
  meta         String?              // JSON: PG paymentKey, skinId 등
  createdAt    DateTime @default(now())
  @@index([userId, createdAt])
}
```

- **Board 확장(nullable)**: `skinId String?` + `skin GrapeSkin? @relation(...)`. null=기본 보라. 선물 사본(`giftBoardCopy`)은 skinId 복사할지 결정 — **권장: 복사 안 함**(받는 사람이 자기 스킨으로 꾸미게, 선물=내용 전달). 스키마·마이그레이션은 `docs/MIGRATIONS.md` 절차(`prisma migrate dev`) 준수, **단독 웨이브·opus 배정**.
- **동시성**: 지갑 차감은 반드시 트랜잭션 + `balance >= price` 조건부 update + `WalletTransaction` 원장 동시 기록. 잔액 음수 방지는 낙관적 검사 아닌 트랜잭션 내 재검. Serializable 충돌은 기존 `isSerializationConflict()` 패턴 재사용.

## 4. 결제 연동

### 웹(PWA) — 국내 PG
- **1순위 토스페이먼츠 결제위젯**: 문서·개발자 경험 우수, 간편결제(토스·카드·계좌) 통합. 대안 **포트원(구 아임포트)** — 여러 PG 어그리게이션(다양성 필요 시).
- 흐름: 클라 결제위젯 → 성공 콜백(paymentKey·orderId·amount) → **서버 `/api/wallet/topup/confirm`이 PG 서버승인 API로 재검증**(클라 신뢰 금지) → 금액·주문번호 검증 → `WalletTransaction(reason:'topup', idempotencyKey: orderId)` + `Wallet.balance += seeds` 트랜잭션.
- **웹훅**: PG 결제 웹훅 수신 라우트(`/api/wallet/webhook`) — 서명 검증, `idempotencyKey`로 중복 차단, confirm과 웹훅 둘 중 먼저 온 것이 반영(멱등이라 안전).
- 신규 env: `TOSS_SECRET_KEY`, `TOSS_CLIENT_KEY`(NEXT_PUBLIC), 웹훅 서명 시크릿 → `.env.example` + PLAYBOOK 환경변수 대장에 등재.

### 스킨 구매(재화 차감) — `/api/skins/purchase`
- `getCurrentUserId` 가드 → 스킨 조회 → 이미 보유면 409 → 트랜잭션: `balance >= priceSeed` 검사 → 차감 + `WalletTransaction(reason:'skin_purchase', idempotencyKey: 클라 요청 UUID)` + `UserSkin` 생성. 잔액 부족 402/400 "씨앗이 부족해요".

## 5. 광고 — rewarded

- **웹 PWA의 rewarded 광고는 현실적으로 빈약**(AdSense는 rewarded 미지원, 웹 rewarded 네트워크 제한적·정책 리스크). → **광고 보상은 네이티브 셸 단계(R3)로 미룬다.**
- **네이티브 경로**: `docs/WIDGETS_NATIVE_PLAN.md`의 Capacitor 셸에 **AdMob rewarded** 플러그인. 광고 시청 완료 콜백(SSV, server-side verification) → 서버 `/api/wallet/ad-reward`가 AdMob SSV 서명 검증 → `WalletTransaction(reason:'ad_reward', idempotencyKey: ad_session_id)` 로 씨앗 지급. **클라 콜백만으로 지급 금지**(무한 보상 어뷰징 차단) — SSV 필수.
- 일일 광고 보상 상한(예: 하루 3씨앗)으로 어뷰징·번아웃 방지.

### ⚠ IAP 정책 결정 트리 (핵심 리스크)
네이티브 앱에서 **디지털 재화(씨앗·스킨)** 판매는 앱스토어 IAP 강제(Apple 15~30%, Google 15~30%) 대상이다. 웹 PG로 우회하면 정책 위반 리스크.

```
디지털 스킨/재화를 파는 위치는?
├─ 웹(브라우저 PWA)에서만 판매 → PG 자유(스토어 무관). ✅ R2는 여기서 시작.
├─ 네이티브 앱 안에서 판매
│   ├─ Apple: 앱 내 디지털재화 = StoreKit IAP 강제. 외부결제 링크는
│   │        (미국 등 일부 판결 후) 지역·정책 변동 — 출시 시점 최신 정책 확인 필수.
│   └─ Google: Play Billing 강제(한국은 인앱결제법으로 제3자 결제 일부 허용 — 확인).
│   → 네이티브 유료화는 IAP 통합 필요(수수료 감안한 가격 재설계).
└─ 권장: R2는 웹 PG로만(스토어 심사 무관), 네이티브 앱은 광고 보상(R3)만 먼저.
         네이티브 유료 판매는 IAP 통합을 별도 결정 후.
```

## 6. 가드레일 (PRINCIPLES에 병기 — 어기면 제품 신뢰 붕괴)

1. **진행은 영원히 무료.** 알 채우기·보상·릴레이·와이너리·통계는 결제 뒤로 절대 못 감춘다.
2. **가챠·랜덤박스 금지.** 스킨은 무엇을 사는지 보이는 확정 구매만.
3. **만료·압박 금지.** 씨앗·스킨 만료 없음. "지금 안 사면 손해" 카피 금지.
4. **광고는 opt-in.** rewarded만(강제 전면광고·배너 금지). 습관 화면을 광고로 어지럽히지 않는다.
5. **무과금 완주 가능.** 광고 시청으로 모든 스킨 도달 가능(시간≠지갑 강제).
6. **투명 표시.** 가격 VAT 포함, 환불 정책, 디지털콘텐츠 고지(전자상거래법). 미성년 결제 보호.

## 7. 롤아웃 단계

- **R1 — 스킨 시스템(무료)**: `GrapeSkin` 카탈로그 + `Board.skinId` + 렌더러 팔레트 매핑 + 보드 꾸미기 UI. **결제 없이** 기본 스킨 몇 종 무료 배포 → 커스텀 욕구·리텐션 반응 측정. 데이터 레이어 신규지만 재화 없음(리스크 최소).
- **R2 — 지갑 + 웹 PG**: `Wallet`/`WalletTransaction` + 토스 결제위젯 + `/api/wallet/*` + 유료 스킨 카탈로그. 웹에서만 판매(스토어 무관).
- **R2.5 — 구독 "포도클럽"(§8)**: R2 지갑·카탈로그 가동 + 시즌 스킨 제작 파이프라인 확보 후 검토.
- **R3 — 광고 보상**: 네이티브 셸(WIDGETS_NATIVE_PLAN) + AdMob rewarded + SSV. IAP 정책은 §4 트리로 별도 결정.

각 단계 착수 전 필독: 이 문서 §3(스키마)·§5(가드레일)·§4(IAP), `docs/MIGRATIONS.md`, `docs/PRINCIPLES.md` 데이터 레이어 게이트.

## 8. 구독 — "포도클럽" (R2.5, 기획)

> 월 구독은 **코스메틱 패스 + 후원**이지 기능 게이트가 아니다. §5 가드레일이 그대로 적용되며, 특히 "만료·압박 금지"와의 정합이 설계의 중심.

### 상품 구성 (안)

| 혜택 | 내용 | 가드레일 정합 |
|------|------|--------------|
| 시즌 스킨 지급 | 매월 신규 시즌 스킨 1종 자동 지급(`UserSkin.acquiredVia: 'club'`) | **적립형 — 해지해도 이미 받은 스킨은 영구 보유**(§5.3 만료 금지). "구독 안 하면 잃는다"가 아니라 "하는 달만 쌓인다" |
| 서포터 표식 | 프로필·응원 메시지에 클럽 뱃지/칭호(코스메틱) | 기능 아님 — 진행·소셜 동작 동일(§5.1) |
| 씨앗 보너스(후보) | 월 N씨앗 지급 | 단순 할인 등가 — 남용 여지 없음. 도입 여부는 R2 데이터 보고 결정 |

- 가격대(안): 월 ₩2,900~3,900 — 씨앗 패키지와 등가 비교 가능하게(구독=약간 이득+시즌 한정, 강요 아님).
- 시즌 스킨도 **비구독 경로 존재**: 다음 분기에 씨앗 단품 판매로 풀림(광고 보상 경로 포함 무과금 도달 가능 — §5.5). 클럽의 가치는 "먼저+자동+약간 저렴"이지 독점이 아님.

### 결제·스키마 (additive)

- 웹 전용 시작: **토스페이먼츠 빌링**(정기결제, 카드 등록 → 매월 승인). IAP 이슈 없음(§4 트리의 웹 분기). 네이티브 앱 노출 시 스토어 구독 전환 여부는 R3 시점 §4 트리로 재결정(수수료 15~30% 반영 가격 재설계 필요).
- 신규 테이블(안): `Subscription { userId, status(active|canceled|past_due), billingKey, currentPeriodEnd, canceledAt, createdAt }` + 월 지급은 `WalletTransaction(reason:'club_grant', idempotencyKey: userId+YYYY-MM)` 멱등 — 기존 스키마 불변, §4 마이그레이션 절차·단독 웨이브.
- 웹훅: 빌링 결제 실패 → `past_due` 유예(즉시 박탈 금지), 성공 → 기간 갱신+지급. 모두 멱등 키.

### 해지 UX (신뢰가 상품이다)

- 해지는 설정에서 2탭 이내, 다크패턴(만류 다단계·숨김) 금지. 해지 후에도 보유 스킨·뱃지 이력 유지(뱃지는 "전 서포터" 표기 전환 정도만).
- 자동갱신 고지·환불은 전자상거래법 준수(§2 환불 정책과 동일 프레임). 미성년 결제 보호 동일.

### 착수 조건 (전부 충족 시에만)

1. R2 지갑·유료 스킨이 실가동 중이고 단품 구매 데이터가 있다.
2. 시즌 스킨 제작 파이프라인(AI 아트 — `docs/ILLUSTRATION_STYLE.md` 파이프라인 재사용)이 월 1종을 감당한다.
3. 토스 빌링 계약(일반 PG와 별도 심사) 완료.
