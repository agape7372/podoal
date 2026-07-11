import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser, inDnd } from '@/lib/push';
import { computeFillPace } from '@/lib/pace';
import { zonedDateKey } from '@/lib/streak';

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

// ripe 분기 전용 — 리마인더 `days`(1=월..7=일) 스키마와 맞춘 요일 계산. 오너 타임존 기준
// 날짜 키(zonedDateKey, streak.ts 정본)에서 요일만 뽑아낸다 — 이 파일의 기존 KST 고정
// kstNowParts()는 시간 지정 리마인더 경로 전용이라 건드리지 않는다(회귀 0 계약).
function zonedDayOfWeek(dateKey: string): number {
  const jsDow = new Date(Date.parse(`${dateKey}T00:00:00Z`)).getUTCDay(); // 0=Sun..6=Sat
  return jsDow === 0 ? 7 : jsDow; // 1=Mon..7=Sun
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
  // type='ripe'는 별도 분기(아래)에서 처리 — 시간 무관이라 이 시간 임계 쿼리에 안 걸려야
  // 한다. 미인식 type은 fail-open으로 여기(time 취급)에 남는다.
  const candidates = await prisma.reminder.findMany({
    where: { isActive: true, time: { lte: hhmm }, type: { not: 'ripe' } },
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

  // ─── ripe 리마인더 분기(C4-c, FILL_CADENCE_PLAN §7) ─────────────────────────
  // "포도알이 다 익었어요" — 보드가 채우는 리듬(cadence) 몫을 아직 못 채웠으면 알린다.
  // 전 보드 스캔 없이 활성 ripe 리마인더에서 출발(boardId는 생성/수정 시 이미 필수 검증됨).
  const ripeReminders = await prisma.reminder.findMany({
    where: { isActive: true, type: 'ripe' },
    include: {
      board: {
        select: {
          isCompleted: true,
          harvestedAt: true,
          cadenceType: true,
          cadenceN: true,
          stickers: { select: { filledAt: true, isBackfill: true } },
        },
      },
      user: {
        select: {
          timezone: true,
          dayResetHour: true,
          notificationSetting: { select: { dndStart: true, dndEnd: true } },
        },
      },
    },
  });

  let ripeSent = 0;
  const now = new Date();
  for (const r of ripeReminders) {
    if (!r.board) continue; // ripe는 boardId 필수 — 방어적 스킵(고아 데이터 대비)
    if (r.board.isCompleted || r.board.harvestedAt) continue; // 완료·수확 보드는 "익음" 없음

    const timezone = r.user.timezone;
    const resetHour = r.user.dayResetHour;
    const todayKey = zonedDateKey(now, timezone, resetHour);
    const todayDow = zonedDayOfWeek(todayKey);

    const days = r.days.split(',').map((d) => parseInt(d, 10));
    if (!days.includes(todayDow)) continue;

    // 오늘 이미 보낸 리마인더는 스킵(dedupe) — 오너 타임존/dayResetHour 기준 날짜키 비교.
    if (r.lastSentAt && zonedDateKey(r.lastSentAt, timezone, resetHour) === todayKey) continue;

    const pace = computeFillPace(
      { cadenceType: r.board.cadenceType, cadenceN: r.board.cadenceN },
      r.board.stickers.map((s) => ({ filledAt: s.filledAt, isBackfill: s.isBackfill })),
      now,
      timezone,
      resetHour,
    );
    // pace===null(FREE/미인식) 또는 이번 기간 몫을 이미 채웠으면(ripe:false) 알릴 게 없다.
    if (!pace || !pace.ripe) continue;

    // DND 삼킴 함정(이 카드의 핵심): sendPushToUser는 DND 안이면 조용히 스킵하는데,
    // 그걸 모르고 lastSentAt을 먼저 마킹하면 dedupe 때문에 그날 알림이 영구 유실된다.
    // 여기서 먼저 판정해 DND 안이면 발송·마킹 둘 다 건너뛴다 — 다음 5분 틱이 자연 재시도.
    const setting = r.user.notificationSetting;
    if (setting && inDnd(setting.dndStart, setting.dndEnd)) continue;

    await sendPushToUser(
      r.userId,
      {
        title: '🍇 포도알 리마인더',
        body: r.message || '포도알이 다 익었어요 🍇',
        url: '/home',
        tag: `reminder-${r.id}-${todayKey}`,
      },
      'reminder'
    );
    await prisma.reminder.update({ where: { id: r.id }, data: { lastSentAt: now } });
    ripeSent++;
  }

  return NextResponse.json({
    ok: true,
    checked: candidates.length,
    sent,
    ripeChecked: ripeReminders.length,
    ripeSent,
    at: `${date} ${hhmm} KST`,
  });
}
