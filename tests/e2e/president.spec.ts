import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { View } from '../../src/lib/tse/types';
import type { GeographyView } from '../../src/features/president/model';
test('top five chart, state exploration, reactions and percentage highlights', async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-04T20:10:00Z'));
  const view = (await (await page.request.get('/api/results?scope=br&office=1')).json()) as View;
  // Controlled counting values confined to browser routes, never to production ingestion/cache.
  const result = view.resource.current!.data;
  result.phase = 'counting';
  result.metrics.totalizedPercent = '42,31';
  result.metrics.totalizedPercentValue = 42.31;
  result.candidates.forEach((c, i) => {
    c.votes = 10000 - i * 100;
    c.percentage = (45 - i * 3).toFixed(2).replace('.', ',');
    c.percentageValue = 45 - i * 3;
  });
  view.transport = 'polling';
  view.serverNow = '2026-10-04T20:10:00Z';
  view.resource.current!.source.hash = 'isolated-hero-test';
  view.resource.current!.source.fetchedAt = view.serverNow;
  view.health!.heartbeatAt = view.serverNow;
  const stateCandidates = structuredClone(result.candidates);
  const geography: GeographyView = {
    states: [
      {
        scope: 'ac',
        municipality: null,
        name: 'ACRE',
        candidates: stateCandidates,
        totalization: '50,12',
        source: view.resource.current!.source,
        stale: false,
      },
    ],
    municipalities: [],
    expectedStates: 27,
    totalMunicipalities: 5570,
    observedMunicipalities: 0,
  };
  const counts = Object.fromEntries(
    result.candidates.map((c) => [c.id, { like: 0, dislike: 0, selected: null as string | null }]),
  );
  await page.route('**/api/results?*', (route) => route.fulfill({ json: view }));
  await page.route('**/api/events?*', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: `event: snapshot\ndata: ${JSON.stringify(view)}\n\n`,
    }),
  );
  await page.route('**/api/geography', (route) =>
    route.fulfill({ json: geography, headers: { ETag: '"test-geography"' } }),
  );
  await page.route('**/api/chat/reactions', (route) => {
    if (route.request().method() === 'POST') {
      const { candidate, value } = route.request().postDataJSON();
      counts[candidate] = {
        like: value === 'like' ? 1 : 0,
        dislike: value === 'dislike' ? 1 : 0,
        selected: value,
      };
    }
    return route.fulfill({ json: { counts } });
  });
  await page.goto('/');
  await expect(page.locator('.race-row')).toHaveCount(5);
  await expect(page.getByText('10.000 votos', { exact: true })).toBeVisible();
  await expect(page.locator('.brazil-map path')).toHaveCount(27);
  await page.locator('.brazil-map path[aria-label^="AC:"]').click();
  await expect(page.locator('.map-detail')).toContainText('ACRE');
  await expect(page.locator('.map-detail')).toContainText('50,12%');
  await expect(page.locator('.geographic-highlights')).toContainText('Municípios consultados');
  await expect(page.locator('.geographic-highlights')).toContainText(
    'sem cobertura nacional completa',
  );
  const like = page.getByRole('button', {
    name: `Curtir ${result.candidates[0].name}`,
    exact: true,
  });
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.screenshot({
    path: `.impeccable/review/hero-counting-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `.impeccable/review/hero-counting-viewport-${testInfo.project.name}.png`,
  });
});
test('preparation does not expose reactions or colored leaders', async ({
  page,
  request,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.race-row')).toHaveCount(0);
  await expect(page.locator('.brazil-map path')).toHaveCount(27);
  expect(
    await page
      .locator('.brazil-map path')
      .evaluateAll((paths) => paths.every((p) => p.getAttribute('fill') === '#dce2dd')),
  ).toBe(true);
  const response = await request.post('/api/chat/reactions', {
    headers: { origin: 'http://localhost:3100' },
    data: { candidate: '999999', value: 'like' },
  });
  expect(response.status()).toBe(409);
  await page.screenshot({
    path: `.impeccable/review/hero-waiting-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
