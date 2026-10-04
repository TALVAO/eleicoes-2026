import { readCatalog } from '@/server/read-model';
import { getChatRepository } from '@/server/chat/repository';
import { ChatError, ChatService } from '@/server/chat/service';
import {
  chatCookie,
  chatFailure,
  chatHeaders,
  clientKey,
  readChatBody,
  sessionCookie,
} from '@/server/chat/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const repository = getChatRepository();
    if (!(await repository.rate('read:session:' + clientKey(request), 30, 60)))
      throw new ChatError(429, 'Aguarde um pouco e tente novamente.');
    const session = await new ChatService(repository).identify(chatCookie(request));
    const catalog = await readCatalog();
    const locations =
      catalog?.regions.map((r) => ({
        code: r.code,
        name: r.name,
        municipalities: r.municipalities.map((m) => ({ code: m.code, name: m.name })),
      })) ?? [];
    return Response.json(
      {
        profile: session?.profile ?? null,
        locations,
        blocked: session ? await repository.blocked(session) : false,
      },
      { headers: chatHeaders },
    );
  } catch (error) {
    return chatFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = await readChatBody(request);
    if (input && typeof input === 'object' && 'action' in input && input.action === 'leave')
      return Response.json(
        { profile: null },
        { headers: { ...chatHeaders, 'Set-Cookie': sessionCookie('', true) } },
      );
    const catalog = await readCatalog();
    if (!catalog)
      throw new ChatError(503, 'A lista de cidades ainda não está disponível. Tente em instantes.');
    const result = await new ChatService(getChatRepository()).join(
      input,
      clientKey(request),
      catalog.regions,
    );
    return Response.json(
      { profile: result.profile },
      { status: 201, headers: { ...chatHeaders, 'Set-Cookie': sessionCookie(result.token) } },
    );
  } catch (error) {
    return chatFailure(error);
  }
}
