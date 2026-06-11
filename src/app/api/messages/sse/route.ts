import { prisma } from '@/lib/prisma';
import { PUBLIC_USER_SELECT } from '@/lib/userSelect';
import { getCurrentUserId, authResponse } from '@/lib/auth';

// 폴링 주기. 클라이언트(useSSE)는 인앱 팝업/배지용 보조 채널이라 10초면 충분하고,
// Vercel Hobby + Neon 무료티어에서 클라이언트당 DB 쿼리 부하를 3초 대비 1/3로 줄인다.
const POLL_INTERVAL_MS = 10_000;

// 스트림 수명 상한. 서버리스 함수 점유·좀비 커넥션을 막기 위해 4분 후 서버가 스트림을
// 정상 종료한다 → 클라이언트 EventSource(useSSE)가 백오프(2초~) 후 자동 재연결한다.
const MAX_STREAM_LIFETIME_MS = 4 * 60 * 1000;

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastCheck = new Date();
      let closed = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        clearTimeout(lifetimeTimer);
        try {
          controller.close();
        } catch {
          // 이미 닫혔으면 무시
        }
      };

      const interval = setInterval(async () => {
        try {
          const messages = await prisma.message.findMany({
            where: {
              receiverId: userId,
              isRead: false,
              createdAt: { gt: lastCheck },
            },
            // 클라이언트(MessageInfo: useSSE → store.addMessage/showPopup)가 소비하는
            // 필드만 내려준다 — senderId/receiverId 등 불필요 스칼라 제외.
            select: {
              id: true,
              content: true,
              type: true,
              emoji: true,
              boardId: true,
              isRead: true,
              createdAt: true,
              sender: { select: PUBLIC_USER_SELECT },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (closed) return;
          if (messages.length > 0) {
            // 다음 폴은 "이번에 본 가장 최신 createdAt" 이후만. new Date()로 갱신하면
            // 쿼리 스냅샷과 현재 시각 사이에 생성된 메시지가 다음 폴에서 유실된다.
            lastCheck = messages[0].createdAt;
            for (const msg of messages) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(msg)}\n\n`)
              );
            }
          }
        } catch {
          cleanup();
        }
      }, POLL_INTERVAL_MS);

      const lifetimeTimer = setTimeout(cleanup, MAX_STREAM_LIFETIME_MS);

      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
