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
    const wrong = page.locator('[data-testid="foil-option"][data-correct="false"]').first();
    await wrong.click();
    await expect(page.getByTestId('foil-feedback')).toContainText('不對');
    await expect(page.getByTestId('drill-continue')).toHaveCount(0);
    // Study the contrast, then find the word again among reshuffled, unmarked tiles.
    await page.getByTestId('foil-retry').click();
    await expect(page.getByTestId('foil-retry-hint')).toBeVisible();
    await expect(page.locator('[data-testid="foil-option"][data-correct="true"]')).toHaveCount(1);
    await page.locator('[data-testid="foil-option"][data-correct="true"]').click();
    await expect(page.getByTestId('drill-outcome')).toContainText('Again');
    await page.getByTestId('drill-continue').click();
    // The missed word is asked once more before the drill ends.
    await expect(page.getByTestId('drill-requeue-note')).toBeVisible();
    await expect(page.getByTestId('drill-progress')).toContainText('2 of 2');
    await page.locator('[data-testid="foil-option"][data-correct="true"]').click();
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

    // A real word that does not fit is explained and the learner picks again …
    await page
      .locator('[data-testid="cloze-option"][data-correct="false"][data-foil="false"]')
      .first()
      .click();
    await expect(page.getByTestId('cloze-misread')).toBeVisible();
    await expect(page.getByTestId('drill-continue')).toHaveCount(0);
    // … while the look-alike is a miss on the target word: contrast, then find it again.
    await page.locator('[data-testid="cloze-option"][data-foil="true"]').click();
    await expect(page.getByTestId('cloze-feedback')).toContainText('不對');
    await expect(page.getByTestId('drill-continue')).toHaveCount(0);
    await page.getByTestId('cloze-retry').click();
    await page.locator('[data-testid="cloze-option"][data-correct="true"]').click();
    await expect(page.getByTestId('cloze-feedback')).toHaveText(TONE_MARK_RE);
    await expect(page.getByTestId('drill-outcome')).toContainText('Again');
    await page.getByTestId('drill-continue').click();
    await expect(page.getByTestId('cloze-exercise')).toBeVisible();
  });

  test('which word: the meaning is the cue; by ear first, then the written word', async ({
    page,
  }) => {
    await openApp(page, '/drills');
    await page.getByTestId('drill-domain').selectOption('food');
    await page.getByTestId('drill-count').selectOption('3');
    await page.getByTestId('start-drill-meaning_to_form').click();

    await expect(page.getByTestId('meaning-exercise')).toBeVisible();
    const cue = (await page.getByTestId('meaning-cue').textContent()) ?? '';
    expect(cue).not.toMatch(TONE_MARK_RE);
    // Nothing is written on screen until the ear has answered.
    await expect(page.getByTestId('meaning-option')).toHaveCount(0);
    await expect(page.getByTestId('meaning-reading')).toHaveCount(4);
    await page.locator('[data-testid="meaning-reading"][data-correct="false"]').first().click();
    await expect(page.getByTestId('meaning-ear')).toContainText('New to your ear');
    await expect(page.getByTestId('meaning-option')).toHaveCount(4);

    // A real word that is not this one is explained and retired, not charged …
    await page
      .locator('[data-testid="meaning-option"][data-correct="false"][data-foil="false"]')
      .first()
      .click();
    await expect(page.getByTestId('meaning-misread')).toBeVisible();
    await expect(page.getByTestId('drill-continue')).toHaveCount(0);
    await page.locator('[data-testid="meaning-option"][data-correct="true"]').click();
    await expect(page.getByTestId('meaning-feedback')).toContainText('Found it');
    await expect(page.getByTestId('drill-outcome')).toContainText('No change');
    await page.getByTestId('drill-continue').click();
    // … and the next item comes up.
    await expect(page.getByTestId('meaning-exercise')).toBeVisible();
    await expect(page.getByTestId('drill-progress')).toContainText('2 of 3');
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
    // The missed dish is asked once more on a fresh slip before the drill ends.
    await expect(page.getByTestId('drill-requeue-note')).toBeVisible();
    await expect(page.getByTestId('menu-exercise')).toBeVisible();
    await page.getByTestId('drill-exit').click();
    await expect(page.getByTestId('session-summary')).toBeVisible();
    await expect(page.getByTestId('summary-retention')).not.toHaveText(/^(\d+)\/\1$/);
  });
});

