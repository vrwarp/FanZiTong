import { expect, test, type Page } from '@playwright/test';
import { openApp, TONE_MARK_RE } from './helpers';
import { startFakeSidecar, type FakeSidecar } from './fixtures/fakeSidecar';

/** Pair the app with the fake sidecar before the first render. */
async function pair(page: Page, url: string) {
  await page.addInitScript(
    ([endpoint]) => {
      localStorage.setItem('fzt-assistant-endpoint', endpoint);
      localStorage.setItem('fzt-assistant-token', 'test-token');
    },
    [url],
  );
}

const NEW_CARD = {
  cards: [
    {
      traditional: '青草茶',
      pinyin: 'qīng cǎo chá',
      definition: 'Herbal tea',
      domain: 'food',
      tags: ['drink'],
    },
  ],
  reason: 'Asked for a night-market drink',
};

test.describe('Assistant', () => {
  let sidecar: FakeSidecar;

  test.afterEach(async () => {
    await sidecar?.close();
  });

  test('adds a card the learner asked for, and undoes it', async ({ page }) => {
    sidecar = await startFakeSidecar([
      { say: 'Added 青草茶.' },
      { call: 'deck_upsert_cards', input: NEW_CARD },
      { finish: 'Added 青草茶 to your deck.' },
    ]);
    await pair(page, sidecar.url);
    await openApp(page, '/vocab');

    await page.getByTestId('assistant-launcher').click();
    await page.getByTestId('assistant-composer').fill('add a night-market drink');
    await page.getByRole('button', { name: 'Send' }).click();

    // The tool step reports what actually happened to the deck.
    await expect(page.getByTestId('assistant-tool-step')).toContainText('1 added');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('vocab-search').fill('青草茶');
    await expect(page.getByTestId('vocab-item')).toHaveCount(1);

    await page.getByTestId('assistant-launcher').click();
    await page.getByTestId('assistant-undo').click();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('vocab-search').fill('青草茶');
    await expect(page.getByTestId('vocab-item')).toHaveCount(0);
  });

  test('refuses a card written in simplified characters', async ({ page }) => {
    sidecar = await startFakeSidecar([
      {
        call: 'deck_upsert_cards',
        input: {
          cards: [{ traditional: '青草茶', pinyin: 'qīng cǎo chá', definition: '凉茶饮料' }],
          reason: 'Simplified slipped in',
        },
      },
      { finish: 'That one was rejected.' },
    ]);
    await pair(page, sidecar.url);
    await openApp(page, '/vocab');

    await page.getByTestId('assistant-launcher').click();
    await page.getByTestId('assistant-composer').fill('add a drink');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByTestId('assistant-tool-step')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByTestId('vocab-search').fill('青草茶');
    await expect(page.getByTestId('vocab-item')).toHaveCount(0);
  });

  test('stays hidden until the learner reveals the card (AC-2)', async ({ page }) => {
    sidecar = await startFakeSidecar([{ finish: 'ok' }]);
    await pair(page, sidecar.url);
    await openApp(page, '/');
    await page.getByTestId('start-session').click();
    await expect(page.getByTestId('recognition-card')).toBeVisible();

    // No way in, and no reading anywhere on the screen.
    await expect(page.getByTestId('assistant-launcher')).toHaveCount(0);
    const before = (await page.getByTestId('recognition-card').innerText()) ?? '';
    expect(before).not.toMatch(TONE_MARK_RE);

    // Tapping the screen is how the card is revealed.
    await page.getByTestId('recognition-prompt').click();
    await expect(page.getByTestId('pinyin')).toBeVisible();
    await expect(page.getByTestId('assistant-launcher')).toBeVisible();
    await expect(page.getByTestId('study-ask')).toBeVisible();
  });

  test('says so, quietly, when the sidecar is not reachable', async ({ page }) => {
    sidecar = await startFakeSidecar([]);
    const dead = sidecar.url.replace(/:\d+$/, ':1');
    await pair(page, dead);
    await openApp(page, '/vocab');

    // The app is untouched: the deck still works with no assistant behind it.
    await expect(page.getByTestId('vocab-item').first()).toBeVisible();
    await page.getByTestId('assistant-launcher').click();
    await expect(page.getByTestId('assistant-panel')).toContainText('offline');
  });
});

test.describe('Signing in', () => {
  let sidecar: FakeSidecar;

  test.afterEach(async () => {
    await sidecar?.close();
  });

  test('hands over a link, takes the code back, and connects', async ({ page }) => {
    sidecar = await startFakeSidecar([{ finish: 'Hello.' }]);
    await openApp(page, '/settings');

    // Nothing is stored yet: the address is all the learner has.
    await page.getByTestId('assistant-endpoint').fill(sidecar.url);
    await page.getByTestId('assistant-endpoint').blur();

    await page.getByTestId('assistant-signin').click();
    const link = page.getByTestId('assistant-signin-link');
    await expect(link).toBeVisible();
    // The link goes to Claude, not to the assistant.
    await expect(link).toHaveAttribute('href', /^https:\/\/claude\.com\//);

    await page.getByTestId('assistant-code').fill('good-code');
    await page.getByTestId('assistant-code-submit').click();

    await expect(page.getByTestId('assistant-status')).toContainText('Connected');
    await expect(page.getByTestId('assistant-status')).toContainText('owner@example.com');
    // The session it minted is what the app keeps, not anything the user typed.
    const stored = await page.evaluate(() => localStorage.getItem('fzt-assistant-token'));
    expect(stored).toBe('session-token-1');
  });

  test('says so when the code is wrong, and stays signed out', async ({ page }) => {
    sidecar = await startFakeSidecar([]);
    await openApp(page, '/settings');
    await page.getByTestId('assistant-endpoint').fill(sidecar.url);
    await page.getByTestId('assistant-endpoint').blur();

    await page.getByTestId('assistant-signin').click();
    await page.getByTestId('assistant-code').fill('wrong-code');
    await page.getByTestId('assistant-code-submit').click();

    await expect(page.getByRole('alert')).toContainText('not accepted');
    expect(await page.evaluate(() => localStorage.getItem('fzt-assistant-token'))).toBeNull();
  });

  test('turns a stranger away once someone else has claimed it', async ({ page }) => {
    sidecar = await startFakeSidecar([], { claimed: true });
    await openApp(page, '/settings');
    await page.getByTestId('assistant-endpoint').fill(sidecar.url);
    await page.getByTestId('assistant-endpoint').blur();

    await expect(page.getByTestId('assistant-settings')).toContainText(
      'already belongs to a Claude account',
    );
    await expect(page.getByTestId('assistant-signin')).toBeDisabled();
  });

  test('refuses an unencrypted address that is not this machine', async ({ page }) => {
    sidecar = await startFakeSidecar([]);
    await openApp(page, '/settings');
    await page.getByTestId('assistant-endpoint').fill('ws://192.168.1.50:8787');
    await page.getByTestId('assistant-endpoint').blur();

    await expect(page.getByRole('alert')).toContainText('wss://');
    await expect(page.getByTestId('assistant-signin')).toHaveCount(0);
  });
});
