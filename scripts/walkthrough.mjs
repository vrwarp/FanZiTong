/**
 * Scripted visual walkthrough of the main user journeys, captured on a Pixel 7
 * viewport against a running build (default http://localhost:4173).
 *
 *   node scripts/walkthrough.mjs <output-dir>
 *
 * Used for design reviews: every screenshot is a state a real learner sees.
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';

const base = process.env.WALKTHROUGH_URL ?? 'http://localhost:4173';
const out = resolve(process.argv[2] ?? 'walkthrough');
await mkdir(out, { recursive: true });

const CSV = `traditional,pinyin,definition,domain,tags,example_sentence,foils
滷肉飯,lǔ ròu fàn,Braised pork rice,food,night-market|staple,台灣的滷肉飯每一家做法都不太一樣。,魯|鱸
火鍋料,huo3 guo1 liao4,Hot pot ingredients,food,hot-pot,冬天吃火鍋料最過癮。,火渦料
牧者,mù zhě,Shepherd / pastor (formal),church,roles,牧者要照顧羊群。,枚者
牧者,mù zhě,duplicate row,church,,,
`;

const now = new Date();
const LEECH_BACKUP = JSON.stringify({
  version: '1.0',
  exportedAt: now.toISOString(),
  deckName: 'walkthrough fixture',
  cards: [
    {
      traditional: '蚵仔煎',
      pinyin: 'kē zǎi jiān',
      spoken: 'ô-á-tsian',
      definition: 'Oyster omelette',
      domain: 'food',
      tags: ['night-market'],
      exampleSentenceTraditional: '夜市的蚵仔煎要淋很多甜辣醬才好吃。',
      exampleSentencePinyin: 'Yèshì de kēzǎijiān yào lín hěn duō tiánlàjiàng cái hǎochī.',
      exampleSentenceTranslation:
        'Night-market oyster omelette only tastes right drenched in sweet chili sauce.',
      visualFoils: ['蚵仔炸', '蜆仔煎', '蚵仔剪'],
      fsrs: {
        due: new Date(now.getTime() - 7_200_000).toISOString(),
        stability: 12,
        difficulty: 5.2,
        elapsed_days: 10,
        scheduled_days: 12,
        reps: 6,
        lapses: 0,
        state: 2,
        last_review: new Date(now.getTime() - 10 * 86_400_000).toISOString(),
      },
    },
    {
      traditional: '藉口',
      pinyin: 'jiè kǒu',
      definition: 'Excuse, pretext',
      domain: 'slang',
      tags: ['colloquial'],
      exampleSentenceTraditional: '他每次遲到都有一堆藉口。',
      visualFoils: ['籍口', '耤口', '蓆口'],
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

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['Pixel 7'],
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: 'Asia/Taipei',
});
const page = await context.newPage();
const taken = [];

async function shot(name, { fullPage = false } = {}) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(out, `${name}.png`), fullPage });
  taken.push(name);
  console.log(`📸 ${name}`);
}

async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`⚠️  step "${name}" failed: ${err.message}`);
  }
}

/** Solve whichever drill is on screen the way a careful learner would. */
async function solveDrill() {
  if (await tid('cloze-exercise').isVisible()) {
    await page.locator('[data-testid="cloze-option"][data-correct="true"]').first().click();
  } else if (await tid('foil-exercise').isVisible()) {
    await page.locator('[data-testid="foil-option"][data-correct="true"]').first().click();
  } else if (await tid('menu-exercise').isVisible()) {
    const keys = ((await tid('menu-exercise').getAttribute('data-target-keys')) ?? '').split(',');
    for (const key of keys.filter(Boolean)) {
      await page.locator(`[data-testid="menu-checkbox"][data-key="${key}"]`).check();
    }
    await tid('menu-submit').click();
  } else {
    return false;
  }
  await tid('drill-continue').click();
  return true;
}

const tid = (id) => page.getByTestId(id);

// 1. First launch
await page.goto(base);
await tid('start-session').waitFor();
await shot('01-learn-first-launch');

