import { prisma } from '@/lib/prisma';
import { getCurrentUserId, authResponse } from '@/lib/auth';

export async function GET(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return authResponse('Unauthorized');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastCheck = new Date();

      const interval = setInterval(async () => {
        try {
          const messages = await prisma.message.findMany({
            where: {
              receiverId: userId,
              isRead: false,
              createdAt: { gt: lastCheck },
            },
            include: {
              sender: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (messages.length > 0) {
            lastCheck = new Date();
            for (const msg of messages) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(msg)}\n\n`)
              );
            }
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 3000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
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
