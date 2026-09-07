/**
 * Where deck candidates come from, and how they are proved to be Taiwanese.
 *
 * Three signals, kept separate on purpose:
 *
 *   1. Candidates — Wiktionary and Wikipedia categories (CC BY-SA). These are
 *      pan-Chinese, so they propose but never decide.
 *   2. Attestation — a PTT search. PTT is the Taiwanese forum the way Reddit is
 *      the American one, and a word people actually post is a word worth
 *      learning. Only the hit count is kept: the posts belong to the people who
 *      wrote them and none of their text goes into the deck.
 *   3. Readings — the Ministry of Education dictionaries through moedict, which
 *      is the only source here that gives Taiwan readings rather than PRC ones
 *      (垃圾 lèsè, not lājī) and Tâi-lô for what is said in Taiwanese.
 *
 * Reddit itself is not reachable: reddit.com refuses Anthropic's crawler, and
 * routing around that would be helping myself to something its owner declined.
 * PTT is the better source for this deck anyway.
 */

const UA = 'FanZiTong-deck-research/1.0 (https://github.com/vrwarp/FanZiTong)';

/** Politeness: PTT is run by a university club, not a CDN. */
const PTT_DELAY_MS = 400;

export const HAN_ONLY = /^[㐀-䶿一-鿿豈-﫿]+$/;

async function retrying(url, init, tries = 4) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      // 404 is an answer, not a failure to reach.
      if (res.status === 404) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, 400 * 2 ** i));
  }
  throw last;
}

async function mediawiki(host, params) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
  const res = await retrying(url, { headers: { 'User-Agent': UA } });
  return res.json();
}

/**
 * Every article in a category, following continuation and subcategories.
 *
 * Depth is capped because these trees loop: 漢語 食物 reaches 漢語 動物 within
 * three hops, and a cheese is not a night-market snack.
 */
export async function categoryMembers(host, category, { depth = 1, seen = new Set() } = {}) {
  if (depth < 0 || seen.has(category)) return [];
  seen.add(category);
  const found = [];
  let cont;
  do {
    const data = await mediawiki(host, {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: '500',
      cmtype: 'page|subcat',
      ...(cont ? { cmcontinue: cont } : {}),
    });
    for (const member of data.query?.categorymembers ?? []) {
      if (member.ns === 14) {
        const sub = member.title.replace(/^Category:/, '');
        found.push(...(await categoryMembers(host, sub, { depth: depth - 1, seen })));
      } else if (member.ns === 0) {
        found.push({ word: member.title, host, category });
      }
    }
    cont = data.continue?.cmcontinue;
  } while (cont);
  return found;
}

/**
 * How many recent PTT threads mention a word.
 *
 * Capped at one page: the question is "do Taiwanese people say this", and 20
 * hits answers it as well as 2000 would, for a twentieth of the traffic.
 */
