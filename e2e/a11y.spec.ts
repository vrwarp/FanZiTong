import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

const PAGES = ['/', '/drills', '/vocab', '/stats', '/settings', '/vocab/new'];

for (const path of PAGES) {
  test(`has no serious accessibility violations on ${path}`, async ({ page }) => {
    await openApp(page, path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map(
        (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
      ),
    ).toEqual([]);
  });
}

test('the study screen has no serious accessibility violations', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('start-session').click();
  await expect(page.getByTestId('recognition-prompt')).toBeVisible();
  const hidden = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  await page.getByTestId('recognition-prompt').click();
  await expect(page.getByTestId('pinyin')).toBeVisible();
  const revealed = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  for (const results of [hidden, revealed]) {
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }
});
