import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return authResponse('Unauthorized');
  }

  const { id: boardId } = params;
  const body = await request.json();
  const { position } = body;

  if (position === undefined || position === null) {
    return authResponse('Missing required field: position', 400);
  }

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      totalStickers: true,
      isCompleted: true,
      ownerId: true,
      giftedToId: true,
    },
  });

  if (!board) {
    return authResponse('Board not found', 404);
  }

  if (board.isCompleted) {
    return authResponse('Board is already completed', 400);
  }

  // Validate position range
  if (position < 0 || position >= board.totalStickers) {
    return authResponse(
      `Invalid position. Must be between 0 and ${board.totalStickers - 1}`,
      400
    );
  }

  // Check if the position is already filled
  const existingSticker = await prisma.sticker.findUnique({
    where: {
      boardId_position: {
        boardId,
        position,
      },
    },
  });

  if (existingSticker) {
    return authResponse('This position is already filled', 409);
  }

  // Create the sticker and check for board completion in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const sticker = await tx.sticker.create({
      data: {
        boardId,
        position,
        filledBy: userId,
      },
      include: {
        filler: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Count total filled stickers for this board
    const filledCount = await tx.sticker.count({
      where: { boardId },
    });

    // If all positions are filled, mark the board as completed
    if (filledCount >= board.totalStickers) {
      await tx.board.update({
        where: { id: boardId },
        data: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });
    }

    return {
      sticker,
      filledCount,
      isCompleted: filledCount >= board.totalStickers,
    };
  });

  return Response.json(result, { status: 201 });
}
