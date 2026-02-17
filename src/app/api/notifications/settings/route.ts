import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

const defaultSettings = {
  globalEnabled: true,
  dndStart: '22:00',
  dndEnd: '08:00',
  cheerEnabled: true,
  rewardEnabled: true,
  relayEnabled: true,
  reminderEnabled: true,
};

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  let settings = await prisma.notificationSetting.findUnique({
    where: { userId },
  });

  if (!settings) {
    settings = await prisma.notificationSetting.create({
      data: { userId, ...defaultSettings },
    });
  }

  return Response.json({
    settings: {
      globalEnabled: settings.globalEnabled,
      dndStart: settings.dndStart,
      dndEnd: settings.dndEnd,
      cheerEnabled: settings.cheerEnabled,
      rewardEnabled: settings.rewardEnabled,
      relayEnabled: settings.relayEnabled,
      reminderEnabled: settings.reminderEnabled,
    },
  });
}

export async function PUT(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const body = await request.json();

  const allowedKeys = [
    'globalEnabled',
    'dndStart',
    'dndEnd',
    'cheerEnabled',
    'rewardEnabled',
    'relayEnabled',
    'reminderEnabled',
  ];

  const updateData: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in body) {
      updateData[key] = body[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return authResponse('No valid fields to update', 400);
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
    },
  });
}
