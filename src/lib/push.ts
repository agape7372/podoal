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

function inDnd(start: string, end: string): boolean {
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

/**
 * Send a web push to every subscription of a user, honoring their
 * NotificationSetting (global, per-category, DND). Dead endpoints are pruned.
 * Safe to call without awaiting — swallows all errors.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  category?: PushCategory
): Promise<void> {
  try {
    if (!ensureConfigured()) return;

    const setting = (await prisma.notificationSetting.findUnique({
      where: { userId },
    })) as ToggleSetting | null;

    if (!categoryAllowed(setting, category)) return;
    if (setting && inDnd(setting.dndStart, setting.dndEnd)) return;

    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) return;

    const data = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            data
          );
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          }
        }
      })
    );
  } catch {
    // never let notification delivery break the caller's request
  }
}
