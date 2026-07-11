import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

// 주간 회고 결산 푸시 — 최근 7일(KST, 오늘 포함) 포도알을 채운 사용자에게만
// "이번 주 N개" 결산을 보내 /stats의 주간 카드로 유도한다. reminders.yml과
// 동일하게 GitHub Actions(weekly-recap.yml, 일요일 저녁 KST)가 CRON_SECRET
// 베어러로 호출한다(Hobby는 Vercel Cron 일 1회 한도 — vercel.json에 크론 금지).
// 카테고리 'weeklyRecap'이라 NotificationSetting(global/weeklyRecap/DND)으로
// 게이팅된다. 기본 켜짐(default true)이라 daily-nudge와 반대로 "옵트아웃"만
// 배치 조회해 후보에서 뺀다 — sendPushToUser의 카테고리 게이트는 발송 성공
// 여부를 반환하지 않아(fire-and-forget) sent 카운트에 반영되지 않으므로,
// 크론 응답으로 게이팅을 증명하려면 후보 산출 단계에서 걸러야 한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nowKstMs = Date.now() + KST_OFFSET_MS;
  const date = new Date(nowKstMs).toISOString().split('T')[0];
  // 통계 화면의 "최근 7일"(dailyStickers)과 같은 창: KST 오늘 00:00 기준 6일 전부터.
  const todayKstStartUtcMs = Math.floor(nowKstMs / 86_400_000) * 86_400_000 - KST_OFFSET_MS;
  const since = new Date(todayKstStartUtcMs - 6 * 86_400_000);

  // 7일 내 활동자만, 쿼리 1개로 사용자별 주간 개수 집계(전체 유저 폭주 방지).
  const weekly = await prisma.sticker.groupBy({
    by: ['filledBy'],
    where: { filledAt: { gte: since } },
    _count: { _all: true },
  });

  // 옵트아웃 사용자만 배치 조회 — 기본 켜짐(weeklyRecapEnabled default true)이라
  // 행이 없거나 true면 수신 대상, false로 명시한 사용자만 후보에서 제외한다.
  const optedOut = await prisma.notificationSetting.findMany({
    where: { userId: { in: weekly.map((w) => w.filledBy) }, weeklyRecapEnabled: false },
    select: { userId: true },
  });
  const optedOutIds = new Set(optedOut.map((o) => o.userId));

  let sent = 0;
  for (const w of weekly) {
    if (optedOutIds.has(w.filledBy)) continue;
    await sendPushToUser(
      w.filledBy,
      {
        title: '이번 주 포도 농사 결산 🍇',
        body: `이번 주 포도알 ${w._count._all}개를 모았어요. 주간 카드를 확인해보세요`,
        url: '/stats',
        tag: `weekly-recap-${date}`,
      },
      'weeklyRecap',
    );
    sent++;
  }

  return NextResponse.json({
    ok: true,
    candidates: weekly.length,
    optedOut: optedOutIds.size,
    sent,
    at: `${date} KST`,
  });
}
