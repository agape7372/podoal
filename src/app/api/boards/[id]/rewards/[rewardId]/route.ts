import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

const VALID_REWARD_TYPES = new Set(['letter', 'giftcard', 'wish']);

type Ctx = { params: Promise<{ id: string; rewardId: string }> };

type LoadedReward = {
  id: string;
  type: string;
  title: string;
  content: string;
  imageUrl: string;
  triggerAt: number;
  unlockedAt: Date | null;
  revealedAt: Date | null;
};

function serialize(r: LoadedReward) {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    content: r.content,
    imageUrl: r.imageUrl,
    triggerAt: r.triggerAt,
    unlockedAt: r.unlockedAt?.toISOString() ?? null,
    revealedAt: r.revealedAt?.toISOString() ?? null,
  };
}

// Owner-only loader, scoped to MID-rewards (triggerAt < totalStickers) so the
// completion reward can never be edited/deleted through here.
async function loadOwnedMidReward(boardId: string, rewardId: string, userId: string) {
  const reward = await prisma.reward.findUnique({
    where: { id: rewardId },
    include: { board: { select: { ownerId: true, totalStickers: true } } },
  });
  if (!reward || reward.boardId !== boardId || !reward.board) {
    return { error: authResponse('Reward not found', 404) };
  }
  if (reward.board.ownerId !== userId) {
    return { error: authResponse('Forbidden', 403) };
  }
  if (reward.triggerAt >= reward.board.totalStickers) {
    return { error: authResponse('완성 보상은 여기서 수정할 수 없어요', 400) };
  }
  return { reward };
}

// GET — owner-only full reward (incl. content) so the edit modal can prefill,
// even while the reward is still unrevealed (the board GET hides content).
export async function GET(_request: Request, props: Ctx) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id: boardId, rewardId } = params;
  const loaded = await loadOwnedMidReward(boardId, rewardId, userId);
  if ('error' in loaded) return loaded.error;

  return Response.json({ reward: serialize(loaded.reward) });
}

// PATCH — owner edits an unrevealed mid-reward's type/title/content. Position
// (triggerAt) is immutable here; to move it, delete and re-plant.
export async function PATCH(request: Request, props: Ctx) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id: boardId, rewardId } = params;
  const loaded = await loadOwnedMidReward(boardId, rewardId, userId);
  if ('error' in loaded) return loaded.error;
  // Once the grape is filled the reward is unlocked (celebrated + "tap to open"
  // card shown) — it's effectively delivered, so freeze it from further edits.
  if (loaded.reward.unlockedAt) return authResponse('이미 잠금 해제된 보상은 수정할 수 없어요', 400);

  const body = await request.json();
  const { type, title, content } = body;
  if (typeof type !== 'string' || !VALID_REWARD_TYPES.has(type)) {
    return authResponse('보상 형식이 올바르지 않습니다.', 400);
  }
  if (typeof title !== 'string' || title.trim().length === 0 || title.length > 80) {
    return authResponse('보상 제목은 1~80자여야 합니다.', 400);
  }
  if (typeof content !== 'string' || content.trim().length === 0 || content.length > 500) {
    return authResponse('보상 내용은 1~500자여야 합니다.', 400);
  }

  const updated = await prisma.reward.update({
    where: { id: rewardId },
    data: { type, title: title.trim(), content: content.trim() },
  });
  return Response.json({ reward: serialize(updated) });
}

// DELETE — owner removes an unrevealed mid-reward.
export async function DELETE(_request: Request, props: Ctx) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id: boardId, rewardId } = params;
  const loaded = await loadOwnedMidReward(boardId, rewardId, userId);
  if ('error' in loaded) return loaded.error;
  if (loaded.reward.unlockedAt) return authResponse('이미 잠금 해제된 보상은 삭제할 수 없어요', 400);

  await prisma.reward.delete({ where: { id: rewardId } });
  return Response.json({ ok: true });
}
