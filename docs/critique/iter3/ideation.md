# iter3 ideation — reconciliation of the round-3 verification critiques

Scores: PM 8 (converged: yes, after a same-day patch) · LE 8 (converged for mechanics; remaining gap = data integrity) · HL 8 (converged: no, narrowly — a data pass). Nobody reopened a design; every finding is data, copy or a counter. No conflicts to resolve: the three lists overlap almost item for item.

## Patch set (round 4)
1. Slip realism — venue first: a 便當店 template (便當類 with 排骨便當／雞腿便當／焢肉便當 neighbours) and 便當 categorised there; targets grouped by the shop that sells them before a slip is built (in-session companions too); ≤ 14 rows; prices from a per-dish table (便當 90, 珍珠奶茶 55, 鮮奶茶 60, 豆漿／米漿 25). Test: every target has a same-section neighbour; every slip fits one shop.
2. Foil integrity: no foil may render as its headword — 藉囗 → 蓆口; test: NFC-equal or 口／囗-only difference fails.
3. One romanisation and meaning-only definitions: Tâi-lô everywhere (test: no `spoken` contains "ch"); definitions swept of parentheticals; a `notes` field (CSV/JSON/editor, 💡 after the reveal) carrying the sound-spelling notes (母湯＝毋通, 歸剛＝規工, 阿雜, 盤子, 蛤, 魯蛇, 吃土, 暈船, 爆雷).
4. One remaining count: summary and resume card both count cards only; "≈ N min" on the resume card.
5. Copy: "Done for today 今天先這樣"; "Back to Learn 回首頁" on the complete screen; "In review 複習中 — no change"; Drills tab "Read a real sentence and pick the word that fits." / "a hit only speeds up words not yet in review"; mastery "started · solid · not started"; the Stats gauge empty-state caption; editor "Reviews / forgotten (after learning)"; "PROGRESS" kicker; "Reviews · 1 done today" when nothing was due; summary "Answers" with "N cards · M drill items".
6. Standalone drills: a missed item comes back once before the end, announced in the header; Questions = slips for the Order Slip.
7. Leech row: reading behind a tap, definition wraps.
8. Walkthrough: count 5, paced first reveal, tapped chip + sentence word, leech foil drill, wrong-size slip, Dark selected, Tâi-lô reveal.

## Exit
Round 4 is a verification of statements 2, 3 and 5 only (2: the count; 3: neighbour + 便當 + 份量 + ô-á-tsian; 5: definitions + romanisation + notes). If they pass with no new major and no score below 8, the loop is converged.
