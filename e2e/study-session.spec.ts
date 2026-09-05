import { expect, test } from '@playwright/test';
import { completeSession, openApp, TONE_MARK_RE } from './helpers';

test.describe('Daily study session (Journey 1)', () => {
  test('rapid recognition hides pinyin until tap, then rates with FSRS intervals', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByTestId('start-session').click();

    const card = page.getByTestId('recognition-card');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('session-progress')).toHaveText('Card 1 of 10');
    const hanzi = await page.getByTestId('prompt-hanzi').textContent();
    expect(hanzi).toMatch(/\p{Script=Han}/u);

    // AC-2: nothing pinyin-like before the tap.
    const before = (await card.textContent()) ?? '';
    expect(before).not.toMatch(TONE_MARK_RE);
    await expect(page.getByTestId('pinyin')).toHaveCount(0);
    await expect(page.getByTestId('definition')).toHaveCount(0);
    await expect(page.getByTestId('rating-buttons')).toHaveAttribute('aria-hidden', 'true');

    await page.getByTestId('recognition-prompt').click();
    const pinyin = (await page.getByTestId('pinyin').textContent()) ?? '';
    expect(pinyin).toMatch(TONE_MARK_RE);
    expect(before).not.toContain(pinyin);
    await expect(page.getByTestId('definition')).toBeVisible();
    await expect(page.getByTestId('example-sentence')).toBeVisible();
    await expect(page.getByTestId('interval-1')).toHaveText(/^\d+m$/);
    await expect(page.getByTestId('reveal-latency')).toBeVisible();
    await expect(page.getByTestId('interval-4')).toHaveText(/\d+(d|mo)/);

    await page.getByTestId('rate-3').click();
    await expect(page.getByTestId('session-progress')).toHaveText(/Card 2 of/);
  });

  test('a full session interleaves a drill, re-queues lapses and ends with a summary', async ({
    page,
  }) => {
    await openApp(page);
    await page.getByTestId('start-session').click();
    const run = await completeSession(page, { firstRating: 1 });
    expect(run.recognitions).toBeGreaterThanOrEqual(11); // 10 new + the re-queued "Again" card
    expect(run.drills.length).toBeGreaterThanOrEqual(1); // every 5th card triggers a drill

    await expect(page.getByTestId('summary-cards')).toHaveText('10');
    await expect(page.getByTestId('summary-retention')).toHaveText(/\d+\/10/);
    await expect(page.getByTestId('summary-streak')).toHaveText(/Day 1/);
    await expect(page.getByTestId('summary-next')).toBeVisible();
    await expect(page.getByTestId('weak-words')).toBeVisible(); // the "Again" card gets one more look
    await page.getByTestId('summary-done').click();

    await expect(page.getByTestId('due-summary')).toHaveText('Done for today ✓');
    await expect(page.getByTestId('streak-badge')).toHaveText(/Day 1/);
    await expect(page.getByTestId('today-new')).toHaveText(/New 10\/10/);
  });

  test('progress survives a reload and the session can be ended early', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('start-session').click();
    await page.getByTestId('recognition-prompt').click();
    await page.getByTestId('rate-4').click();
    await page.getByTestId('study-finish').click();
    await expect(page.getByTestId('session-summary')).toBeVisible();
    await expect(page.getByTestId('summary-answers')).toHaveText('1');
    await expect(page.getByTestId('summary-remaining')).toHaveText(/9 cards/);
    // Ending early is a pause: the session can be resumed in place.
    await page.getByTestId('summary-continue').click();
    await expect(page.getByTestId('recognition-prompt')).toBeVisible();
    await page.reload();
    await page.goto('/');
    await expect(page.getByTestId('due-summary')).toHaveText('0 reviews, 9 new cards');
    await expect(page.getByTestId('today-answers')).toHaveText(/1 answer/);
  });

  test('keyboard shortcuts reveal and rate', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('start-session').click();
    await expect(page.getByTestId('recognition-prompt')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('pinyin')).toBeVisible();
    await page.keyboard.press('4');
    await expect(page.getByTestId('session-progress')).toHaveText(/Card 2 of/);
  });
});
