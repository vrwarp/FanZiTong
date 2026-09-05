import { expect, test } from '@playwright/test';
import { leechBackup, openApp } from './helpers';

test.describe('Settings and Stats (Journey 3)', () => {
  test('settings persist across reloads and drive the daily plan', async ({ page }) => {
    await openApp(page, '/settings');
    await page.getByTestId('theme-dark').click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByTestId('setting-max-new').fill('4');
    await page.getByTestId('setting-max-new').press('Enter');
    await page.getByTestId('setting-reveal').selectOption('3000');
    await page.getByTestId('domain-anime').uncheck();
    await expect(page.getByTestId('domain-anime')).not.toBeChecked();

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByTestId('setting-max-new')).toHaveValue('4');
    await expect(page.getByTestId('setting-reveal')).toHaveValue('3000');
    await expect(page.getByTestId('domain-anime')).not.toBeChecked();

    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: /Learn/ })
      .click();
    await expect(page.getByTestId('due-summary')).toHaveText('0 reviews, 4 new cards');
  });

  test('auto-reveal setting flips the card without a tap', async ({ page }) => {
    await openApp(page, '/settings');
    await page.getByTestId('setting-reveal').selectOption('3000');
    await page.goto('/study');
    await expect(page.getByTestId('recognition-prompt')).toBeVisible();
    await expect(page.getByTestId('pinyin')).toHaveCount(0);
    await expect(page.getByTestId('pinyin')).toBeVisible({ timeout: 6_000 });
  });

  test('leech inspection lists lapsed cards and launches a focused foil drill', async ({
    page,
  }) => {
    await openApp(page, '/settings');
    await page.getByTestId('backup-file').setInputFiles({
      name: 'leeches.json',
      mimeType: 'application/json',
      buffer: Buffer.from(leechBackup(new Date()), 'utf8'),
    });
    await expect(page.getByTestId('import-dialog')).toBeVisible();
    // 藉口 is also in the starter deck: restoring the backup over it must carry the file's FSRS state.
    await page.getByTestId('import-overwrite').check();
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('settings-notice')).toContainText('Restored 1 cards');

    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: /Stats/ })
      .click();
    await expect(page.getByTestId('stat-leeches')).toHaveText('1');
    await expect(page.getByTestId('stat-lapses')).toHaveText('4');
    await expect(page.getByTestId('leech-list')).toContainText('藉口');
    await expect(page.getByTestId('retention-gauge')).toBeVisible();
    await expect(page.getByTestId('daily-chart')).toBeVisible();
    await expect(page.getByTestId('domain-mastery')).toBeVisible();

    await page.getByTestId('practice-leeches').click();
    await expect(page.getByTestId('foil-exercise')).toBeVisible();
    await expect(page.getByTestId('foil-cue')).toContainText('jiè kǒu');
    await expect(page.locator('[data-testid="foil-option"][data-correct="true"]')).toHaveText(
      '藉口',
    );
  });

  test('full backup export and reset', async ({ page }) => {
    await openApp(page, '/settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-backup').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^fanzitong-backup-.*\.json$/);

    await page.getByTestId('reset-data').click();
    await page.getByTestId('confirm-reset').click();
    await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: /Learn/ })
      .click();
    await expect(page.getByTestId('due-summary')).toHaveText('0 reviews, 10 new cards');
  });
});
