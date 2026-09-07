# Where the deck's words come from

The starter deck is meant to be Taiwanese, not generically Chinese. That is a
sourcing problem before it is an authoring one: a general Chinese word list will
happily hand you 意粉, 油炸鬼 and 地三鮮, none of which anybody orders in Taipei.

So candidate words are proposed by one kind of source and judged by another.

## The three signals

**Candidates — Wiktionary and Wikipedia categories.** `zh.wiktionary.org`
categories like `漢語 食物`, `漢語俚語` and `臺灣話`, plus Wikipedia's Taiwan
food lists. Both are CC BY-SA. These are pan-Chinese, so they propose and never
decide. A headword is a fact rather than a creative work; the definitions and
sentences in this deck are written for it, not lifted.

**Attestation — PTT.** [PTT](https://www.ptt.cc) is the Taiwanese forum the way
Reddit is the American one, and a word people post is a word worth learning. The
harvest keeps the thread count and nothing else: the posts belong to the people
who wrote them, and none of their text reaches the deck.

This is the filter that makes the deck Taiwanese rather than Chinese. Measured
on the first few hundred food candidates, it rejects about half, and the
rejections are the right ones — 丹貝 (tempeh), 意粉 (Cantonese for spaghetti),
地三鮮 (a northeastern dish), 公仔麵 (Hong Kong instant noodles) all return zero
threads, while 滷肉飯, 母湯 and 爆雷 return a full page.

It is a blunt instrument in one direction: a word can be Taiwanese and still
score zero because people spell it differently online (剉冰 is usually typed
刨冰). Zero hits therefore means "not proven", and words rejected this way are
worth a second look by hand rather than a permanent no.

**Readings — the Ministry of Education, through [moedict](https://www.moedict.tw).**
The only source here that gives _Taiwan_ readings rather than PRC ones — 垃圾 is
lèsè, not lājī — and Tâi-lô for the words that are really Taiwanese
(蚵仔煎 → ô-á-tsian). MOE's own reading of its CC BY-ND licence is that the
restriction covers the dictionary text, not format conversion or downstream use;
this deck takes readings, which are facts, and writes its own definitions.

## The forum sweep

Reddit was asked for and is not usable, so the question became which Taiwanese
forums are. Every one of these was checked, including its `robots.txt`:

| Site                              | Result                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| **PTT** `ptt.cc`                  | ✅ server-rendered, per-board search — the attestation signal |
| **巴哈姆特** `forum.gamer.com.tw` | ✅ 16,667 哈啦板, server-rendered titles — the ACG source     |
| 信望愛 `bible.fhl.net`            | reachable, robots fine; search endpoint not found yet         |
| 基督教論壇報 `ct.org.tw`          | reachable; robots is all comments, no directives either way   |
| pttweb.cc, 卡提諾 `ck101`         | reachable but rendered client-side                            |
| **愛料理** `icook.tw`             | ❌ robots.txt names ClaudeBot and refuses it                  |
| Mobile01, Dcard                   | ❌ 403                                                        |
| Komica                            | ❌ unreachable                                                |

Two of those are worth spelling out. **愛料理** would have been an excellent
food source — it is Taiwan's recipe site — and its `robots.txt` disallows
`ClaudeBot` and `Claude-SearchBot` by name. That is a refusal in the same class
as Reddit's and it is respected.

**巴哈姆特** is the find. Its own `robots.txt` disallows only `Bo.php` and
`embed.php` and advertises a sitemap listing every board, and `B.php` returns
real HTML rather than a JavaScript shell, so board pages give about thirty
thread titles each without a browser. Only 場外休憩區 sits behind the 兒少保護
age gate, which the harvest skips rather than works around. For the anime domain
this is what PTT's C_Chat is, several times over.

## Reddit

Not usable, though it was asked for. `reddit.com` refuses Anthropic's crawler,
and both search and fetch are declined at that level. Routing around a stated
refusal with a plain HTTP client would be helping myself to something the owner
declined to give, so the harvest does not.

PTT is the better source for this deck in any case: it is where the Taiwanese
internet register in these four domains actually lives, and C_Chat is a closer
match for the anime deck than any English-language subreddit.

## What each domain can actually support

Not every domain has a thousand attested words in it, and the harvest says so
rather than padding quietly. Run `node scripts/harvest/harvest.mjs report` for
current numbers.

As of the September 2026 pass:

| domain | candidates | attested | thinly (1–2 threads) | MOE reading | Tâi-lô |
| ------ | ---------- | -------- | -------------------- | ----------- | ------ |
| food   | 1780       | **1250** | 393                  | 595         | 243    |
| slang  | 2896       | **1140** | 23                   | 567         | 268    |
| church | 1029       | 689      | 175                  | 488         | 131    |
| anime  | 687        | 400      | 82                   | 247         | 122    |

Food and slang have the supply for a thousand cards each. Church is 311 short
and **anime is 600 short** — Wiktionary has almost no ACG vocabulary (`漢語 動畫`
has four members), so that domain leans on Japanese loanwords and on mining
C_Chat for the words posters type, and 400 is close to the honest ceiling for
genuinely ACG-specific vocabulary. Reaching a thousand there means widening into
gaming and general entertainment; cards resting on thin attestation are marked
so they can be pruned later.

Only about half the attested words have an MOE reading, because compounds like
炒飯 and 義大利麵 are not dictionary headwords. The rest have their reading
composed per character and flagged for review rather than guessed silently.

## Running it

```bash
node scripts/harvest/harvest.mjs candidates   # categories -> candidates.json
node scripts/harvest/harvest.mjs cchat        # C_Chat mining for ACG terms
node scripts/harvest/harvest.mjs attest       # PTT thread counts, cached
node scripts/harvest/harvest.mjs readings     # MOE readings for the survivors
node scripts/harvest/harvest.mjs report       # yield per domain
```

Every stage caches under `scripts/harvest/out/`, so a re-run costs nothing and
nobody's server is asked the same question twice. PTT is rate-limited to one
request every 400 ms; it is run by a university club, not a CDN.
