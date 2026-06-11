import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { canFreeze, kstDateKey, kstDayRangeUtc, kstTodayKey, shiftDateKey } from '@/lib/streak';

// 스트릭 유예(freeze) 1회 사용 — 빈 어제(KST)를 유예로 메꿔 스트릭을 이어붙인다.
// 자격(유예 보유 + 어제 비었음 + 그제 채워짐)은 항상 서버가 재검증한다(클라 판정 신뢰 금지).
export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakFreezeUsedAt: true },
  });
  if (!user) return authResponse('Unauthorized');

  const todayKey = kstTodayKey();
  const yesterday = shiftDateKey(todayKey, -1);
  const dayBefore = shiftDateKey(todayKey, -2);

  // 그제 00:00 ~ 어제 24:00(KST) 구간의 스티커만 있으면 판정에 충분 — 전체 히스토리 fetch 불필요.
  const stickers = await prisma.sticker.findMany({
    where: {
      filledBy: userId,
      filledAt: { gte: kstDayRangeUtc(dayBefore).start, lt: kstDayRangeUtc(yesterday).end },
    },
    select: { filledAt: true },
  });
  const filledDates = new Set(stickers.map((s) => kstDateKey(s.filledAt)));

  const verdict = canFreeze(filledDates, user.streakFreezeUsedAt, todayKey);
  if (!verdict.eligible) {
    if (verdict.reason === 'already-used') {
      return NextResponse.json(
        { error: '유예는 한 번만 쓸 수 있어요. 이미 사용했어요.' },
        { status: 409 },
      );
    }
    const msg =
      verdict.reason === 'yesterday-filled'
        ? '어제는 이미 포도알을 채웠어요. 유예 없이도 스트릭이 이어져요.'
        : '그저께 채운 기록이 없어 이어붙일 수 없어요. 오늘 한 알부터 다시 시작해요.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 단발성 보장: streakFreezeUsedAt이 아직 null인 행만 갱신(동시 요청 레이스 차단 —
  // reward unlock과 같은 updateMany 단발 패턴).
  const updated = await prisma.user.updateMany({
    where: { id: userId, streakFreezeUsedAt: null },
    data: { streakFreezeDate: yesterday, streakFreezeUsedAt: new Date() },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: '유예는 한 번만 쓸 수 있어요. 이미 사용했어요.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, streakFreezeDate: yesterday });
}