// 2-6. Daily session: prompt → reveal → rate; first card Again so a drill appears after 5 cards
await step('session', async () => {
  await tid('start-session').click();
  await tid('recognition-prompt').waitFor();
  await shot('02-study-prompt-hidden');
  await page.waitForTimeout(1800); // read the word the way a person would
  await tid('recognition-prompt').click();
  await tid('pinyin').waitFor();
  await shot('03-study-revealed');
  // The character layer: a tapped chip lists its other words and underlines it in the sentence;
  // a tapped sentence word shows only its own reading.
  await tid('character-chip').nth(1).click();
  await tid('sentence-word').first().click();
  await page.waitForTimeout(200);
  await shot('03b-study-revealed-chip-and-word');
  await tid('rate-1').click();
  let drills = 0;
  for (let i = 0; i < 12 && drills < 1; i += 1) {
    if (await tid('recognition-prompt').isVisible()) {
      await tid('recognition-prompt').click();
      await tid('pinyin').waitFor();
      await tid('rate-4').click();
      continue;
    }
    for (const kind of ['cloze', 'foil', 'menu']) {
      const el = tid(`${kind}-exercise`);
      if (await el.isVisible()) {
        drills += 1;
        await shot(`04-study-drill-${kind}`);
        break;
      }
    }
    if (drills) break;
  }
  // Pause mid-session: the summary, then the dashboard that must remember it.
  await tid('study-finish').click();
  await tid('session-summary').waitFor();
  await shot('05-session-paused');
  await page.goto(base);
  await tid('start-session').waitFor();
  await shot('06-learn-resume');
  // Resume and finish the whole session: the completed summary and the done dashboard.
  await tid('start-session').click();
  for (let i = 0; i < 60; i += 1) {
    if (await tid('session-summary').isVisible()) break;
    if (await tid('recognition-prompt').isVisible()) {
      await page.waitForTimeout(700); // read it like a person would
      await tid('recognition-prompt').click();
      await tid('pinyin').waitFor();
      await page.waitForTimeout(400);
      await tid('rate-3').click();
      continue;
    }
    if (!(await solveDrill())) await page.waitForTimeout(200);
  }
  await tid('session-summary').waitFor();
  await shot('07-session-complete');
  await tid('summary-done').click();
  await tid('start-session').waitFor();
  await shot('08-learn-after-session');
});

// 9. Drills tab
await page.goto(`${base}/drills`);
await tid('start-drill-cloze').waitFor();
await shot('09-drills-tab');

// 10-11. Menu realia: one dish missed, one wrong tick, then the graded slip
await step('menu drill', async () => {
  await page.goto(`${base}/drills/realia_menu?count=3`);
  await tid('menu-exercise').waitFor();
  await shot('10-drill-menu-slip', { fullPage: true });
  const keys = ((await tid('menu-exercise').getAttribute('data-target-keys')) ?? '').split(',');
  for (const key of keys.slice(0, keys.length - 1)) {
    await page.locator(`[data-testid="menu-checkbox"][data-key="${key}"]`).check();
  }
  await page.locator('[data-testid="menu-checkbox"]').last().check();
  await tid('menu-submit').click();
  await tid('drill-continue').waitFor();
  await page.waitForTimeout(600); // let the slip scroll the first flagged row into view
  await shot('11-drill-menu-result', { fullPage: true });
});
await step('menu drill, wrong size', async () => {
  // Only rice and noodle dishes come in sizes: reload until one is ordered.
  let keys = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.goto(`${base}/drills/realia_menu?count=3`);
    await tid('menu-exercise').waitFor();
    keys = ((await tid('menu-exercise').getAttribute('data-target-keys')) ?? '').split(',');
    if (keys.some((k) => k.includes(':'))) break;
  }
  const sized = keys.find((k) => k.includes(':'));
  for (const key of keys) {
    const other = key === sized ? key.replace(/:小$/, ':大').replace(/:大$/, ':小') : key;
    await page.locator(`[data-testid="menu-checkbox"][data-key="${other}"]`).check();
  }
  await tid('menu-submit').click();
  await tid('drill-continue').waitFor();
  await page.waitForTimeout(600);
  await shot('11b-drill-menu-wrong-size', { fullPage: true });
});

