import { getChatRepository } from '@/server/chat/repository';
import { ChatService } from '@/server/chat/service';
import { chatCookie, chatFailure, chatHeaders, clientKey, readChatBody } from '@/server/chat/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    await new ChatService(getChatRepository()).report(
      await readChatBody(request),
      chatCookie(request),
      clientKey(request),
    );
    return Response.json(
      { message: 'Denúncia registrada para revisão.' },
      { headers: chatHeaders },
    );
  } catch (error) {
    return chatFailure(error);
  }
}
