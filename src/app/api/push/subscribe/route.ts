import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// Save (or refresh) a browser's Web Push subscription for the current user.
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  try {
    const body = await request.json();
    const endpoint: unknown = body?.endpoint;
    const p256dh: unknown = body?.keys?.p256dh;
    const auth: unknown = body?.keys?.auth;

    if (
      typeof endpoint !== 'string' || endpoint.length === 0 ||
      typeof p256dh !== 'string' || p256dh.length === 0 ||
      typeof auth !== 'string' || auth.length === 0
    ) {
      return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
    }

    // endpoint is globally unique; upsert so re-subscribing or device handoff
    // re-points the row at the current user.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh, auth },
      create: { userId, endpoint, p256dh, auth },
    });

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
