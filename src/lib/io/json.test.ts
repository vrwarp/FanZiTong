import { DEFAULT_SETTINGS } from '@/types';
import { makeCard, makeLog } from '@/test/factories';
import { parseJsonDeck, serializeJsonDeck, toJsonDeck } from './json';

const PRD_JSON = `{
  "version": "1.0",
  "exportedAt": "2026-09-05T08:00:00.000Z",
  "deckName": "Taiwanese Heritage Vocabulary",
  "cards": [
    {
      "id": "c7a8b3d4-1e2f-4a5b-9c8d-7e6f5a4b3c2d",
      "traditional": "滷肉飯",
      "pinyin": "lǔ ròu fàn",
      "definition": "Braised pork rice (Taiwanese staple)",
      "domain": "food",
      "tags": ["staple", "night-market"],
      "exampleSentenceTraditional": "台灣的滷肉飯每一家做法都不太一樣。",
      "exampleSentencePinyin": "Táiwān de lǔròufàn měi yī jiā zuòfǎ dōu bù tài yīyàng.",
      "exampleSentenceTranslation": "Every shop in Taiwan prepares braised pork rice a bit differently.",
      "visualFoils": ["魯", "鱸"],
      "fsrs": {
        "due": "2026-09-08T12:00:00.000Z",
        "stability": 4.2,
        "difficulty": 3.1,
        "elapsed_days": 3,
        "scheduled_days": 4,
        "reps": 4,
        "lapses": 0,
        "state": 2,
        "last_review": "2026-09-05T07:30:00.000Z"
      }
    }
  ]
}`;

describe('parseJsonDeck', () => {
  it('parses the PRD §7.1 sample including FSRS state', () => {
    const deck = parseJsonDeck(PRD_JSON);
    expect(deck.issues).toEqual([]);
    expect(deck.deckName).toBe('Taiwanese Heritage Vocabulary');
    expect(deck.rows).toHaveLength(1);
    const row = deck.rows[0];
    expect(row.id).toBe('c7a8b3d4-1e2f-4a5b-9c8d-7e6f5a4b3c2d');
    expect(row.traditional).toBe('滷肉飯');
    expect(row.visualFoils).toEqual(['魯', '鱸']);
    expect(row.fsrs).toMatchObject({ state: 2, reps: 4, stability: 4.2 });
    expect(row.exampleSentenceTranslation).toMatch(/braised pork rice/);
  });

  it('accepts a bare array of minimal cards and normalizes fields', () => {
    const deck = parseJsonDeck(
      '[{"traditional":"火鍋","pinyin":"huo3 guo1","domain":"飲食","tags":"a|b"}]',
    );
    expect(deck.issues).toEqual([]);
    expect(deck.rows[0]).toMatchObject({
      traditional: '火鍋',
      pinyin: 'huǒ guō',
      domain: 'food',
      tags: ['a', 'b'],
      visualFoils: [],
    });
    expect(deck.rows[0].warnings).toContain('No definition provided.');
  });

  it('skips invalid cards but keeps the rest', () => {
    const deck = parseJsonDeck(
      '{"cards":[{"pinyin":"x"},{"traditional":"火鍋","fsrs":{"state":9}},{"traditional":"豆漿"}]}',
    );
    expect(deck.rows.map((r) => r.traditional)).toEqual(['豆漿']);
    expect(deck.issues).toHaveLength(2);
    expect(deck.issues[0].row).toBe(1);
  });

  it('reports malformed JSON and unrecognized shapes without throwing', () => {
    expect(parseJsonDeck('{nope').issues[0].message).toMatch(/Not valid JSON/);
    expect(parseJsonDeck('{"foo":1}').issues[0].message).toMatch(/Unrecognized deck format/);
    expect(parseJsonDeck('{"foo":1}').rows).toEqual([]);
  });

  it('carries review logs and settings from a full backup', () => {
    const card = makeCard();
    const log = makeLog({ cardId: card.id });
    const deck = toJsonDeck([card], {
      deckName: 'backup',
      reviewLogs: [log],
      settings: { ...DEFAULT_SETTINGS, targetRetention: 0.85 },
      now: new Date('2026-09-05T08:00:00.000Z'),
    });
    expect(deck.version).toBe('1.0');
    expect(deck.exportedAt).toBe('2026-09-05T08:00:00.000Z');
    const parsed = parseJsonDeck(serializeJsonDeck(deck));
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0].fsrs).toEqual(card.fsrs);
    expect(parsed.reviewLogs).toEqual([log]);
    expect(parsed.settings?.targetRetention).toBe(0.85);
  });

  it('round-trips every Traditional character byte-for-byte', () => {
    const card = makeCard({ traditional: '蚵仔煎', definition: '「蚵仔煎」— 夜市名物' });
    const text = serializeJsonDeck(toJsonDeck([card]));
    const parsed = parseJsonDeck(text);
    expect(parsed.rows[0].traditional).toBe('蚵仔煎');
    expect(parsed.rows[0].definition).toBe('「蚵仔煎」— 夜市名物');
  });
});
