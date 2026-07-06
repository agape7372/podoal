import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { isNonEmptyString, isPlainObject } from '@/lib/validate';
import { clientKey, rateLimit } from '@/lib/rateLimit';

// 무차별 대입 방어 — 분당 10회(로그인 라우트와 같은 계열의 보수적 상한).
const checkRate = rateLimit({ windowMs: 60_000, max: 10, message: '시도가 너무 잦아요. 잠시 후 다시 해주세요.' });

// 비밀번호 변경(W1-D) — 이메일 계정 전용. OAuth-only 계정(password null)은 400.
// 현재 비밀번호 확인 후 교체. 실패 응답은 프로빙을 돕지 않게 최소 정보만.
export async function PATCH(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const blocked = await checkRate(`pw:${clientKey(request)}:${userId}`);
  if (blocked) return blocked;

  const body: unknown = await request.json().catch(() => null);
  if (!isPlainObject(body)) return authResponse('잘못된 요청이에요.', 400);
  const { currentPassword, newPassword } = body;
  if (!isNonEmptyString(currentPassword, 72)) {
    return authResponse('현재 비밀번호를 입력해주세요.', 400);
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 72) {
    return authResponse('새 비밀번호는 6~72자여야 해요.', 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  if (!user) return authResponse('User not found', 404);
  if (user.password === null) {
    return authResponse('소셜 계정은 비밀번호가 없어요.', 400);
  }
  const match = await bcrypt.compare(currentPassword, user.password);
  if (!match) return authResponse('현재 비밀번호가 맞지 않아요.', 403);

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  return Response.json({ ok: true });
}
