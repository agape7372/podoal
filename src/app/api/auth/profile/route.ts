import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { AVATAR_OPTIONS } from '@/types';

// New, additive endpoint: lets a signed-in user update their display name and
// avatar (the only mutable profile fields). Email/provider stay read-only.
// Does NOT touch the existing /api/auth/me contract.
const VALID_AVATARS = new Set<string>(AVATAR_OPTIONS);

export async function PATCH(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return authResponse('Unauthorized');

    const body = (await request.json().catch(() => null)) as
      | { name?: unknown; avatar?: unknown; dayResetHour?: unknown }
      | null;
    if (!body || typeof body !== 'object') {
      return Response.json({ error: '잘못된 요청이에요.' }, { status: 400 });
    }

    const data: { name?: string; avatar?: string; dayResetHour?: number } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (name.length < 1 || name.length > 40) {
        return Response.json({ error: '이름은 1~40자여야 해요.' }, { status: 400 });
      }
      data.name = name;
    }

    if (body.avatar !== undefined) {
      if (typeof body.avatar !== 'string' || !VALID_AVATARS.has(body.avatar)) {
        return Response.json({ error: '올바르지 않은 아바타예요.' }, { status: 400 });
      }
      data.avatar = body.avatar;
    }

    if (body.dayResetHour !== undefined) {
      const hour = body.dayResetHour;
      if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 6) {
        return Response.json({ error: '하루의 시작 시각은 0~6시 사이의 정수여야 해요.' }, { status: 400 });
      }
      data.dayResetHour = hour;
    }

    if (Object.keys(data).length === 0) {
      return Response.json({ error: '변경할 내용이 없어요.' }, { status: 400 });
    }

    const user = await prisma.user.update({ where: { id: userId }, data });

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider,
        // additive(C4-b) — 설정 UI가 저장 직후 반영 확인에 쓴다.
        dayResetHour: user.dayResetHour,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return Response.json({ error: '프로필을 저장하지 못했어요.' }, { status: 500 });
  }
}
