import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { isBool, isHHMM, isPlainObject } from '@/lib/validate';

const defaultSettings = {
  globalEnabled: true,
  dndStart: '22:00',
  dndEnd: '08:00',
  cheerEnabled: true,
  rewardEnabled: true,
  relayEnabled: true,
  reminderEnabled: true,
  dailyNudgeEnabled: false, // 데일리 넛지는 opt-in — 기본 꺼짐
  weeklyRecapEnabled: true, // 주간 결산은 opt-out — 기본 켜짐
};

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  // upsert로 get-or-create — 신규 사용자의 동시 GET 2건이 각각 create를 시도해
  // P2002(unique userId)로 500 나던 경쟁을 제거한다. update:{}는 무변경(기존 행 반환).
  const settings = await prisma.notificationSetting.upsert({
    where: { userId },
    update: {},
    create: { userId, ...defaultSettings },
  });

  return Response.json({
    settings: {
      globalEnabled: settings.globalEnabled,
      dndStart: settings.dndStart,
      dndEnd: settings.dndEnd,
      cheerEnabled: settings.cheerEnabled,
      rewardEnabled: settings.rewardEnabled,
      relayEnabled: settings.relayEnabled,
      reminderEnabled: settings.reminderEnabled,
      dailyNudgeEnabled: settings.dailyNudgeEnabled,
      weeklyRecapEnabled: settings.weeklyRecapEnabled,
    },
  });
}

export async function PUT(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const body = await request.json().catch(() => null);
  if (!isPlainObject(body)) {
    return authResponse('잘못된 요청이에요', 400);
  }

  // 화이트리스트 방식 — 여기 없는 키(특히 서버 전용 lastNudgeSentAt)는 무시된다.
  const boolKeys = ['globalEnabled', 'cheerEnabled', 'rewardEnabled', 'relayEnabled', 'reminderEnabled', 'dailyNudgeEnabled', 'weeklyRecapEnabled'];
  const timeKeys = ['dndStart', 'dndEnd'];

  // 타입 검증 — boolean 키에 문자열, 시간 키에 'HH:MM' 아닌 값이 들어와 Prisma 500이 나던 것을 400으로.
  const updateData: Record<string, unknown> = {};
  for (const key of boolKeys) {
    if (key in body) {
      if (!isBool(body[key])) return authResponse('잘못된 설정 값이에요', 400);
      updateData[key] = body[key];
    }
  }
  for (const key of timeKeys) {
    if (key in body) {
      if (!isHHMM(body[key])) return authResponse('시간 형식이 올바르지 않아요 (HH:MM)', 400);
      updateData[key] = body[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return authResponse('변경할 설정이 없어요', 400);
  }

  const settings = await prisma.notificationSetting.upsert({
    where: { userId },
    update: updateData,
    create: { userId, ...defaultSettings, ...updateData },
  });

  return Response.json({
    settings: {
      globalEnabled: settings.globalEnabled,
      dndStart: settings.dndStart,
      dndEnd: settings.dndEnd,
      cheerEnabled: settings.cheerEnabled,
      rewardEnabled: settings.rewardEnabled,
      relayEnabled: settings.relayEnabled,
      reminderEnabled: settings.reminderEnabled,
      dailyNudgeEnabled: settings.dailyNudgeEnabled,
      weeklyRecapEnabled: settings.weeklyRecapEnabled,
    },
  });
}
