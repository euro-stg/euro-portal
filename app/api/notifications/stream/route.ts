import { auth } from "@/lib/auth";
import { sseSubscribe } from "@/lib/sse-emitter";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const userId = session.user.id;
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Ping awal agar koneksi tidak langsung ditutup browser
      controller.enqueue(encoder.encode("data: {\"type\":\"ping\"}\n\n"));

      unsubscribe = sseSubscribe(userId, (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch { /* ignore */ }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx buffering
    },
  });
}
