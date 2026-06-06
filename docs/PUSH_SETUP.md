# 선물 알림 · 백그라운드 푸시 활성화 가이드

이 브랜치(`feat/gift-notify-push`)는 다음을 추가합니다.

## 무엇이 바뀌었나
- **선물 알림**: 포도판을 선물하면 받는 사람에게 인박스 메시지(`type: 'gift'`) + 백그라운드 푸시가 발송됩니다. (이전엔 조용히 등장만 했음)
- **선물 메시지 + 언박싱**: 선물에 메모를 첨부할 수 있고, 받는 사람은 보드 첫 진입 시 "선물 받기/거절" 언박싱 모달(컨페티)을 봅니다.
- **웹푸시(VAPID)**: 앱을 닫아도 리마인더·선물·응원 알림이 OS 알림으로 옵니다. (`public/sw.js`의 기존 push 핸들러에 구독·서버 발송·딥링크 연결)
- **알림 토글 실연결**: 끄면 실제로 해당 카테고리 푸시가 안 옵니다(전체/카테고리/방해금지 시간 반영).
- **서버측 리마인더 크론**: `/api/cron/reminders`가 만기 리마인더를 찾아 푸시.

## 활성화에 필요한 환경변수 (Vercel → Settings → Environment Variables)

| 변수 | 값 | 비고 |
|------|-----|------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (공개키 — 채팅으로 전달) | 클라이언트 구독용. 공개 가능 |
| `VAPID_PRIVATE_KEY` | (비밀키 — 채팅으로 전달, **절대 커밋 금지**) | 서버 서명용 |
| `VAPID_SUBJECT` | `mailto:hjm1342@gmail.com` | 선택(기본값 동일) |
| `CRON_SECRET` | 임의의 긴 랜덤 문자열 | 크론 엔드포인트 보호 |

> VAPID 키 재발급이 필요하면: `node -e "console.log(require('web-push').generateVAPIDKeys())"`
> 키를 바꾸면 기존 구독은 무효가 되어 사용자가 다시 "푸시 켜기"를 눌러야 합니다.

## DB 마이그레이션
신규 `PushSubscription` 테이블 + `Board.giftMessage/giftOpenedAt` + `Reminder.lastSentAt` 컬럼이 추가됩니다.
`npm run build`가 `prisma db push`를 선행하므로 Vercel 배포 시 자동 반영됩니다. (모두 non-breaking 추가)

## 크론(서버측 리마인더)
`vercel.json`에 `/api/cron/reminders`가 **매분** 실행으로 등록돼 있습니다.
- **Vercel Pro**: 분 단위 실행 → 리마인더가 설정 시각에 정확히 발송됩니다.
- **Vercel Hobby**: 크론은 **하루 1회**로 제한 → 분 단위 리마인더가 필요하면 외부 크론(예: cron-job.org)에서
  `GET https://podoal-rouge.vercel.app/api/cron/reminders` 를 매분 호출하고 헤더에
  `Authorization: Bearer <CRON_SECRET>` 를 넣으세요.

## iOS
iOS는 **홈 화면에 추가한 PWA**에서만 웹푸시가 동작합니다(iOS 16.4+). 설치 전에는 알림 설정 화면에서
"홈 화면에 추가 후 사용" 안내가 표시되고, 푸시 버튼은 노출되지 않습니다.

## 검증 상태
- `tsc --noEmit` 0 · `eslint` 0 에러 · `next build` 통과
- ⚠️ 실기기 푸시 E2E(실제 알림 수신)는 VAPID 환경변수 설정 후 기기에서 확인 필요(빌드 환경에서는 검증 불가)
