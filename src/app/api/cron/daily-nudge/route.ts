import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser, isTransientSkip } from '@/lib/push';
import { shouldSendNudge } from '@/lib/nudge';
import { verifyCronAuth } from '@/lib/cronAuth';

// 일일 넛지(위젯 대용) — 진행중(미완료·미수확) 포도판이 있고 **데일리 넛지를 켠(opt-in)**
// 사용자에게 하루 1회 "아직 채울 한 알이 남았어요" 푸시. reminders.yml 과 동일하게
// GitHub Actions가 CRON_SECRET 베어러로 하루 1회(KST 오전) 호출한다(Hobby는 Vercel Cron 일 1회 한도).
// - opt-in: NotificationSetting.dailyNudgeEnabled (기본 false — 설정 행 없음 = 미발송)
// - 중복 가드: lastNudgeSentAt이 오늘(KST)이면 스킵, 발송 후 갱신 (Reminder.lastSentAt 패턴)
// - 카테고리 'reminder' 라 NotificationSetting(global/reminder/DND) 게이팅도 그대로 적용된다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 푸시 발송 배치 크기(B6) — 순차 await 대신 이 크기의 Promise.allSettled 청크로 발송.
const CRON_PUSH_CHUNK = 10;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const date = new Date(now.getTime() + KST_OFFSET_MS).toISOString().split('T')[0];

  // 채울 거리가 남은(미완료·미수확) 보드의 주인/수신자를 모은다.
  const boards = await prisma.board.findMany({
    where: { isCompleted: false, harvestedAt: null },
    select: { ownerId: true, giftedToId: true },
  });
  const userIds = new Set<string>();
  for (const b of boards) {
    userIds.add(b.ownerId);
    if (b.giftedToId) userIds.add(b.giftedToId);
  }

  // opt-in 사용자만 — 설정 행이 없거나 dailyNudgeEnabled=false 면 후보에서 제외.
  const optedIn = await prisma.notificationSetting.findMany({
    where: { userId: { in: [...userIds] }, dailyNudgeEnabled: true },
    select: { userId: true, dailyNudgeEnabled: true, lastNudgeSentAt: true },
  });

  // 오늘(KST) 이미 발송한 사용자는 사전 제외(skipped, 크론 중복 실행 가드) — 나머지만 발송.
  const toSend = optedIn.filter((setting) => shouldSendNudge(setting, now));
  const skipped = optedIn.length - toSend.length;

  // 순차 await → 청크(CRON_PUSH_CHUNK) 단위 Promise.allSettled 배치(B6): 대상 증가 시
  // 서버리스 타임아웃 방지. 개별 실패 격리(현행 try/catch와 동등 — rejected=failed),
  // 발송 후 lastNudgeSentAt 마킹 순서·의미 불변.
  // lastNudgeSentAt은 **실제로 전달된 경우에만** 갱신한다(감사 H-03 부수 수정).
  // 예전에는 발송 여부와 무관하게 마킹해서, 09:23 KST가 사용자의 DND 안이거나
  // globalEnabled=false면 푸시는 조용히 버려지고 하루치 중복 가드만 소모됐다.
  // reminders 라우트의 ripe 분기가 이미 쓰는 "스킵이면 마킹도 안 한다" 규칙과 통일.
  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  for (let i = 0; i < toSend.length; i += CRON_PUSH_CHUNK) {
    const results = await Promise.allSettled(
      toSend.slice(i, i + CRON_PUSH_CHUNK).map(async (setting) => {
        const result = await sendPushToUser(
          setting.userId,
          {
            title: '🍇 포도알',
            body: '아직 채울 한 알이 남았어요. 오늘도 한 알 어때요?',
            url: '/home',
            tag: `daily-nudge-${date}`,
          },
          'reminder',
        );
        if (isTransientSkip(result)) return result; // DND — 마킹 없이 다음 실행에 재시도
        await prisma.notificationSetting.update({
          where: { userId: setting.userId },
          data: { lastNudgeSentAt: new Date() },
        });
        return result;
      }),
    );
    for (const r of results) {
      if (r.status === 'rejected') failed += 1;
      else if (r.value.delivered > 0) sent += 1;
      else suppressed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: userIds.size,
    optedIn: optedIn.length,
    sent,          // 실제로 한 대 이상 기기에 전달된 사용자 수
    suppressed,    // 대상이었으나 미설정·DND·구독없음 등으로 전달되지 않은 수
    skipped,       // 오늘 이미 발송해 사전 제외된 수
    failed,
    at: `${date} KST`,
  });
}
