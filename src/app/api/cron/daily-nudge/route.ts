import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';
import { shouldSendNudge } from '@/lib/nudge';

// 일일 넛지(위젯 대용) — 진행중(미완료·미수확) 포도판이 있고 **데일리 넛지를 켠(opt-in)**
// 사용자에게 하루 1회 "아직 채울 한 알이 남았어요" 푸시. reminders.yml 과 동일하게
// GitHub Actions가 CRON_SECRET 베어러로 하루 1회(KST 오전) 호출한다(Hobby는 Vercel Cron 일 1회 한도).
// - opt-in: NotificationSetting.dailyNudgeEnabled (기본 false — 설정 행 없음 = 미발송)
// - 중복 가드: lastNudgeSentAt이 오늘(KST)이면 스킵, 발송 후 갱신 (Reminder.lastSentAt 패턴)
// - 카테고리 'reminder' 라 NotificationSetting(global/reminder/DND) 게이팅도 그대로 적용된다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
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

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const setting of optedIn) {
    if (!shouldSendNudge(setting, now)) {
      skipped++; // 오늘(KST) 이미 발송 — 크론 중복 실행 가드
      continue;
    }
    try {
      await sendPushToUser(
        setting.userId,
        {
          title: '🍇 포도알',
          body: '아직 채울 한 알이 남았어요. 오늘도 한 알 어때요?',
          url: '/home',
          tag: `daily-nudge-${date}`,
        },
        'reminder',
      );
      await prisma.notificationSetting.update({
        where: { userId: setting.userId },
        data: { lastNudgeSentAt: new Date() },
      });
      sent++;
    } catch {
      failed++; // 개별 실패가 나머지 발송을 막지 않게
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: userIds.size,
    optedIn: optedIn.length,
    sent,
    skipped,
    failed,
    at: `${date} KST`,
  });
}
