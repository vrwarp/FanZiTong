import { expect, test } from '@playwright/test';
import { openApp, solveDrill, TONE_MARK_RE } from './helpers';

test.describe('Drills tab (standalone modalities)', () => {
  test('foil discrimination: pick the right shape among look-alikes', async ({ page }) => {
    await openApp(page, '/drills');
    await page.getByTestId('drill-count').selectOption('3');
    await page.getByTestId('start-drill-foil_discrimination').click();

    await expect(page.getByTestId('foil-exercise')).toBeVisible();
    await expect(page.getByTestId('foil-cue')).toHaveText(TONE_MARK_RE);
    await expect(page.getByTestId('foil-option')).toHaveCount(4);
    await expect(page.locator('[data-testid="foil-option"][data-correct="true"]')).toHaveCount(1);

    for (let i = 0; i < 3; i += 1) {
      await expect(page.getByTestId('foil-exercise')).toBeVisible();
      expect(await solveDrill(page)).toBe('foil');
    }
    await expect(page.getByTestId('session-summary')).toBeVisible();
    await expect(page.getByTestId('summary-retention')).toHaveText('3/3');
    await expect(page.getByTestId('summary-answers')).toHaveText('3');
  });

  test('spot the character: a wrong pick explains the differing character and asks for one corrective tap', async ({
    page,
  }) => {
    await openApp(page, '/drills');
    await page.goto('/drills/foil_discrimination?count=1');
    await expect(page.getByTestId('foil-exercise')).toBeVisible({ timeout: 20_000 });
    const answer =
      (await page.locator('[data-testid="foil-option"][data-correct="true"]').textContent()) ?? '';
    const wrong = page.locator('[data-testid="foil-option"][data-correct="false"]').first();
    await wrong.click();
    await expect(page.getByTestId('foil-feedback')).toContainText('不對');
    await expect(page.getByTestId('foil-confirm-hint')).toContainText(answer);
    await expect(page.getByTestId('drill-continue')).toHaveCount(0);
    await page.locator('[data-testid="foil-option"][data-correct="true"]').click();
    await expect(page.getByTestId('drill-outcome')).toContainText('Again');
    await page.getByTestId('drill-continue').click();
    await expect(page.getByTestId('session-summary')).toBeVisible();
  });

  test('cloze: the sentence never shows pinyin; a wrong pick is corrected', async ({ page }) => {
    await openApp(page, '/drills');
    await page.getByTestId('drill-domain').selectOption('church');
    await page.getByTestId('drill-count').selectOption('3');
    await page.getByTestId('start-drill-cloze').click();

    await expect(page.getByTestId('cloze-exercise')).toBeVisible();
    const sentence = (await page.getByTestId('cloze-sentence').textContent()) ?? '';
    expect(sentence).toMatch(/＿＿/);
    expect(sentence).not.toMatch(TONE_MARK_RE);
    expect(sentence).not.toMatch(/[a-z]/i);
    await expect(page.getByTestId('cloze-option')).toHaveCount(4);

    await page.locator('[data-testid="cloze-option"][data-correct="false"]').first().click();
    await expect(page.getByTestId('cloze-feedback')).toContainText('不對');
    await expect(page.getByTestId('cloze-feedback')).toHaveText(TONE_MARK_RE);
    await page.getByTestId('drill-continue').click();
    await expect(page.getByTestId('cloze-exercise')).toBeVisible();
  });

  test('menu realia: tick the ordered dishes on the slip within the time window', async ({
    page,
  }) => {
    await openApp(page, '/drills');
    await page.getByTestId('drill-count').selectOption('3');
    await page.getByTestId('start-drill-realia_menu').click();

    const exercise = page.getByTestId('menu-exercise');
    await expect(exercise).toBeVisible();
    await expect(page.getByTestId('menu-slip')).toContainText('點菜單');
    await expect(page.getByTestId('menu-timer')).toHaveText(/\d+s/);
    // The order is cued by sound + meaning, so the slip has to be read.
    const prompt = (await page.getByTestId('menu-prompt').textContent()) ?? '';
    expect(prompt).toMatch(TONE_MARK_RE);
    const keys = ((await exercise.getAttribute('data-target-keys')) ?? '').split(',');
    expect(keys.length).toBeGreaterThanOrEqual(2);
    for (const key of keys) {
      const label = await page
        .locator(`[data-testid="menu-checkbox"][data-key="${key}"]`)
        .locator('xpath=ancestor::li')
        .getAttribute('data-label');
      expect(prompt).not.toContain(label ?? '∅');
    }
    await expect(page.getByTestId('menu-slip')).toContainText(/\d+/); // prices

    for (const key of keys)
      await page.locator(`[data-testid="menu-checkbox"][data-key="${key}"]`).check();
    await page.getByTestId('menu-submit').click();
    await expect(page.getByTestId('menu-feedback')).toContainText('Perfect order');
    await page.getByTestId('drill-continue').click();
    await expect(
      page.getByTestId('session-summary').or(page.getByTestId('menu-exercise')),
    ).toBeVisible();
  });

  test('menu realia: a wrong order is marked and rated', async ({ page }) => {
    await openApp(page, '/drills');
    await page.goto('/drills/realia_menu?count=2');
    await expect(page.getByTestId('menu-exercise')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid="menu-checkbox"]').first().check();
    await page.getByTestId('menu-submit').click();
    await expect(page.getByTestId('menu-feedback')).toContainText('❌');
    await page.getByTestId('drill-continue').click();
    await expect(page.getByTestId('session-summary')).toBeVisible();
    await expect(page.getByTestId('summary-retention')).not.toHaveText(/^(\d+)\/\1$/);
  });
});
