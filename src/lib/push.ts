// Server-side Web Push (VAPID) sender. Fire-and-forget; never throws to callers.
// Activation: set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (and optionally
// VAPID_SUBJECT) env vars. Without them this module is a no-op so builds/runs
// degrade gracefully (in-app SSE still works).
import webpush from 'web-push';
import { prisma } from './prisma';

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@podoal.app';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC || !PRIVATE) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
  return true;
}

export type PushCategory =
  | 'cheer'
  | 'celebration'
  | 'gift'
  | 'reward'
  | 'relay'
  | 'reminder'
  | 'weeklyRecap';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  emoji?: string;
  tag?: string;
}

interface ToggleSetting {
  globalEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  cheerEnabled: boolean;
  rewardEnabled: boolean;
  relayEnabled: boolean;
  reminderEnabled: boolean;
  weeklyRecapEnabled: boolean;
}

function toMinutes(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

// Current time-of-day in Asia/Seoul (UTC+9, no DST), in minutes since midnight.
function nowKstMinutes(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

/**
 * 방해금지(DND) 시간대 판정 — cron의 ripe 리마인더 분기(C4-c)가 사전 체크용으로 재사용한다
 * (이중 구현 금지). `sendPushToUser` 내부에서도 같은 함수로 게이트하므로, 호출측이 DND 여부를
 * 미리 알아 "발송 스킵 시 lastSentAt도 마킹하지 않는다" 같은 판단을 내릴 수 있다.
 */
export function inDnd(start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === e) return false;
  const n = nowKstMinutes();
  return s < e ? n >= s && n < e : n >= s || n < e; // handles midnight wrap
}

function categoryAllowed(setting: ToggleSetting | null, category?: PushCategory): boolean {
  if (!setting) return true; // no row yet = defaults all-on
  if (!setting.globalEnabled) return false;
  switch (category) {
    case 'cheer':
    case 'celebration':
      return setting.cheerEnabled;
    case 'reward':
      return setting.rewardEnabled;
    case 'relay':
      return setting.relayEnabled;
    case 'reminder':
      return setting.reminderEnabled;
    case 'weeklyRecap':
      return setting.weeklyRecapEnabled;
    case 'gift':
      return true; // gifts always notify — it's a transfer, not spam
    default:
      return true;
  }
}

/** 왜 발송하지 않았는지. null이면 실제로 발송을 시도했다는 뜻. */
export type PushSkipReason =
  | 'not-configured'
  | 'category-blocked'
  | 'dnd'
  | 'no-subscription'
  | 'error';

/**
 * 발송 결과. 이 함수는 절대 throw하지 않으므로(호출자의 요청을 깨뜨리지 않는다는 계약),
 * 호출자가 "정말 나갔는지"를 알 수 있는 유일한 통로가 반환값이다. void였을 때는
 * cron의 `sent` 카운터가 VAPID 미설정·DND·구독 0건에도 성공으로 집계됐다(감사 H-03).
 */
export interface PushSendResult {
  attempted: number;
  delivered: number;
  failed: number;
  skipped: PushSkipReason | null;
}

/**
 * 이 스킵이 "곧 조건이 바뀔 수 있는" 일시적 사유인가.
 *
 * cron이 dedupe 타임스탬프(lastSentAt·lastNudgeSentAt)를 찍을지 결정하는 데 쓴다.
 * DND는 시간이 지나면 저절로 풀리므로 마킹하지 않고 다음 틱에 재시도해야 한다 —
 * 마킹해 버리면 그날 알림이 영구 유실된다(ripe 분기가 이미 막아둔 함정).
 * 반대로 구독 없음·카테고리 차단은 그날 안에 바뀔 가능성이 낮은데, 재시도로 두면
 * 5분마다 무의미한 발송 시도가 하루 종일 반복된다 — 그래서 마킹하고 넘어간다.
 */
export function isTransientSkip(result: PushSendResult): boolean {
  return result.skipped === 'dnd';
}

const SEND_TIMEOUT_MS = 10_000;

/**
 * 개별 push 전송에 상한을 둔다. web-push는 응답 없는 endpoint에서 오래 매달릴 수 있고,
 * 서버리스 함수에서는 그게 곧 함수 타임아웃이다(다른 구독까지 통째로 유실).
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('push send timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * Send a web push to every subscription of a user, honoring their
 * NotificationSetting (global, per-category, DND). Dead endpoints are pruned.
 * Safe to call without awaiting — swallows all errors and reports via the
 * returned `PushSendResult` instead.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  category?: PushCategory
): Promise<PushSendResult> {
  const skip = (reason: PushSkipReason): PushSendResult => ({
    attempted: 0,
    delivered: 0,
    failed: 0,
    skipped: reason,
  });

  try {
    if (!ensureConfigured()) return skip('not-configured');

    const setting = (await prisma.notificationSetting.findUnique({
      where: { userId },
    })) as ToggleSetting | null;

    if (!categoryAllowed(setting, category)) return skip('category-blocked');
    if (setting && inDnd(setting.dndStart, setting.dndEnd)) return skip('dnd');

    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return skip('no-subscription');

    const data = JSON.stringify(payload);
    const outcomes = await Promise.all(
      subs.map(async (s) => {
        try {
          await withTimeout(
            webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              data
            ),
            SEND_TIMEOUT_MS
          );
          return true;
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
          return false;
        }
      })
    );

    const delivered = outcomes.filter(Boolean).length;
    return {
      attempted: subs.length,
      delivered,
      failed: subs.length - delivered,
      skipped: null,
    };
  } catch {
    // never let notification delivery break the caller's request
    return skip('error');
  }
}
