import { getChatRepository } from '@/server/chat/repository';
import { ChatError } from '@/server/chat/service';
import {
  chatFailure,
  chatHeaders,
  clientKey,
  readChatBody,
  requireAdmin,
} from '@/server/chat/http';
import { moderationSchema } from '@/features/chat/validation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function authenticate(request: Request) {
  const repository = getChatRepository();
  if (!(await repository.rate('admin:' + clientKey(request), 60, 60)))
    throw new ChatError(429, 'Aguarde um pouco antes de tentar novamente.');
  requireAdmin(request);
  return repository;
}
export async function GET(request: Request) {
  try {
    return Response.json(
      { messages: await (await authenticate(request)).moderation() },
      { headers: chatHeaders },
    );
  } catch (error) {
    return chatFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const repository = await authenticate(request);
    const parsed = moderationSchema.safeParse(await readChatBody(request));
    if (!parsed.success) throw new ChatError(400, 'Ação de moderação inválida.');
    await repository.moderate(parsed.data.messageId, parsed.data.action);
    console.info(
      JSON.stringify({
        event: 'chat_moderation',
        action: parsed.data.action,
        messageId: parsed.data.messageId,
        at: new Date().toISOString(),
      }),
    );
    return Response.json({ ok: true }, { headers: chatHeaders });
  } catch (error) {
    return chatFailure(error);
  }
}
