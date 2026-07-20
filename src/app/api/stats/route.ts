import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { TEMPLATE_CATEGORIES } from '@/lib/templates';
import { zonedDateKey, shiftDateKey, computeStreaks } from '@/lib/streak';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

// 날짜 버킷팅은 사용자 시간대(User.timezone, 기본 Asia/Seoul) + 하루 시작 시각
// (User.dayResetHour, 기본 0) 기준 — 채움 텀 C2에서 텀 판정·스트릭·히트맵이 같은
// 경계(src/lib/streak.ts zonedDateKey)로 통일됐다(FILL_CADENCE §4, GAP-03 치유).
// 기본값에서는 종전 KST 고정 동작과 완전 동치(23:30 KST 채움 = 그 달력 날짜).
// 모든 파생값(요일·월별·30일 평균)은 날짜 키 문자열 산술로만 계산한다.

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  // Counters — single round-trips, no big lists.
  const [
    totalBoards,
    completedBoards,
    totalStickers,
    messagesSent,
    messagesReceived,
    friendsCount,
    boardsGifted,
    boardsReceived,
    // 유예 레거시 날짜 + 경계 설정(timezone/dayResetHour) — 아래 날짜 버킷팅에 쓴다.
    boundaryUser,
    // 카테고리 집계용 보드 목록 — userId에만 의존하는 독립 쿼리라 첫 배치에 동승
    // (예전엔 GROUP BY 뒤 3번째 직렬 왕복이었다 — 스켈레톤 감사, 응답 계약 불변).
    boardsWithStickers,
  ] = await Promise.all([
    prisma.board.count({ where: { ownerId: userId } }),
    prisma.board.count({ where: { ownerId: userId, isCompleted: true } }),
    prisma.sticker.count({ where: { filledBy: userId } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.message.count({ where: { receiverId: userId } }),
    prisma.friendship.count({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
    }),
    prisma.board.count({ where: { giftedFromId: userId } }),
    prisma.board.count({ where: { giftedToId: userId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { streakFreezeDate: true, timezone: true, dayResetHour: true },
    }),
    prisma.board.findMany({
      where: { ownerId: userId },
      select: {
        templateId: true,
        _count: { select: { stickers: true } },
      },
    }),
  ]);

  const timezone = boundaryUser?.timezone || 'Asia/Seoul';
  const resetHour = boundaryUser?.dayResetHour ?? 0;

  // 날짜별 집계를 **DB에서** 한다 — 예전엔 사용자의 모든 sticker 행(헤비유저면 1만+)을
  // 메모리로 끌어와 JS로 버킷팅했다(확장성 한계). 고유 날짜 수(최대 ~수백)만 돌려받아
  // 같은 파생값(heatmap·요일·월별·streak·평균)을 전부 계산한다.
  // 날짜 키 = filledAt(UTC 저장)를 사용자 시간대 벽시계로 바꾼 뒤 resetHour를 뺀 달력
  // 날짜 — zonedDateKey(JS)와 동치(AT TIME ZONE은 IANA명 처리, DST 포함). 기본값
  // (Asia/Seoul, 0)에서는 종전 `+ interval '9 hours'`와 완전 동일한 키를 준다.
  // (filledBy, filledAt) 복합 인덱스가 이 GROUP BY를 인덱스만으로 처리한다.
  // C3 보충(isBackfill): 귀속일이 채운 날의 전날 — pace.ts fillDateKey와 같은 산식을
  // SQL로(하루 시프트). 스트릭·히트맵·요일 집계가 전부 이 day 키에서 파생되므로 여기
  // 한 곳으로 통일된다.
  const dateCounts = await prisma.$queryRaw<{ day: string; cnt: bigint }[]>`
    SELECT to_char((("filledAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})
                   - make_interval(hours => ${resetHour})
                   - (CASE WHEN "isBackfill" THEN interval '1 day' ELSE interval '0' END),
           'YYYY-MM-DD') AS day,
           COUNT(*) AS cnt
    FROM "Sticker"
    WHERE "filledBy" = ${userId}
    GROUP BY day
  `;

  // KST 날짜 키 → 카운트. 요일 집계는 날짜 키 문자열에서 직접 유도한다.
  // 요일은 '달력 날짜'의 속성이므로 타임존 변환이 필요 없다: row.day='2026-06-13'을
  // UTC 자정으로 파싱한 getUTCDay()는 그 날짜 자체의 요일(0=일)을 준다 — 기존
  // kstDayBucket((filledAt+9h).getUTCDay())과 동일 결과임을 로컬 DB로 실측 검증
  // (240행, 요일 집계 완전 일치). UTC 자정으로 파싱하므로 로컬 타임존 영향도 없다.
  const countByDate = new Map<string, number>();
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const row of dateCounts) {
    const c = Number(row.cnt);
    countByDate.set(row.day, c);
    dayOfWeekCounts[new Date(`${row.day}T00:00:00Z`).getUTCDay()] += c;
  }

  // Build last-7-days series — 오늘 키에서 문자열 산술로 역산(인스턴트 불필요).
  const todayKey = zonedDateKey(new Date(), timezone, resetHour);
  const dailyStickers: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const k = shiftDateKey(todayKey, -i);
    dailyStickers.push({ date: k, count: countByDate.get(k) || 0 });
  }
  const recentStickers = dailyStickers.reduce((sum, d) => sum + d.count, 0);

  // Heatmap: last 90 days (사용자 경계 기준).
  const heatmap: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const k = shiftDateKey(todayKey, -i);
    heatmap.push({ date: k, count: countByDate.get(k) || 0 });
  }

  // Streaks from bucketed date set — src/lib/streak.ts 공유 로직 사용.
  const streakDates = new Set(countByDate.keys());
  // 폐지된 유예(freeze) 기능의 레거시 보존 — 과거에 유예로 메꾼 날짜는 계속 채워진 날로
  // 간주해 스트릭을 이어붙인다. 이 주입을 제거하면 유예를 이미 사용한 계정의 스트릭이
  // 소급 감소하므로 제거 금지. (heatmap/dailyStickers에는 넣지 않는다 — 실제 채운 알이 아니므로.)
  if (boundaryUser?.streakFreezeDate) streakDates.add(boundaryUser.streakFreezeDate);
  const { currentStreak, longestStreak } = computeStreaks(streakDates, todayKey);
  // `streak` (legacy alias) kept for backwards compat with existing clients.
  const streak = currentStreak;

  // 30-day average — 날짜 키 집계에서 최근 30일 분 합산(사용자 경계).
  const cutoffKey = shiftDateKey(todayKey, -30);
  let last30Count = 0;
  for (const [key, count] of countByDate) {
    if (key >= cutoffKey) last30Count += count;
  }
  const averageDaily = Math.round((last30Count / 30) * 10) / 10;

  const maxDayIndex = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));
  const mostActiveDay = DAY_NAMES[maxDayIndex];

  const completionRate = totalBoards > 0
    ? Math.round((completedBoards / totalBoards) * 1000) / 10
    : 0;

  // Monthly trend (last 6 months) — 날짜 키의 'YYYY-MM' 접두로 월별 합산(키가 이미
  // 사용자 경계 달력일이라 월 경계도 같은 기준). 현재 연·월도 todayKey에서 유도.
  const monthSums = new Map<string, number>();
  for (const [key, count] of countByDate) {
    const ym = key.slice(0, 7);
    monthSums.set(ym, (monthSums.get(ym) || 0) + count);
  }
  const monthlyTrend: { month: string; count: number }[] = [];
  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth = Number(todayKey.slice(5, 7)) - 1;
  for (let i = 5; i >= 0; i--) {
    const targetMonth = todayMonth - i;
    const year = todayYear + Math.floor(targetMonth / 12);
    const month = ((targetMonth % 12) + 12) % 12;
    const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
    monthlyTrend.push({ month: ym, count: monthSums.get(ym) || 0 });
  }

  // Category breakdown by board templateId prefix (boardsWithStickers는 첫 배치에서 수신).
  const categoryMap = new Map<string, number>();
  const categoryNameMap = new Map<string, string>();
  for (const cat of TEMPLATE_CATEGORIES) categoryNameMap.set(cat.id, cat.name);

  for (const board of boardsWithStickers) {
    let categoryKey = '기타';
    if (board.templateId) {
      const prefix = board.templateId.split('-')[0];
      if (categoryNameMap.has(prefix)) categoryKey = categoryNameMap.get(prefix)!;
    }
    categoryMap.set(categoryKey, (categoryMap.get(categoryKey) || 0) + board._count.stickers);
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return Response.json({
    stats: {
      totalBoards,
      completedBoards,
      totalStickers,
      recentStickers,
      messagesSent,
      messagesReceived,
      friendsCount,
      boardsGifted,
      boardsReceived,
      streak,
      dailyStickers,
      heatmap,
      longestStreak,
      currentStreak,
      averageDaily,
      mostActiveDay,
      completionRate,
      monthlyTrend,
      categoryBreakdown,
    },
  });
}
