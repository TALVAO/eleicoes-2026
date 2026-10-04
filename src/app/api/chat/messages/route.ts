import { createHash } from 'node:crypto';
import { getChatRepository } from '@/server/chat/repository';
import { ChatError, ChatService } from '@/server/chat/service';
import { chatCookie, chatFailure, chatHeaders, clientKey, readChatBody } from '@/server/chat/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const repository = getChatRepository();
    if (!(await repository.rate('read:messages:' + clientKey(request), 120, 60)))
      throw new ChatError(429, 'Aguarde um pouco e tente novamente.');
    const messages = await repository.messages();
    const etag = '"' + createHash('sha256').update(JSON.stringify(messages)).digest('hex') + '"';
    if (request.headers.get('if-none-match') === etag)
      return new Response(null, { status: 304, headers: { ...chatHeaders, ETag: etag } });
    return Response.json({ messages }, { headers: { ...chatHeaders, ETag: etag } });
  } catch (error) {
    return chatFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = await readChatBody(request);
    const message = await new ChatService(getChatRepository()).send(
      input,
      chatCookie(request),
      clientKey(request),
    );
    return Response.json({ message }, { status: 201, headers: chatHeaders });
  } catch (error) {
    return chatFailure(error);
  }
}
