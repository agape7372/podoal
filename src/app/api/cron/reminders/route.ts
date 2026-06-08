import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

// Server-side reminder dispatcher. Hit on a schedule by the GitHub Actions
// workflow (.github/workflows/reminders.yml, ~every 5 min) — this is what makes
// reminders fire even when the app is closed (the client useReminderScheduler
// only works while a tab is open). The Hobby plan can't run Vercel Cron, so an
// external scheduler calls this endpoint with the CRON_SECRET bearer token.
//
// Protect with CRON_SECRET env; the caller sends `Authorization: Bearer <CRON_SECRET>`.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstNowParts() {
  const shifted = new Date(Date.now() + KST_OFFSET_MS);
  const date = shifted.toISOString().split('T')[0];
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  const jsDow = shifted.getUTCDay(); // 0=Sun..6=Sat
  const dow = jsDow === 0 ? 7 : jsDow; // 1=Mon..7=Sun (matches schema `days`)
  return { date, hhmm: `${hh}:${mm}`, dow };
}

function kstDateOf(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().split('T')[0];
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { date, hhmm, dow } = kstNowParts();

  // Due reminders: active + scheduled time already reached today (time <= now).
  // Day-of-week match + once-per-day dedupe (lastSentAt) handled in JS below.
  // Using `lte` (not exact-minute) so a coarse ~5-min cron still fires each
  // reminder on its first run at/after the set time — no minute-precise hit needed.
  const candidates = await prisma.reminder.findMany({
    where: { isActive: true, time: { lte: hhmm } },
    include: { board: { select: { title: true } } },
  });

  let sent = 0;
  for (const r of candidates) {
    const days = r.days.split(',').map((d) => parseInt(d, 10));
    if (!days.includes(dow)) continue;
    if (r.lastSentAt && kstDateOf(r.lastSentAt) === date) continue; // already fired today

    await sendPushToUser(
      r.userId,
      {
        title: '🍇 포도알 리마인더',
        body: r.message || (r.board?.title ? `${r.board.title} 시간이에요!` : '오늘의 포도알을 채워보세요!'),
        url: '/home',
        tag: `reminder-${r.id}-${date}`,
      },
      'reminder'
    );
    await prisma.reminder.update({ where: { id: r.id }, data: { lastSentAt: new Date() } });
    sent++;
  }

  return NextResponse.json({ ok: true, checked: candidates.length, sent, at: `${date} ${hhmm} KST` });
}