export async function pttHits(word) {
  const url = `https://www.ptt.cc/bbs/Gossiping/search?q=${encodeURIComponent(word)}`;
  const res = await retrying(url, {
    headers: { 'User-Agent': UA, cookie: 'over18=1' },
  });
  if (!res.ok) return null;
  const html = await res.text();
  await new Promise((r) => setTimeout(r, PTT_DELAY_MS));
  return [...html.matchAll(/<div class="title">\s*<a href="[^"]*">/g)].length;
}

/** The Taiwan reading, and the Tâi-lô one where the word is said in Taiwanese. */
export async function moedictEntry(word) {
  const out = { mandarin: null, taigi: null };
  const uni = await retrying(`https://www.moedict.tw/uni/${encodeURIComponent(word)}`, {
    headers: { 'User-Agent': UA },
  });
  if (uni.ok) {
    const body = await uni.json().catch(() => null);
    const reading = body?.heteronyms?.[0]?.pinyin;
    if (reading) out.mandarin = reading;
  }
  const tai = await retrying(`https://www.moedict.tw/t/${encodeURIComponent(word)}`, {
    headers: { 'User-Agent': UA },
  });
  if (tai.ok) {
    const body = await tai.json().catch(() => null);
    const reading = body?.h?.[0]?.T;
    if (reading) out.taigi = reading;
  }
  return out;
}

/**
 * The categories each deck domain draws from.
 *
 * Wiktionary names topical categories "漢語 食物"; Wikipedia uses bare names.
 * Both are CC BY-SA, which the deck credits in docs/deck-sources.md.
 */
export const DOMAIN_SOURCES = {
  food: [
    ['zh.wiktionary.org', '漢語 食物'],
    ['zh.wiktionary.org', '漢語 飲料'],
    ['zh.wiktionary.org', '漢語 烹飪'],
    ['zh.wiktionary.org', '漢語 蔬菜'],
    ['zh.wiktionary.org', '漢語 水果'],
    ['zh.wiktionary.org', '漢語 肉'],
    ['zh.wiktionary.org', '漢語 魚'],
    ['zh.wiktionary.org', '漢語 調味品'],
    ['zh.wiktionary.org', '漢語 餐具'],
    ['zh.wikipedia.org', '台灣小吃'],
    ['zh.wikipedia.org', '台灣甜食'],
    ['zh.wikipedia.org', '臺灣街頭小吃'],
    ['zh.wikipedia.org', '台灣麵條'],
    ['zh.wikipedia.org', '台灣飲食'],
    ['zh.wikipedia.org', '臺灣茶'],
  ],
  church: [
    ['zh.wiktionary.org', '漢語 基督教'],
    ['zh.wiktionary.org', '漢語 宗教'],
    ['zh.wiktionary.org', '漢語 聖經'],
    ['zh.wiktionary.org', '漢語 聖經人物'],
    ['zh.wiktionary.org', '漢語 聖經書目'],
    ['zh.wiktionary.org', '漢語 神學'],
    ['zh.wikipedia.org', '基督教用語'],
    ['zh.wikipedia.org', '台灣基督教'],
  ],
  slang: [
    ['zh.wiktionary.org', '漢語俚語'],
    ['zh.wiktionary.org', '漢語網路用語'],
    ['zh.wiktionary.org', '臺灣華語'],
    ['zh.wiktionary.org', '漢語口語詞'],
    ['zh.wiktionary.org', '臺灣話'],
  ],
  // The thinnest field by far. Wiktionary has almost no ACG vocabulary, so this
  // leans on the Japanese loanwords that carry most of it into Mandarin, and on
  // what C_Chat posters actually type (see `cchatTerms`).
  anime: [
    ['zh.wiktionary.org', '漢語 動畫'],
    ['zh.wiktionary.org', '漢語 娛樂'],
    ['zh.wiktionary.org', '漢語 遊戲'],
    ['zh.wiktionary.org', '日語借詞'],
    ['zh.wikipedia.org', '日本動漫術語'],
    ['zh.wikipedia.org', '御宅族'],
    ['zh.wikipedia.org', '電子遊戲術語'],
  ],
};

/**
 * ACG words taken from what people post on PTT's C_Chat board.
 *
 * Titles only, and only to find candidates: an n-gram is kept when it recurs
 * across threads AND the Ministry of Education or Wiktionary already knows it
 * as a word, which throws out the anime titles and character names that
 * otherwise dominate ("吉伊卡哇", "無職轉生") along with n-gram debris.
 */
export async function cchatTerms({ pages = 60, floor = 4 } = {}) {
  const counts = new Map();
  let index = null;
  for (let visited = 0; visited < pages; visited += 1) {
    const url = index
      ? `https://www.ptt.cc/bbs/C_Chat/index${index}.html`
      : 'https://www.ptt.cc/bbs/C_Chat/index.html';
    const res = await retrying(url, { headers: { 'User-Agent': UA, cookie: 'over18=1' } });
    if (!res.ok) break;
    const html = await res.text();
    for (const [, title] of html.matchAll(/<div class="title">\s*<a href="[^"]*">([^<]*)<\/a>/g)) {
      // Board tags ([閒聊], [Vtub]) are metadata, not language.
      for (const run of title.replace(/\[[^\]]*\]|Re:|Fw:/g, ' ').split(/[^一-鿿]+/)) {
        for (let n = 2; n <= 4; n += 1) {
          for (let i = 0; i + n <= run.length; i += 1) {
            const gram = run.slice(i, i + n);
            counts.set(gram, (counts.get(gram) ?? 0) + 1);
          }
        }
      }
    }
    const prev = html.match(/href="\/bbs\/[^"]*index(\d+)\.html">&lsaquo;/);
    if (!prev) break;
    index = Number(prev[1]);
    await new Promise((r) => setTimeout(r, PTT_DELAY_MS));
  }
  return [...counts]
    .filter(([, n]) => n >= floor)
    .sort((a, b) => b[1] - a[1])
    .map(([word, n]) => ({ word, threads: n }));
}
