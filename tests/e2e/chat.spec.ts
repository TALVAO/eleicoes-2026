import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
const origin = 'http://localhost:3100';
const admin = 'isolated-e2e-chat-admin-secret-2026';
test('moderator login waits for hydration, authenticates and clears its secret on sign out', async ({
  page,
}) => {
  await page.goto('/chat/moderacao', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Chave de moderação').fill(admin);
  await page.getByRole('button', { name: 'Acessar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Atualizar mensagens', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sair da moderação', exact: true }).click();
  await expect(page.getByLabel('Chave de moderação')).toHaveValue('');
});
test('first visit, city selection, public conversation, reports and moderation', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(60000);
  const suffix = randomUUID().slice(0, 8);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Apelido', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Cidade ou localidade', { exact: true })).toBeDisabled();
  await page.getByLabel('Apelido', { exact: true }).fill('Visitante ' + suffix);
  await page.getByLabel('Estado ou Exterior').selectOption('ac');
  await page.getByRole('button', { name: 'Filtrar cidades', exact: true }).click();
  await page.getByLabel('Buscar cidade ou localidade').fill('rio branco');
  await page.getByLabel('Cidade ou localidade', { exact: true }).selectOption('01392');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: `.impeccable/review/chat-welcome-${testInfo.project.name}.png` });
  await dialog.getByRole('button', { name: 'Entrar na conversa', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conversa ao vivo' })).toBeVisible();
  await page.getByLabel('Sua mensagem').fill('Acompanhando a apuração ' + suffix);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(page.getByText('Acompanhando a apuração ' + suffix, { exact: true })).toBeVisible();
  const session = await page.request.get('/api/chat/session');
  expect((await session.json()).profile.city).toBe('RIO BRANCO');
  expect(await page.evaluate(() => document.cookie)).not.toContain('ele2026-chat');
  const peer = await browser.newContext();
  try {
    const joined = await peer.request.post(origin + '/api/chat/session', {
      headers: { origin },
      data: { nickname: 'Vizinho ' + suffix, state: 'ac', municipality: '01392' },
    });
    expect(joined.status()).toBe(201);
    const posted = await peer.request.post(origin + '/api/chat/messages', {
      headers: { origin },
      data: { text: 'Mensagem de outro visitante ' + suffix },
    });
    expect(posted.status()).toBe(201);
    const message = (await posted.json()).message;
    await expect(page.getByText(message.text, { exact: true })).toBeVisible({ timeout: 12000 });
    const row = page.locator('.chat-timeline li').filter({ hasText: message.text });
    await row.getByRole('button', { name: 'Denunciar', exact: true }).click();
    await row.getByLabel('Motivo da denúncia').selectOption('spam');
    await row.getByRole('button', { name: 'Enviar denúncia', exact: true }).click();
    await expect(
      page.getByText('Denúncia registrada para revisão.', { exact: true }),
    ).toBeVisible();
    const reports = await page.request.get('/api/chat/moderation', {
      headers: { 'x-chat-admin': admin },
    });
    expect(
      (await reports.json()).messages.find((m: { id: string }) => m.id === message.id).reports,
    ).toBe(1);
    const reportAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(reportAxe.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('#visitor-chat')
      .screenshot({ path: `.impeccable/review/chat-panel-${testInfo.project.name}.png` });
    const removed = await page.request.post('/api/chat/moderation', {
      headers: { origin, 'x-chat-admin': admin },
      data: { messageId: message.id, action: 'remove' },
    });
    expect(removed.status()).toBe(200);
    await expect(page.getByText(message.text, { exact: true })).toHaveCount(0, { timeout: 12000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(dialog).not.toBeVisible();
    await page.getByRole('button', { name: 'Conversa', exact: true }).click();
    await expect(page.getByText('Visitante ' + suffix, { exact: true }).first()).toBeVisible();
  } finally {
    await peer.close();
  }
});
test('dismissed onboarding leaves results accessible, chat pauses when closed and failures are readable', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Agora não, ver os resultados' }).click();
  await expect(page.getByRole('heading', { name: 'Presidente da República' })).toBeVisible();
  let polls = 0;
  await page.route('**/api/chat/messages', (route) => {
    polls++;
    return route.fulfill({ status: 503, json: { message: 'Indisponível' } });
  });
  await page.getByRole('button', { name: 'Conversa', exact: true }).click();
  await expect(
    page.getByText('Não foi possível atualizar a conversa. Tentaremos novamente.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Recolher conversa' }).click();
  const before = polls;
  await page.waitForTimeout(5500);
  expect(polls).toBe(before);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(dialog).not.toBeVisible();
});
test('chat APIs reject cross-site writes, anonymous messages and moderator access', async ({
  request,
}) => {
  expect(
    (
      await request.post('/api/chat/messages', {
        headers: { origin: 'https://attacker.invalid' },
        data: { text: 'Oi' },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post('/api/chat/messages', { headers: { origin }, data: { text: 'Oi' } })
    ).status(),
  ).toBe(401);
  expect((await request.get('/api/chat/moderation')).status()).toBe(403);
  expect(
    (
      await request.post('/api/chat/session', {
        headers: { origin },
        data: { nickname: 'Pessoa', state: 'ac', municipality: '99999' },
      })
    ).status(),
  ).toBe(400);
});
