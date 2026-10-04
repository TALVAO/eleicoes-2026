import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
await mkdir('.impeccable/review', { recursive: true });
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
void defaultBrowserType;
for (const [name, config] of [
  ['desktop', { viewport: { width: 1440, height: 1000 } }],
  ['mobile', iphone],
] as const) {
  const context = await browser.newContext(config);
  const page = await context.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true });
  console.log(
    name,
    await page.title(),
    await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    })),
  );
  await context.close();
}
await browser.close();
