import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { messageSchema, profileSchema, reportSchema } from '@/features/chat/validation';
import type { ChatLocation, ChatMessage } from '@/features/chat/types';
import type { ChatRepository, Session } from './repository';
export class ChatError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export class ChatService {
  constructor(private repository: ChatRepository) {}
  async join(input: unknown, client: string, locations: ChatLocation[]) {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) throw new ChatError(400, 'Confira o apelido, a cidade e o estado.');
    const region = locations.find((r) => r.code === parsed.data.state);
    const city = region?.municipalities.find((m) => m.code === parsed.data.municipality);
    if (!region || !city) throw new ChatError(400, 'Selecione uma cidade da lista do estado.');
    const session: Session = {
      client,
      profile: {
        id: randomUUID(),
        nickname: parsed.data.nickname,
        city: city.name,
        state: region.code.toUpperCase(),
      },
    };
    if (await this.repository.blocked(session))
      throw new ChatError(403, 'Sua participação está bloqueada pela moderação.');
    if (!(await this.repository.rate('join:' + client, 5, 3600)))
      throw new ChatError(429, 'Muitas entradas em pouco tempo. Tente mais tarde.');
    const token = randomBytes(32).toString('hex');
    await this.repository.saveSession(hashToken(token), session);
    return { token, profile: session.profile };
  }
  async identify(token: string | null) {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return this.repository.session(hashToken(token));
  }
  private async participant(token: string | null, client: string) {
    const session = await this.identify(token);
    if (!session)
      throw new ChatError(401, 'Entre com seu apelido, cidade e estado para participar.');
    if (
      (await this.repository.blocked(session)) ||
      (await this.repository.blocked({ ...session, client }))
    )
      throw new ChatError(403, 'Sua participação está bloqueada pela moderação.');
    return session;
  }
  async send(input: unknown, token: string | null, client: string) {
    const session = await this.participant(token, client);
    const parsed = messageSchema.safeParse(input);
    if (!parsed.success)
      throw new ChatError(400, 'Escreva até 280 caracteres, sem links ou marcação.');
    const text = parsed.data.text;
    if (
      !(await this.repository.rate('send:user:' + session.profile.id, 10, 60)) ||
      !(await this.repository.rate('send:client:' + client, 20, 60)) ||
      !(await this.repository.rate('send:global', 120, 60))
    )
      throw new ChatError(429, 'Espere um pouco antes de enviar outra mensagem.');
    const message: ChatMessage = {
      id: randomUUID(),
      author: session.profile,
      text,
      at: new Date().toISOString(),
    };
    if (
      !(await this.repository.publish(message, client, hashToken(text.toLocaleLowerCase('pt-BR'))))
    )
      throw new ChatError(429, 'Aguarde 5 segundos entre mensagens e evite repetir o mesmo texto.');
    return message;
  }
  async report(input: unknown, token: string | null, client: string) {
    const session = await this.participant(token, client);
    const parsed = reportSchema.safeParse(input);
    if (!parsed.success) throw new ChatError(400, 'Selecione uma mensagem e um motivo válido.');
    if (!(await this.repository.rate('report:' + client, 10, 3600)))
      throw new ChatError(429, 'Limite de denúncias atingido. Tente mais tarde.');
    return this.repository.report(parsed.data.messageId, session.profile.id, parsed.data.reason);
  }
}
