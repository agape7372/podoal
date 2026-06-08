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

  const blocked = await searchLimit(`${userId}:${clientKey(request)}`);
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(request.url);
    // 검증은 trim된 값 기준 — 공백-only 쿼리("   ")가 contains "" 로 전체 유저를 열거하는 누수 차단.
    const q = (searchParams.get('q') ?? '').trim();

    if (q.length === 0 || q.length > 254) {
      return NextResponse.json(
        { error: 'Search query (q) is required (1~254 chars)' },
        { status: 400 }
      );
    }

    // 이름 또는 이메일 부분일치(대소문자 무시). 이메일로도 찾을 수 있지만 응답엔 email을 담지 않는다(PII/enumeration 방지).
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { NOT: { id: userId } },
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        avatar: true,
      },
      take: 10,
    });

    // 각 결과의 친구관계 상태를 라벨링 → UI가 버튼(친구요청/요청됨/요청받음/친구)을 분기.
    const ids = users.map((u) => u.id);
    const rels = ids.length
      ? await prisma.friendship.findMany({
          where: {
            OR: [
              { requesterId: userId, receiverId: { in: ids } },
              { requesterId: { in: ids }, receiverId: userId },
            ],
          },
          select: { requesterId: true, receiverId: true, status: true },
        })
      : [];

    const statusFor = (otherId: string): 'none' | 'pending_sent' | 'pending_received' | 'accepted' => {
      const rel = rels.find(
        (r) =>
          (r.requesterId === userId && r.receiverId === otherId) ||
          (r.requesterId === otherId && r.receiverId === userId),
      );
      if (!rel) return 'none';
      if (rel.status === 'accepted') return 'accepted';
      return rel.requesterId === userId ? 'pending_sent' : 'pending_received';
    };

    return NextResponse.json(users.map((u) => ({ ...u, status: statusFor(u.id) })));
  } catch (error) {
    console.error('Failed to search users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
