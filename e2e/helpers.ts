import { expect, type Page } from '@playwright/test';

export const TONE_MARK_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;

/**
 * Load a shell route fresh. Each Playwright context starts with an empty
 * IndexedDB, so the starter deck seeds during bootstrap; the bottom navigation
 * only renders once that has finished.
 */
export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible({ timeout: 20_000 });
  if (path === '/') await expect(page.getByTestId('start-session')).toBeVisible();
}

/** Solve whichever drill is on screen by picking the correct option(s). */
export async function solveDrill(page: Page, opts: { wrong?: boolean } = {}) {
  const cloze = page.getByTestId('cloze-exercise');
  const foil = page.getByTestId('foil-exercise');
  const menu = page.getByTestId('menu-exercise');
  if (await cloze.isVisible()) {
    const selector = `[data-testid="cloze-option"][data-correct="${opts.wrong ? 'false' : 'true'}"]`;
    await page.locator(selector).first().click();
    await page.getByTestId('drill-continue').click();
    return 'cloze';
  }
  if (await foil.isVisible()) {
    const selector = `[data-testid="foil-option"][data-correct="${opts.wrong ? 'false' : 'true'}"]`;
    await page.locator(selector).first().click();
    await page.getByTestId('drill-continue').click();
    return 'foil';
  }
  if (await menu.isVisible()) {
    const keys = ((await menu.getAttribute('data-target-keys')) ?? '').split(',').filter(Boolean);
    if (!opts.wrong) {
      for (const key of keys)
        await page.locator(`[data-testid="menu-checkbox"][data-key="${key}"]`).check();
    }
    await page.getByTestId('menu-submit').click();
    await page.getByTestId('drill-continue').click();
    return 'menu';
  }
  return null;
}

export interface SessionRunSummary {
  recognitions: number;
  drills: string[];
}

/**
 * Drive a study session to completion. The first recognition card gets
 * `firstRating`, every other one gets Easy so the session stays short.
 */
export async function completeSession(
  page: Page,
  { firstRating = 4, maxSteps = 120 }: { firstRating?: 1 | 2 | 3 | 4; maxSteps?: number } = {},
): Promise<SessionRunSummary> {
  const summary: SessionRunSummary = { recognitions: 0, drills: [] };
  for (let step = 0; step < maxSteps; step += 1) {
    if (await page.getByTestId('session-summary').isVisible()) return summary;
    if (await page.getByTestId('recognition-prompt').isVisible()) {
      await page.getByTestId('recognition-prompt').click();
      await expect(page.getByTestId('pinyin')).toBeVisible();
      const rating = summary.recognitions === 0 ? firstRating : 4;
      await page.getByTestId(`rate-${rating}`).click();
      summary.recognitions += 1;
      continue;
    }
    const drill = await solveDrill(page);
    if (drill) {
      summary.drills.push(drill);
      continue;
    }
    await page.waitForTimeout(100);
  }
  throw new Error('Session did not complete within the step budget');
}

export const SAMPLE_CSV = `traditional,pinyin,definition,domain,tags,example_sentence,foils
滷肉飯,lǔ ròu fàn,Braised pork rice,food,night-market|staple,台灣的滷肉飯每一家做法都不太一樣。,魯|鱸
火鍋料,huo3 guo1 liao4,Hot pot ingredients,food,hot-pot,冬天吃火鍋料最過癮。,火渦料
牧者,mù zhě,Shepherd / pastor (formal),church,roles,牧者要照顧羊群。,枚者
牧者,mù zhě,duplicate row,church,,,
`;

export function leechBackup(now: Date) {
  return JSON.stringify({
    version: '1.0',
    exportedAt: now.toISOString(),
    deckName: 'leech fixture',
    cards: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        traditional: '藉口',
        pinyin: 'jiè kǒu',
        definition: 'Excuse',
        domain: 'slang',
        tags: ['colloquial'],
        exampleSentenceTraditional: '他每次遲到都有一堆藉口。',
        visualFoils: ['籍口', '耤口'],
        fsrs: {
          due: new Date(now.getTime() - 3_600_000).toISOString(),
          stability: 2.5,
          difficulty: 8.1,
          elapsed_days: 1,
          scheduled_days: 2,
          reps: 9,
          lapses: 4,
          state: 2,
          last_review: new Date(now.getTime() - 86_400_000).toISOString(),
        },
      },
    ],
  });
}
