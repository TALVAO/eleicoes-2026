import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { readView } from '@/server/read-model';
import { getReactionRepository } from '@/server/reactions';
import { getChatRepository } from '@/server/chat/repository';
import { ChatError } from '@/server/chat/service';
import { chatFailure, chatHeaders, clientKey, readChatBody } from '@/server/chat/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const cookieName = 'ele2026-reaction';
const inputSchema = z
  .object({
    candidate: z.string().regex(/^\d{1,24}$/),
    value: z.enum(['like', 'dislike']).nullable(),
  })
  .strict();
function identity(request: Request) {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(cookieName + '='))
    ?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
async function releasedResult() {
  const view = await readView(new URLSearchParams({ scope: 'br', office: '1' }));
  const result = view?.resource.current?.data;
  if (!view || !result || result.phase === 'unreleased' || Date.now() < Date.parse(view.releaseAt))
    throw new ChatError(409, 'As reações estarão disponíveis quando o TSE divulgar os resultados.');
  return result;
}
export async function GET(request: Request) {
  try {
    if (!(await getChatRepository().rate('read:reactions:' + clientKey(request), 120, 60)))
      throw new ChatError(429, 'Aguarde um pouco para atualizar as reações.');
    const result = await releasedResult();
    const token = identity(request);
    const counts = await getReactionRepository().read(
      result.election,
      result.candidates.map((c) => c.id),
      token ? hash(token) : null,
    );
    return Response.json({ counts }, { headers: chatHeaders });
  } catch (e) {
    return chatFailure(e);
  }
}
export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await readChatBody(request));
    if (!parsed.success) throw new ChatError(400, 'Escolha uma reação válida.');
    if (!(await getChatRepository().rate('write:reactions:' + clientKey(request), 30, 60)))
      throw new ChatError(429, 'Aguarde um pouco antes de reagir novamente.');
    const result = await releasedResult();
    if (!result.candidates.some((c) => c.id === parsed.data.candidate))
      throw new ChatError(400, 'Candidato indisponível.');
    const token = identity(request) ?? randomBytes(32).toString('hex');
    const repository = getReactionRepository();
    await repository.change(result.election, parsed.data.candidate, hash(token), parsed.data.value);
    const counts = await repository.read(
      result.election,
      result.candidates.map((c) => c.id),
      hash(token),
    );
    return Response.json(
      { counts },
      {
        headers: {
          ...chatHeaders,
          'Set-Cookie': `${cookieName}=${token}; Path=/api/chat; HttpOnly; SameSite=Strict; Max-Age=2592000${process.env.SITE_URL?.startsWith('https:') ? '; Secure' : ''}`,
        },
      },
    );
  } catch (e) {
    return chatFailure(e);
  }
}
