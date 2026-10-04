import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { View } from '../../src/lib/tse/types';
async function countingView(page: Page): Promise<View> {
  const response = await page.request.get('/api/results?scope=br&office=1');
  const view = (await response.json()) as View;
  const result = view.resource.current!.data;
  // Synthetic transitions ONLY in tests; never part of a production cache.
  result.phase = 'counting';
  result.metrics.votes = 1234;
  result.metrics.totalized = 10;
  result.metrics.pending = 20;
  result.metrics.totalizedPercent = '33,33';
  result.metrics.totalizedPercentValue = 33.33;
  result.candidates[0].votes = 900;
  result.candidates[0].percentage = '72,93';
  result.candidates[0].percentageValue = 72.93;
  result.candidates[1].votes = 334;
  result.candidates[1].percentage = '27,07';
  result.candidates[1].percentageValue = 27.07;
  view.resource.current!.source.hash = 'test-only-counting';
  view.serverNow = '2026-10-04T20:05:00Z';
  view.resource.current!.source.fetchedAt = view.serverNow;
  if (view.health) view.health.heartbeatAt = view.serverNow;
  return view;
}
test('official unreleased state has no fabricated electoral numbers', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Presidente da República' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Apuração ainda não liberada' })).toBeVisible();
  await expect(page.locator('.candidate-row')).toHaveCount(0);
  await expect(page.locator('progress')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('heartbeat refreshes worker health without replacing the official result', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-04T20:06:00Z'));
  const view = await countingView(page),
    health = { ...view.health!, heartbeatAt: '2026-10-04T20:06:00Z' };
  await page.route('**/api/results?*', (route) => route.fulfill({ json: view }));
  // Controlled open connection: a fulfilled finite SSE body closes immediately.
  // Actual HTTP renewal is exercised separately below.
  await page.addInitScript(
    ({ view, health }) => {
      class ControlledSource extends EventTarget {
        static OPEN = 1;
        readyState = 1;
        onopen: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(url: string) {
          super();
          void url;
          setTimeout(() => {
            this.onopen?.();
            this.dispatchEvent(new MessageEvent('snapshot', { data: JSON.stringify(view) }));
          }, 200);
          setTimeout(
            () =>
              this.dispatchEvent(
                new MessageEvent('heartbeat', {
                  data: JSON.stringify({ health, serverNow: health.heartbeatAt }),
                }),
              ),
            400,
          );
        }
        close() {
          this.readyState = 2;
        }
      }
      Object.defineProperty(window, 'EventSource', { value: ControlledSource });
    },
    { view, health },
  );
  await page.goto('/');
  await expect(page.getByText('900 votos', { exact: true })).toBeVisible();
  await expect(page.getByText('Conexão com o TSE instável', { exact: true })).toHaveCount(0);
});
test('national preparation is accessible with keyboard and AA contrast', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByText('Pular para os resultados')).toBeFocused();
  const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(scan.violations).toEqual([]);
});
test('navigation, states, municipality code and foreign locality', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Estados', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Apuração nos estados' })).toBeVisible();
  await page.getByRole('link', { name: 'Municípios', exact: true }).click();
  await page.getByLabel('Estado', { exact: true }).selectOption('ac');
  await page.getByLabel('Município', { exact: true }).selectOption('01120');
  await expect(page).toHaveURL(/municipality=01120/);
  await page.getByRole('link', { name: 'Exterior', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Votação no Exterior' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Brasil × Exterior' })).toBeVisible();
  await page.getByLabel('Localidade', { exact: true }).selectOption('29254');
  await expect(page).toHaveURL(/municipality=29254/);
  await expect(page.getByText('ABIDJÃ · EXTERIOR')).toBeVisible();
});
test('zero vs counting and client updates use the internal SSE API', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T20:05:00Z'));
  const view = await countingView(page);
  await page.route('**/api/events?*', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: `id: test-only\nevent: snapshot\ndata: ${JSON.stringify(view)}\n\n`,
    }),
  );
  await page.route('**/api/results?*', (route) => route.fulfill({ json: view }));
  const external: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('resultados.tse.jus.br')) external.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('.candidate-row')).toHaveCount(
    Math.min(5, view.resource.current!.data.candidates.length),
  );
  await expect(page.getByText('900 votos', { exact: true })).toBeVisible();
  await expect(page.locator('progress:visible')).toHaveAttribute('value', '33.33');
  expect(external).toEqual([]);
  const scan = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
  expect(scan.violations).toEqual([]);
});
test('invalid signature preserves the last valid snapshot and identifies it', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T20:05:00Z'));
  const view = await countingView(page);
  view.resource.status = 'invalid-signature';
  await page.route('**/api/events?*', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: `event: snapshot\ndata: ${JSON.stringify(view)}\n\n`,
    }),
  );
  await page.route('**/api/results?*', (route) => route.fulfill({ json: view }));
  await page.goto('/');
  await expect(page.getByText(/Falha temporária ao validar dados oficiais/)).toBeVisible();
  await expect(page.getByText('900 votos', { exact: true })).toBeVisible();
});
test('offline shell preserves an explicitly dated last received result', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(localStorage.getItem('ele2026:scope=br&office=1')));
  await context.setOffline(true);
  await expect(page.getByText(/Sem conexão. Exibindo último resultado/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sem conexão.' })).toBeVisible();
  await expect(page.getByText(/Exibindo último resultado recebido às/)).toBeVisible();
  await context.setOffline(false);
});
test('health and API reject unconfigured municipality and SSRF attempts', async ({ request }) => {
  const health = await request.get('/api/health');
  const json = await health.json();
  expect(json).toHaveProperty('lastSuccessfulFetch');
  expect(json).not.toHaveProperty('redisUrl');
  expect((await request.get('/api/results?scope=ac&municipality=1120')).status()).toBe(400);
  expect((await request.get('/api/results?scope=http://evil.test')).status()).toBe(400);
});
test('offline exterior keeps the selected official scope', async ({ page, context }) => {
  await page.goto('/exterior');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(
    () =>
      Boolean(localStorage.getItem('ele2026:primary:/exterior')) &&
      Boolean(localStorage.getItem('ele2026:scope=zz&office=1')),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /EXTERIOR/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Brasil/ })).toHaveCount(0);
  await context.setOffline(false);
});
test('offline shell also enforces the presidential 17h release gate', async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T19:00:00Z'));
  const view = await countingView(page);
  await page.route('**/api/results?*', (route) => route.fulfill({ json: view }));
  await page.route('**/api/events?*', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: `event: snapshot\ndata: ${JSON.stringify(view)}\n\n`,
    }),
  );
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem('ele2026:scope=br&office=1') || 'null')?.view?.resource
        ?.current?.data?.phase === 'counting',
  );
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('900 votos', { exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Apuração ainda não liberada no último arquivo recebido.'),
  ).toBeVisible();
  await context.setOffline(false);
});
test('SSE frames are parseable and heartbeat connections renew', async ({ page }) => {
  test.setTimeout(70_000);
  let connections = 0;
  page.on('request', (r) => {
    if (r.url().includes('/api/events?')) connections++;
  });
  await page.goto('/');
  await expect.poll(() => connections, { timeout: 6000 }).toBe(1);
  await expect
    .poll(() => connections, { timeout: 60_000, intervals: [5000] })
    .toBeGreaterThanOrEqual(2);
});
