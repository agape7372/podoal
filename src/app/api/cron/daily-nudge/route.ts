import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

// 일일 넛지(위젯 대용) — 진행중(미완료·미수확) 포도판이 있는 사용자에게 하루 1회
// "아직 채울 한 알이 남았어요" 푸시. reminders.yml 과 동일하게 GitHub Actions가
// CRON_SECRET 베어러로 하루 1회(KST 오전) 호출한다(Hobby는 Vercel Cron 일 1회 한도).
// 카테고리 'reminder' 라 NotificationSetting(global/reminder/DND)으로 게이팅된다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = new Date(Date.now() + KST_OFFSET_MS).toISOString().split('T')[0];

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

  let sent = 0;
  for (const uid of userIds) {
    await sendPushToUser(
      uid,
      {
        title: '🍇 포도알',
        body: '아직 채울 한 알이 남았어요. 오늘도 한 알 어때요?',
        url: '/home',
        tag: `daily-nudge-${date}`,
      },
      'reminder',
    );
    sent++;
  }

  return NextResponse.json({ ok: true, candidates: userIds.size, sent, at: `${date} KST` });
}
