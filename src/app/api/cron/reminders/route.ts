import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser } from '@/lib/push';

// Server-side reminder dispatcher. Intended to be hit once a minute by Vercel
// Cron (vercel.json) — this is what makes reminders fire even when the app is
// closed (the client useReminderScheduler only works while a tab is open).
//
// Protect with CRON_SECRET env. Vercel Cron automatically sends
// `Authorization: Bearer <CRON_SECRET>` when that env var is set.
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

  // Candidate reminders: active + time matches this minute. Day + dedupe in JS.
  const candidates = await prisma.reminder.findMany({
    where: { isActive: true, time: hhmm },
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
