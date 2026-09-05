import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openApp, SAMPLE_CSV } from './helpers';
import type { Page } from '@playwright/test';

async function openDataTools(page: Page) {
  await page.getByTestId('vocab-data').locator('summary').click();
}

test.describe('Vocab tab: import, export, edit (Journey 2, AC-3)', () => {
  test('imports a CSV with preview, duplicate flags and a domain tag', async ({ page }) => {
    await openApp(page, '/vocab');
    await openDataTools(page);
    await page.getByTestId('import-file').setInputFiles({
      name: 'sermon-and-dishes.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(SAMPLE_CSV, 'utf8'),
    });
    const dialog = page.getByTestId('import-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="import-row"]')).toHaveCount(4);
    await expect(dialog.locator('[data-testid="import-row"][data-status="duplicate"]')).toHaveCount(
      1,
    );
    await expect(
      dialog.locator('[data-testid="import-row"][data-status="duplicate-in-file"]'),
    ).toHaveCount(1);
    await expect(dialog.locator('[data-testid="import-row"][data-status="new"]')).toHaveCount(2);
    await expect(page.getByTestId('import-confirm')).toHaveText('Import 2 cards');

    await page.getByTestId('import-domain').selectOption('church');
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('vocab-notice')).toContainText(
      'Imported 2 new, updated 0, skipped 2',
    );

    await page.getByTestId('vocab-search').fill('火鍋料');
    const item = page.getByTestId('vocab-item');
    await expect(item).toHaveCount(1);
    await expect(item).toContainText('火鍋料');
    await expect(item.locator('[aria-label="Church"]')).toHaveCount(1);
    await expect(page.getByTestId('vocab-pinyin')).toHaveCount(0);
    await page.getByTestId('toggle-pinyin').check();
    await expect(page.getByTestId('vocab-pinyin')).toHaveText('huǒ guō liào');
  });

  test('exports JSON and CSV with intact Traditional characters', async ({ page }) => {
    await openApp(page, '/vocab');
    await openDataTools(page);

    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-json').click(),
    ]);
    expect(jsonDownload.suggestedFilename()).toMatch(/^fanzitong-deck-.*\.json$/);
    const json = JSON.parse(await readFile((await jsonDownload.path())!, 'utf8'));
    expect(json.version).toBe('1.0');
    expect(json.deckName).toBeTruthy();
    expect(json.cards.length).toBeGreaterThanOrEqual(80);
    const lurou = json.cards.find((c: { traditional: string }) => c.traditional === '滷肉飯');
    expect(lurou).toMatchObject({ pinyin: 'lǔ ròu fàn', domain: 'food', fsrs: { state: 0 } });
    expect(lurou.exampleSentenceTraditional).toContain('滷肉飯');

    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-csv').click(),
    ]);
    const csv = await readFile((await csvDownload.path())!, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\n')[0]).toBe(
      'traditional,pinyin,definition,domain,tags,example_sentence,foils,example_pinyin,example_translation,variants',
    );
    expect(csv).toContain('滷肉飯,lǔ ròu fàn,');
    expect(csv).toContain('團契,tuán qì,');
    expect(csv).toMatch(/滷肉飯,.*魯肉飯/); // accepted variant round-trips
    const lurouJson = json.cards.find((c: { traditional: string }) => c.traditional === '滷肉飯');
    expect(lurouJson.variants).toEqual(['魯肉飯']);
  });

  test('re-importing an export restores every card without duplication', async ({ page }) => {
    await openApp(page, '/vocab');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-json').click(),
    ]);
    const text = await readFile((await download.path())!, 'utf8');
    await page.getByTestId('import-file').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(text, 'utf8'),
    });
    await expect(page.getByTestId('import-dialog')).toBeVisible();
    await expect(page.getByTestId('import-confirm')).toBeDisabled(); // everything is a duplicate
    await page.getByTestId('import-overwrite').check();
    await expect(page.getByTestId('import-confirm')).toBeEnabled();
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('vocab-notice')).toContainText('Imported 0 new, updated');
  });

  test('adds, edits and deletes a card in the inline editor', async ({ page }) => {
    await openApp(page, '/vocab');
    await page.getByTestId('add-card').click();
    await page.getByTestId('field-traditional').fill('青草茶');
    await page.getByTestId('field-pinyin').fill('qing1 cao3 cha2');
    await page.getByTestId('field-definition').fill('Herbal tea');
    await page.getByTestId('field-domain').selectOption('food');
    await page.getByTestId('field-sentence').fill('夏天喝青草茶很消暑。');
    await page.getByTestId('field-foils').fill('清草茶 | 青草荼');
    await page.getByTestId('save-card').click();

    await page.getByTestId('vocab-search').fill('青草茶');
    await expect(page.getByTestId('vocab-item')).toHaveCount(1);
    await page.getByTestId('vocab-item').click();
    await expect(page.getByTestId('field-pinyin')).toHaveValue('qīng cǎo chá');
    await expect(page.getByTestId('field-foils')).toHaveValue('清草茶 | 青草荼');

    await page.getByTestId('delete-card').click();
    await page.getByTestId('confirm-delete').click();
    await page.getByTestId('vocab-search').fill('青草茶');
    await expect(page.getByTestId('vocab-item')).toHaveCount(0);
  });

  test('rejects a duplicate word in the editor', async ({ page }) => {
    await openApp(page, '/vocab/new');
    await page.getByTestId('field-traditional').fill('滷肉飯');
    await page.getByTestId('save-card').click();
    await expect(page.getByRole('alert')).toContainText('already in your deck');
  });
});
