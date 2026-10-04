import { readView } from '@/server/read-model';
import { sseFrame, viewRevision } from '@/lib/tse/sse';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (process.env.LIVE_TRANSPORT === 'polling') {
    return Response.json({ transport: 'polling' }, { status: 503 });
  }
  const params = new URL(request.url).searchParams;
  let initial;
  try {
    initial = await readView(params);
  } catch {
    return Response.json({ message: 'Conexão temporariamente indisponível.' }, { status: 503 });
  }
  if (!initial) return Response.json({ message: 'Abrangência indisponível.' }, { status: 400 });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder(),
        started = Date.now();
      let last = request.headers.get('last-event-id') ?? '';
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        controller.close();
      };
      request.signal.addEventListener('abort', close, { once: true });
      controller.enqueue(encoder.encode('retry: 3000\n\n'));
      const send = async () => {
        if (closed) return;
        if (Date.now() - started > 50_000) {
          close();
          return;
        }
        try {
          const view = await readView(params);
          if (closed) return;
          if (view) {
            const id = viewRevision(view);
            if (id !== last) {
              last = id;
              controller.enqueue(encoder.encode(sseFrame(view, id)));
            } else
              controller.enqueue(
                encoder.encode(
                  `event: heartbeat\ndata: ${JSON.stringify({ health: view.health, serverNow: view.serverNow })}\n\n`,
                ),
              );
          }
        } catch {
          if (!closed)
            controller.enqueue(
              encoder.encode('event: connection\ndata: {"status":"degraded"}\n\n'),
            );
        }
        if (!closed) timer = setTimeout(() => void send(), 2000);
      };
      void send();
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
