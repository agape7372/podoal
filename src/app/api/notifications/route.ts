import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { PUBLIC_USER_SELECT } from '@/lib/userSelect';
import { stripTitleEmoji } from '@/lib/title';
import type { NotificationEvent } from '@/types';

// 통합 알림 피드 — 별도 Notification 테이블 없이 기존 소스(메시지·보상·친구요청·포도동
// 초대·깜짝선물)를 집계해 시간순으로 돌려준다. read는 각 소스 상태에서 파생.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const myBoards = { OR: [{ ownerId: userId }, { giftedToId: userId }] };

  const [messages, rewards, friendReqs, invites, planted] = await Promise.all([
    prisma.message.findMany({
      where: { receiverId: userId },
      include: { sender: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.reward.findMany({
      where: { unlockedAt: { not: null }, revealedAt: null, board: myBoards },
      include: { board: { select: { id: true, title: true } } },
      orderBy: { unlockedAt: 'desc' },
      take: 20,
    }),
    prisma.friendship.findMany({
      where: { receiverId: userId, status: 'pending' },
      include: { requester: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.relayParticipant.findMany({
      where: { userId, status: 'invited' },
      include: { relay: { select: { id: true, title: true, creator: { select: PUBLIC_USER_SELECT } } } },
      orderBy: { joinedAt: 'desc' },
      take: 20,
    }),
    prisma.plantedGift.findMany({
      where: { revealedAt: { not: null }, board: myBoards },
      include: { plantedBy: { select: PUBLIC_USER_SELECT } },
      orderBy: { revealedAt: 'desc' },
      take: 20,
    }),
  ]);

  const events: NotificationEvent[] = [];

  for (const m of messages) {
    const title = m.type === 'celebration' ? '축하 메시지' : m.type === 'gift' ? '선물이 도착했어요' : '응원이 도착했어요';
    events.push({
      id: `msg:${m.id}`,
      type: m.type === 'celebration' ? 'celebration' : m.type === 'gift' ? 'gift' : 'cheer',
      title,
      body: `${m.sender.name}: ${m.content}`.slice(0, 120),
      emoji: m.type === 'gift' ? '🎁' : m.emoji || '💜',
      url: '/messages',
      read: m.isRead,
      createdAt: m.createdAt.toISOString(),
      actor: { name: m.sender.name, avatar: m.sender.avatar },
    });
  }

  for (const r of rewards) {
    events.push({
      id: `rwd:${r.id}`,
      type: 'reward',
      title: '새 보상이 열렸어요',
      body: `${r.title} · ${stripTitleEmoji(r.board.title)}`.slice(0, 120),
      emoji: '🎁',
      url: '/rewards',
      read: false,
      createdAt: r.unlockedAt!.toISOString(), // where 절이 not-null 보장
      actor: null,
    });
  }

  for (const f of friendReqs) {
    events.push({
      id: `frq:${f.id}`,
      type: 'friend-request',
      title: '친구 요청',
      body: `${f.requester.name}님이 친구 요청을 보냈어요`,
      emoji: '👥',
      url: '/friends',
      read: false,
      createdAt: f.createdAt.toISOString(),
      actor: { name: f.requester.name, avatar: f.requester.avatar },
    });
  }

  for (const p of invites) {
    events.push({
      id: `inv:${p.id}`,
      type: 'invite',
      title: '포도동 초대',
      body: `${p.relay.creator.name}님이 '${stripTitleEmoji(p.relay.title)}'에 초대했어요`,
      emoji: '🔗',
      url: `/relay/${p.relay.id}`,
      read: false,
      createdAt: p.joinedAt.toISOString(),
      actor: { name: p.relay.creator.name, avatar: p.relay.creator.avatar },
    });
  }

  for (const g of planted) {
    events.push({
      id: `pgf:${g.id}`,
      type: 'planted-gift',
      title: '깜짝 선물 발견',
      body: g.message ? stripTitleEmoji(g.message).slice(0, 120) : `${g.plantedBy.name}님의 깜짝 선물`,
      emoji: g.emoji || '🎁',
      url: `/board/${g.boardId}`,
      read: true, // 채울 때 모달로 이미 확인 — 이력성
      createdAt: (g.revealedAt ?? g.createdAt).toISOString(),
      actor: { name: g.plantedBy.name, avatar: g.plantedBy.avatar },
    });
  }

  events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return Response.json({ events: events.slice(0, 40) });
}