test.describe('Drills tab (reading, text and families)', () => {
  test('say it: the reading is typed, marked by syllable, and shown only after the second miss', async ({
    page,
  }) => {
    await openApp(page, '/drills');
    await page.goto('/drills/typed_reading?count=1');
    await expect(page.getByTestId('typed-exercise')).toBeVisible({ timeout: 20_000 });
    const word = (await page.getByTestId('typed-prompt').textContent()) ?? '';
    expect(word).not.toMatch(TONE_MARK_RE);
    expect(await page.getByTestId('typed-exercise').textContent()).not.toMatch(TONE_MARK_RE);

    await page.getByTestId('typed-input').fill('xx');
    await page.getByTestId('typed-check').click();
    await expect(page.getByTestId('typed-feedback')).toContainText('不對');
    await expect(page.getByTestId('typed-syllable').first()).toBeVisible();
    // A wrong try does not spell the reading.
    expect(await page.getByTestId('typed-exercise').textContent()).not.toMatch(TONE_MARK_RE);
    await expect(page.getByTestId('drill-continue')).toHaveCount(0);

    await page.getByTestId('typed-input').fill('yy');
    await page.getByTestId('typed-input').press('Enter');
    const reading = (await page.getByTestId('typed-reading').textContent()) ?? '';
    expect(reading).toMatch(TONE_MARK_RE);
    await expect(page.getByTestId('drill-outcome')).toContainText('Again');
    await page.getByTestId('drill-continue').click();

    // The missed word comes back once more; typing the reading it showed is a
    // hit — practice, since the word was knocked down a moment ago.
    await expect(page.getByTestId('drill-progress')).toContainText('2 of 2');
    await expect(page.getByTestId('typed-prompt')).toHaveText(word);
    await page.getByTestId('typed-input').fill(reading);
    await page.getByTestId('typed-check').click();
    await expect(page.getByTestId('typed-feedback')).toContainText('Read it');
    await expect(page.getByTestId('drill-outcome')).toContainText('Practice');
    await page.getByTestId('drill-continue').click();
    await expect(page.getByTestId('session-summary')).toBeVisible();
    await expect(page.getByTestId('summary-answers')).toHaveText('2');
    await expect(page.getByTestId('summary-retention')).toHaveText('0/1');
  });

  test('find it: the word is spotted in running text; a wrong tap is named, not charged', async ({
    page,
  }) => {
    await openApp(page, '/drills');
    await page.getByTestId('drill-domain').selectOption('food');
    await page.getByTestId('drill-count').selectOption('3');
    await page.getByTestId('start-drill-find_in_text').click();

    await expect(page.getByTestId('find-exercise')).toBeVisible();
    await expect(page.getByTestId('find-cue')).toHaveText(TONE_MARK_RE);
    expect(await page.getByTestId('find-sentence').count()).toBeGreaterThanOrEqual(2);
    for (const text of await page.getByTestId('find-sentence').allTextContents()) {
      expect(text).not.toMatch(TONE_MARK_RE);
    }
    await expect(page.locator('[data-testid="find-word"][data-target="true"]')).toHaveCount(1);

    await page.locator('[data-testid="find-word"][data-target="false"]').first().click();
    await expect(page.getByTestId('find-misread')).toBeVisible();
    await expect(page.getByTestId('drill-continue')).toHaveCount(0);
    await page.locator('[data-testid="find-word"][data-target="true"]').click();
    await expect(page.getByTestId('find-feedback')).toContainText('Found it');
    await expect(page.getByTestId('drill-outcome')).toContainText('No change');
    await page.getByTestId('drill-continue').click();
    await expect(page.getByTestId('find-exercise')).toBeVisible();
    await expect(page.getByTestId('drill-progress')).toContainText('2 of 3');
  });

  test('sound families: the blanked character is found among its family', async ({ page }) => {
    await openApp(page, '/drills');
    await page.getByTestId('drill-count').selectOption('3');
    await page.getByTestId('start-drill-sound_family').click();

    await expect(page.getByTestId('family-exercise')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('family-cue')).toContainText('＿');
    expect(await page.getByTestId('family-option').count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('[data-testid="family-option"][data-correct="true"]')).toHaveCount(1);
    await page.locator('[data-testid="family-option"][data-correct="false"]').first().click();
    await expect(page.getByTestId('family-feedback')).toContainText('不對');
    await expect(page.getByTestId('drill-continue')).toHaveCount(0);
    await page.getByTestId('family-retry').click();
    await page.locator('[data-testid="family-option"][data-correct="true"]').click();
    await expect(page.getByTestId('family-feedback')).toContainText('Found it');
    await expect(page.getByTestId('drill-outcome')).toContainText('Again');
    await page.getByTestId('drill-continue').click();
    await expect(page.getByTestId('drill-requeue-note')).toBeVisible();
    await expect(page.getByTestId('family-exercise')).toBeVisible();
  });
});
