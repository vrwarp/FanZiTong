import { expect, test } from '@playwright/test';
import { leechBackup, openApp } from './helpers';

test.describe('Reading, topics and words of your own', () => {
  test('a pasted text puts the deck words in it first in line', async ({ page }) => {
    await openApp(page, '/vocab');
    await page.getByTestId('vocab-data').locator('summary').click();
    await page.getByTestId('paste-text-open').click();
    await expect(page).toHaveURL(/\/vocab\/paste$/);
    await page.getByTestId('paste-text').fill('主日牧師講道之後，我們一起吃滷肉飯。');
    await expect(page.getByTestId('paste-result')).toBeVisible();
    await expect(page.getByTestId('paste-studied')).toHaveText('0');
    await expect(page.getByTestId('paste-result')).toContainText('牧師');
    await expect(page.getByTestId('paste-uncovered')).toContainText('我');
    await page.getByTestId('paste-queue').click();
    await expect(page.getByTestId('paste-queued')).toContainText('next');

    // The first new word of the next session is the first deck word of the text.
    await page.goto('/study');
    await expect(page.getByTestId('prompt-hanzi')).toHaveText('主日');
    // No reading before the tap, and the by-ear question only after it.
    await expect(page.getByTestId('by-ear-ask')).toHaveCount(0);
    await page.getByTestId('recognition-prompt').click();
    await page.getByTestId('by-ear-yes').click();
    await expect(page.getByTestId('by-ear')).toContainText('by ear');
  });

  test('a topic can be switched off, and stays off', async ({ page }) => {
    await openApp(page, '/settings');
    const topic = page.getByTestId('topic-church-buddhist');
    await expect(topic).toBeChecked();
    await topic.uncheck();
    await expect(topic).not.toBeChecked();
    await page.reload();
    await expect(page.getByTestId('topic-church-buddhist')).not.toBeChecked();
  });

  test('the common-character check keeps what could not be read', async ({ page }) => {
    await openApp(page, '/drills');
    await page.getByTestId('open-read').click();
    await expect(page).toHaveURL(/\/read$/);
    // Nothing studied yet: nothing to read.
    await expect(page.getByText('Nothing to read yet')).toBeVisible();

    // One studied word, from a backup.
    await page.goto('/settings');
    await page.getByTestId('backup-file').setInputFiles({
      name: 'one.json',
      mimeType: 'application/json',
      buffer: Buffer.from(leechBackup(new Date()), 'utf8'),
    });
    await page.getByTestId('import-overwrite').check();
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('settings-notice')).toContainText('Restored 1 cards');

    await page.goto('/read');
    await expect(page.getByTestId('read-coverage')).toBeVisible();
    await expect(page.getByTestId('check-remaining')).toBeVisible();
    await page.getByTestId('check-start').click();
    const first = page.getByTestId('check-char').first();
    const char = (await first.textContent())?.trim().slice(0, 1) ?? '';
    await first.click();
    await page.getByTestId('check-show').click();
    await page.getByTestId('check-save').click();
    // The next page of characters is offered; stop and look at what was kept.
    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByTestId('check-unknown')).toContainText(char);

    // Stats carries it.
    await page.goto('/stats');
    await expect(page.getByTestId('reading-gaps')).toContainText(char);
    await expect(page.getByTestId('stat-readable')).toHaveText('1');
    await expect(page.getByTestId('stat-set-aside')).toHaveText('0');

    // A word set aside in the editor is listed in Stats, and can be brought back there.
    await page.goto('/vocab');
    await page.getByTestId('vocab-search').fill('藉口');
    await page.getByTestId('vocab-item').first().click();
    await page.getByTestId('set-aside-card').click();
    await expect(page.getByTestId('set-aside-card')).toHaveText('Bring back');
    await page.goto('/stats');
    await expect(page.getByTestId('stat-set-aside')).toHaveText('1');
    await page.getByTestId('bring-back').click();
    await expect(page.getByTestId('stat-set-aside')).toHaveText('0');
  });
});
