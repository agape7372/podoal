import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushToUser, inDnd, isTransientSkip } from '@/lib/push';
import { computeFillPace } from '@/lib/pace';
import { zonedDateKey } from '@/lib/streak';
import { verifyCronAuth } from '@/lib/cronAuth';

// Server-side reminder dispatcher. Hit on a schedule by the GitHub Actions
// workflow (.github/workflows/reminders.yml, ~every 5 min) — this is what makes
// reminders fire even when the app is closed (the client useReminderScheduler
// only works while a tab is open). The Hobby plan can't run Vercel Cron, so an
// external scheduler calls this endpoint with the CRON_SECRET bearer token.
//
// Protect with CRON_SECRET env; the caller sends `Authorization: Bearer <CRON_SECRET>`.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 푸시 발송 배치 크기(B6) — 순차 await 대신 이 크기의 Promise.allSettled 청크로 발송.
const CRON_PUSH_CHUNK = 10;

function kstNowParts() {
  const shifted = new Date(Date.now() + KST_OFFSET_MS);
  const date = shifted.toISOString().split('T')[0];
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  const jsDow = shifted.getUTCDay(); // 0=Sun..6=Sat
  const dow = jsDow === 0 ? 7 : jsDow; // 1=Mon..7=Sun (matches schema `days`)
  return { date, hhmm: `${hh}:${mm}`, dow };
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
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { date, hhmm, dow } = kstNowParts();

  // Due reminders: active + scheduled time already reached today (time <= now).
  // Day-of-week match handled in JS below; once-per-day dedupe (lastSentAt) is now
  // pushed into the query (B9) so we don't load already-sent rows — leverages the
  // @@index([isActive, time]) index. Using `lte` (not exact-minute) so a coarse
  // ~5-min cron still fires each reminder on its first run at/after the set time.
  // type='ripe'는 별도 분기(아래)에서 처리 — 시간 무관이라 이 시간 임계 쿼리에 안 걸려야
  // 한다. 미인식 type은 fail-open으로 여기(time 취급)에 남는다.
  // KST 당일 경계(weekly-recap과 동일 방식): 오늘 00:00 KST의 UTC 시각.
  const nowKstMs = Date.now() + KST_OFFSET_MS;
  const kstDayStart = new Date(Math.floor(nowKstMs / 86_400_000) * 86_400_000 - KST_OFFSET_MS);
  const candidates = await prisma.reminder.findMany({
    where: {
      isActive: true,
      time: { lte: hhmm },
      type: { not: 'ripe' },
      // 오늘(KST) 아직 안 보낸 것만: 미발송(null) 또는 당일 경계 이전 발송분.
      OR: [{ lastSentAt: null }, { lastSentAt: { lt: kstDayStart } }],
    },
    include: { board: { select: { title: true } } },
  });

  // 요일(days CSV) 필터만 JS 잔류(스키마가 CSV 문자열) — 당일 dedupe는 위 쿼리로 이관됨.
  const due = candidates.filter((r) => r.days.split(',').map((d) => parseInt(d, 10)).includes(dow));

  // 순차 await → 청크(CRON_PUSH_CHUNK) 단위 Promise.allSettled 배치(B6): 대상 증가 시
  // 서버리스 타임아웃 방지. 개별 실패는 격리(sendPushToUser는 throw 안 함 — push.ts).
  //
  // lastSentAt 마킹은 DND 스킵일 때만 건너뛴다(isTransientSkip). 아래 ripe 분기가
  // 사전 inDnd 체크로 막아둔 "DND 삼킴 → 그날 알림 영구 유실" 함정이 이 시간 기반
  // 분기에는 없었다 — 발송 결과를 보고 같은 규칙을 적용한다. 쿼리가 `time <= 지금`
  // + 당일 미발송으로 후보를 뽑으므로, 마킹하지 않으면 다음 5분 틱이 자연 재시도한다.
  let sent = 0;
  let suppressed = 0;
  let failed = 0;
  for (let i = 0; i < due.length; i += CRON_PUSH_CHUNK) {
    const results = await Promise.allSettled(
      due.slice(i, i + CRON_PUSH_CHUNK).map(async (r) => {
        const result = await sendPushToUser(
          r.userId,
          {
            title: '🍇 포도알 리마인더',
            body: r.message || (r.board?.title ? `${r.board.title} 시간이에요!` : '오늘의 포도알을 채워보세요!'),
            url: '/home',
            tag: `reminder-${r.id}-${date}`,
          },
          'reminder'
        );
        if (isTransientSkip(result)) return result;
        await prisma.reminder.update({ where: { id: r.id }, data: { lastSentAt: new Date() } });
        return result;
      }),
    );
    for (const x of results) {
      if (x.status === 'rejected') failed += 1;
      else if (x.value.delivered > 0) sent += 1;
      else suppressed += 1;
    }
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

  const now = new Date();
  // 발송 대상 선별(순수 판정, 부작용 없음) — DND 사전판정·ripe 분기·dedupe 의미 불변.
  // 발송/마킹만 아래에서 배치하고, 필터는 그대로 순차 판정한다(타임존이 유저별이라
  // 쿼리 이관 불가). todayKey는 발송 tag에 쓰이므로 함께 실어둔다.
  const ripeToSend: { r: (typeof ripeReminders)[number]; todayKey: string }[] = [];
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

    ripeToSend.push({ r, todayKey });
  }

  // 선별된 대상만 청크(CRON_PUSH_CHUNK) 배치 발송(B6) — 순차 await 제거, 발송 후 마킹
  // 순서·의미 불변, 개별 실패 격리.
  let ripeSent = 0;
  let ripeSuppressed = 0;
  for (let i = 0; i < ripeToSend.length; i += CRON_PUSH_CHUNK) {
    const results = await Promise.allSettled(
      ripeToSend.slice(i, i + CRON_PUSH_CHUNK).map(async ({ r, todayKey }) => {
        const result = await sendPushToUser(
          r.userId,
          {
            title: '🍇 포도알 리마인더',
            body: r.message || '포도알이 다 익었어요 🍇',
            url: '/home',
            tag: `reminder-${r.id}-${todayKey}`,
          },
          'reminder'
        );
        if (isTransientSkip(result)) return result;
        await prisma.reminder.update({ where: { id: r.id }, data: { lastSentAt: now } });
        return result;
      }),
    );
    for (const x of results) {
      if (x.status === 'fulfilled' && x.value.delivered > 0) ripeSent += 1;
      else ripeSuppressed += 1;
    }
  }

  // sent/ripeSent는 이제 "실제로 한 대 이상 기기에 전달된 건수"다. 예전에는
  // sendPushToUser가 void라 VAPID 미설정·DND·구독 0건도 전부 성공으로 집계돼
  // 운영 지표로 쓸 수 없었다(감사 H-03·M-05).
  return NextResponse.json({
    ok: true,
    checked: candidates.length,
    sent,
    suppressed,
    failed,
    ripeChecked: ripeReminders.length,
    ripeSent,
    ripeSuppressed,
    at: `${date} ${hhmm} KST`,
  });
}