// 12-14. Foil discrimination: wrong pick, the contrast, the corrective retry
await step('foil drill', async () => {
  await page.goto(`${base}/drills/foil_discrimination?count=5`);
  await tid('foil-exercise').waitFor();
  await shot('12-drill-foil');
  await page.locator('[data-testid="foil-option"][data-correct="false"]').first().click();
  await shot('13-drill-foil-wrong');
  await tid('foil-retry').click();
  await tid('foil-retry-hint').waitFor();
  await shot('14-drill-foil-retry');
});

// 15-17. Cloze: prompt, a misread deck word, then the right answer
await step('cloze drill', async () => {
  await page.goto(`${base}/drills/cloze?count=5&domain=church`);
  await tid('cloze-exercise').waitFor();
  await shot('15-drill-cloze');
  const misread = page.locator(
    '[data-testid="cloze-option"][data-correct="false"][data-foil="false"]',
  );
  if ((await misread.count()) > 0) {
    await misread.first().click();
    await tid('cloze-misread').waitFor();
    await shot('16-drill-cloze-misread');
  }
  await page.locator('[data-testid="cloze-option"][data-correct="true"]').first().click();
  await shot('17-drill-cloze-correct');
});

// 18-20. Vocab list, editor, import preview
await page.goto(`${base}/vocab`);
await tid('vocab-item').first().waitFor();
await shot('18-vocab-list');
await step('editor', async () => {
  await tid('vocab-item').first().click();
  await tid('card-editor').waitFor();
  await shot('19-card-editor', { fullPage: true });
});
await step('import', async () => {
  await page.goto(`${base}/vocab`);
  await tid('import-file').setInputFiles({
    name: 'deck.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV, 'utf8'),
  });
  await tid('import-dialog').waitFor();
  await shot('20-import-preview');
  await page.keyboard.press('Escape');
});

// 21. Stats (after the session above + a restored leech)
await step('stats', async () => {
  await page.goto(`${base}/settings`);
  await tid('backup-file').setInputFiles({
    name: 'leech.json',
    mimeType: 'application/json',
    buffer: Buffer.from(LEECH_BACKUP, 'utf8'),
  });
  await tid('import-dialog').waitFor();
  await tid('import-overwrite').check();
  await tid('import-confirm').click();
  await tid('settings-notice').waitFor();
  await page.goto(`${base}/stats`);
  await tid('stat-cards').waitFor();
  await shot('21-stats', { fullPage: true });
});
await step('leech foil drill', async () => {
  await page.goto(`${base}/stats`);
  await tid('leech-practice').first().click();
  await tid('foil-exercise').waitFor();
  await shot('21c-drill-foil-leech');
});
await step('spoken reveal', async () => {
  await page.goto(`${base}/study`);
  await tid('recognition-prompt').waitFor();
  await tid('recognition-prompt').click();
  await tid('spoken').waitFor();
  await shot('21b-study-revealed-spoken');
  await tid('rate-3').click();
});

// 22. Settings
await page.goto(`${base}/settings`);
await tid('settings-page').waitFor();
await shot('22-settings', { fullPage: true });

// 23-24. Dark mode
await step('dark', async () => {
  await tid('theme-dark').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await page.waitForTimeout(600); // let the IndexedDB write land before navigating
  await shot('22b-settings-dark-selected');
  await page.goto(base);
  await tid('start-session').waitFor();
  await shot('23-learn-dark');
  await page.goto(`${base}/study`);
  await tid('recognition-prompt').waitFor();
  await tid('recognition-prompt').click();
  await tid('pinyin').waitFor();
  await shot('24-study-revealed-dark');
});

await browser.close();
console.log(`\n${taken.length} screenshots in ${out}`);
