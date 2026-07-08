import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

// 커스텀 알 사진(사용자 요청, 2026-07-08 — docs/cards/2026-07-08-custom-grape-photo.md).
// 업로드 남용(스토리지 비용) 방어 — 로그인/회원가입과 동일한 슬라이딩 윈도우 패턴.
const uploadLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 10,
  message: '업로드를 너무 많이 시도했어요. 잠시 후 다시 시도해주세요.',
});

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024; // 2MB — 클라 리사이즈 후 기준, 서버도 재검증

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const blocked = await uploadLimit(userId);
  if (blocked) return blocked;

  const { id: boardId } = params;
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, customImageUrl: true },
  });
  if (!board) return authResponse('Board not found', 404);
  if (board.ownerId !== userId) return authResponse('Only the board owner can set a custom image', 403);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return authResponse('사진 파일이 필요해요', 400);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return authResponse('jpg·png·webp 사진만 올릴 수 있어요', 400);
  }
  if (file.size > MAX_BYTES) {
    return authResponse('사진 용량이 너무 커요 (2MB 이하)', 400);
  }

  // 교체 시 이전 blob 삭제 — 고아 스토리지 누적 방지(비용 방어).
  if (board.customImageUrl) {
    await del(board.customImageUrl).catch(() => {
      // 이미 지워졌거나 외부 URL이었던 과거 데이터 — 업로드 자체는 막지 않는다.
    });
  }

  // pathname에 확장자가 없어 Blob의 contentType 자동감지가 실패한다 — 화이트리스트를
  // 통과한 이미지 MIME을 명시해 generic octet-stream으로 서빙되는 것을 방지(MIME 스니핑 여지 차단).
  const blob = await put(`boards/${boardId}/custom-image`, file, {
    access: 'public',
    addRandomSuffix: true,
    contentType: file.type,
  });

  await prisma.board.update({
    where: { id: boardId },
    data: { customImageUrl: blob.url },
  });

  return Response.json({ customImageUrl: blob.url });
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const { id: boardId } = params;
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, customImageUrl: true },
  });
  if (!board) return authResponse('Board not found', 404);
  if (board.ownerId !== userId) return authResponse('Only the board owner can remove the custom image', 403);

  if (board.customImageUrl) {
    await del(board.customImageUrl).catch(() => {});
  }

  await prisma.board.update({
    where: { id: boardId },
    data: { customImageUrl: null },
  });

  return Response.json({ ok: true });
}
