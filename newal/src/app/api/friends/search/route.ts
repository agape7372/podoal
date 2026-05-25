import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { clientKey, rateLimit } from '@/lib/rateLimit';

const searchLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: '검색이 너무 잦아요. 잠시 후 다시 시도해주세요.',
});

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const blocked = searchLimit(`${userId}:${clientKey(request)}`);
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || typeof query !== 'string' || query.length === 0 || query.length > 254) {
      return NextResponse.json(
        { error: 'Search query (q) is required (1~254 chars)' },
        { status: 400 }
      );
    }

    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: query,
        },
        NOT: {
          id: userId,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
      take: 10,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to search users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
