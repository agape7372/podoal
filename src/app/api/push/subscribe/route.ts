import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import {
  validatePushEndpoint,
  validatePushKeys,
  MAX_SUBSCRIPTIONS_PER_USER,
} from '@/lib/pushEndpoint';

// 저장된 endpoint는 서버가 스스로 요청을 보내는 대상이 된다(web-push). 무제한 저장을
// 허용하면 임의 호스트로의 서버발 요청·fanout 증폭 통로가 된다 — 감사 H-03.
// 구독 갱신은 정상적으로도 드물게 일어나므로 한도를 넉넉히 두되 폭주는 막는다.
const subscribeLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.',
});

// Save (or refresh) a browser's Web Push subscription for the current user.
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const blocked = await subscribeLimit(`push-subscribe:${userId}`);
  if (blocked) return blocked;

  try {
    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== 'object') {
      return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
    }

    const endpoint: unknown = (body as { endpoint?: unknown }).endpoint;
    const keys = (body as { keys?: { p256dh?: unknown; auth?: unknown } }).keys ?? {};

    const endpointVerdict = validatePushEndpoint(endpoint, process.env.PUSH_ENDPOINT_ALLOWLIST);
    if (!endpointVerdict.ok) {
      return NextResponse.json({ error: endpointVerdict.reason }, { status: 400 });
    }

    const keyVerdict = validatePushKeys(keys.p256dh, keys.auth);
    if (!keyVerdict.ok) {
      return NextResponse.json({ error: keyVerdict.reason }, { status: 400 });
    }

    // 위 검증을 통과했으므로 문자열이다.
    const safeEndpoint = endpoint as string;
    const p256dh = keys.p256dh as string;
    const auth = keys.auth as string;

    // endpoint is globally unique; upsert so re-subscribing or device handoff
    // re-points the row at the current user.
    await prisma.pushSubscription.upsert({
      where: { endpoint: safeEndpoint },
      update: { userId, p256dh, auth },
      create: { userId, endpoint: safeEndpoint, p256dh, auth },
    });

    // 사용자당 구독 상한 — 넘으면 오래된 것부터 정리한다. 기기를 여러 대 쓰는 정상
    // 사용자는 상한에 닿지 않고, 구독을 쌓아 fanout 비용을 키우는 경로만 막힌다.
    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (subs.length > MAX_SUBSCRIPTIONS_PER_USER) {
      const stale = subs.slice(MAX_SUBSCRIPTIONS_PER_USER).map((s) => s.id);
      await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('push subscribe failed:', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

// Remove a subscription (user disabled push or unsubscribed in the browser).
export async function DELETE(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const body = await request.json().catch(() => ({}));
    const endpoint: unknown = body?.endpoint;
    if (typeof endpoint !== 'string' || endpoint.length === 0) {
      return NextResponse.json({ error: 'invalid endpoint' }, { status: 400 });
    }
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('push unsubscribe failed:', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
