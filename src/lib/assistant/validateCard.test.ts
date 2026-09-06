import { buildStarterDeck } from '@/data/starterDeck';
import { makeCard } from '@/test/factories';
import type { VocabCard } from '@/types';
import { buildDeckIndex, validateCard, validateCardDraft } from './validateCard';
import type { CardDraft } from './tools';

const emptyDeck = buildDeckIndex([]);

function check(overrides: Partial<VocabCard>, deck: VocabCard[] = []) {
  const card = makeCard(overrides);
  return validateCard(card, { deck: buildDeckIndex(deck) });
}

function rules(issues: { rule: string }[]): string[] {
  return issues.map((i) => i.rule);
}

describe('validateCard', () => {
  it('accepts every card in the shipped starter deck', () => {
    const deck = buildStarterDeck();
    const index = buildDeckIndex(deck);
    const failures = deck
      .map((card) => ({ card, report: validateCard(card, { deck: index }) }))
      .filter(({ report }) => report.errors.length > 0)
      .map(
        ({ card, report }) =>
          `${card.traditional}: ${report.errors.map((e) => e.message).join(' ')}`,
      );
    expect(failures).toEqual([]);
  });

  it('accepts a well-formed card', () => {
    expect(check({}).errors).toEqual([]);
  });

  it('rejects simplified characters anywhere they can appear', () => {
    expect(rules(check({ traditional: '团契', pinyin: 'tuán qì' }).errors)).toContain(
      'traditional',
    );
    expect(
      rules(
        check({
          exampleSentenceTraditional: '我要一碗滷肉饭。',
          exampleSentencePinyin: 'Wǒ yào yī wǎn lǔròufàn.',
        }).errors,
      ),
    ).toContain('traditional');
    // Foils are exempt: the deck ships simplified glyphs as deliberate foils.
    expect(rules(check({ visualFoils: ['鲁肉飯'] }).errors)).not.toContain('traditional');
  });

  it('leaves characters that are valid in both scripts alone', () => {
    const report = check({
      traditional: '後台',
      pinyin: 'hòu tái',
      definition: 'Backstage',
      exampleSentenceTraditional: '他在後台等。',
      exampleSentencePinyin: 'Tā zài hòutái děng.',
      exampleSentenceTranslation: 'He waits backstage.',
      visualFoils: ['后台'],
    });
    expect(rules(report.errors)).not.toContain('traditional');
  });

  it('requires tone-marked pinyin with one syllable per character', () => {
    expect(rules(check({ pinyin: 'lu rou fan' }).errors)).toContain('pinyin');
    expect(rules(check({ pinyin: 'lǔròufàn' }).errors)).toContain('pinyin');
    expect(rules(check({ pinyin: '' }).errors)).toContain('pinyin');
  });

  it('keeps definitions short and free of readings', () => {
    expect(rules(check({ definition: 'x' }).errors)).toContain('definition');
    expect(rules(check({ definition: 'Braised pork rice (lǔ ròu fàn)' }).errors)).toContain(
      'definition',
    );
    expect(rules(check({ definition: 'A'.repeat(61) }).errors)).toContain('definition');
  });

  it('requires the sentence to contain the word, with an aligned reading', () => {
    expect(rules(check({ exampleSentenceTraditional: '我要一碗牛肉麵。' }).errors)).toContain(
      'sentence',
    );
    expect(rules(check({ exampleSentencePinyin: 'Wǒ yào.' }).errors)).toContain('sentence-pinyin');
    expect(rules(check({ exampleSentenceTranslation: undefined }).errors)).toContain('translation');
  });

  it('rejects a foil that is a real way of writing this word', () => {
    const report = check({ variants: ['魯肉飯'], visualFoils: ['魯肉飯'] });
    expect(rules(report.errors)).toContain('foils');
  });

  it('rejects a foil that is an accepted spelling of another card', () => {
    const other = makeCard({
      traditional: '鹹酥雞',
      pinyin: 'xián sū jī',
      variants: ['鹽酥雞'],
    });
    const report = check({ traditional: '鹽酥雞', pinyin: 'yán sū jī', visualFoils: ['鹽酥雞'] }, [
      other,
    ]);
    expect(rules(report.errors)).toContain('foils');
  });

  it('allows another deck word as a foil, the way the drill generator does', () => {
    const other = makeCard({ traditional: '滷肉麵', pinyin: 'lǔ ròu miàn' });
    const report = check({ visualFoils: ['滷肉麵'] }, [other]);
    expect(rules(report.errors)).not.toContain('foils');
  });

  it('rejects a foil of a different length and one that renders as the word', () => {
    expect(rules(check({ visualFoils: ['魯肉'] }).errors)).toContain('foils');
    expect(rules(check({ visualFoils: ['滷肉飯'] }).errors)).toContain('foils');
  });

  it('rejects a variant that is another card, and a duplicate headword', () => {
    const other = makeCard({ traditional: '牛肉麵', pinyin: 'niú ròu miàn' });
    expect(rules(check({ variants: ['牛肉麵'] }, [other]).errors)).toContain('variants');
    const same = makeCard({ traditional: '滷肉飯', pinyin: 'lǔ ròu fàn' });
    expect(rules(check({ id: 'other-id', traditional: '滷肉飯' }, [same]).errors)).toContain(
      'duplicate',
    );
  });

  it('rejects POJ in the spoken reading', () => {
    expect(rules(check({ spoken: 'ô-á-chian' }).errors)).toContain('spoken');
    expect(rules(check({ spoken: 'ô-á-tsian' }).errors)).not.toContain('spoken');
  });

  it('rejects a cloze distractor that is the answer or already in the sentence', () => {
    expect(rules(check({ clozeDistractors: ['滷肉飯'] }).errors)).toContain('cloze-distractors');
    expect(rules(check({ clozeDistractors: ['老闆'] }).errors)).toContain('cloze-distractors');
  });

  it('warns rather than rejects for thin content', () => {
    const noTags = check({ tags: [] });
    expect(noTags.errors).toEqual([]);
    expect(rules(noTags.warnings)).toContain('tags');
    const oneFoil = check({ visualFoils: ['魯'] });
    expect(oneFoil.errors).toEqual([]);
    expect(rules(oneFoil.warnings)).toContain('foils');
  });
});

describe('draft mode (a person typing a card)', () => {
  const draftReport = (overrides: Partial<VocabCard>) =>
    validateCard(makeCard(overrides), { deck: emptyDeck, mode: 'draft' });

  it('lets an unfinished card be saved', () => {
    const report = draftReport({
      pinyin: '',
      definition: '',
      exampleSentencePinyin: undefined,
      exampleSentenceTranslation: undefined,
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('still refuses what is actually wrong', () => {
    expect(rules(draftReport({ traditional: '团契', pinyin: 'tuán qì' }).errors)).toContain(
      'traditional',
    );
    expect(rules(draftReport({ visualFoils: ['滷肉飯'] }).errors)).toContain('foils');
    const existing = makeCard({ traditional: '滷肉飯' });
    const duplicate = validateCard(makeCard({ id: 'other', traditional: '滷肉飯' }), {
      deck: buildDeckIndex([existing]),
      mode: 'draft',
    });
    expect(rules(duplicate.errors)).toContain('duplicate');
  });

  it('names the deck the way the rest of the app does', () => {
    const existing = makeCard({ traditional: '滷肉飯' });
    const report = validateCard(makeCard({ id: 'other', traditional: '滷肉飯' }), {
      deck: buildDeckIndex([existing]),
    });
    expect(report.errors[0].message).toContain('already in your deck');
  });
});

describe('validateCardDraft', () => {
  const draft = (over: Partial<CardDraft> = {}): CardDraft => ({
    traditional: '珍珠奶茶',
    pinyin: 'zhen1 zhu1 nai3 cha2',
    definition: 'Bubble tea',
    domain: 'food',
    tags: ['drink'],
    ...over,
  });

  it('converts numbered pinyin and normalises a new card', () => {
    const report = validateCardDraft(draft(), { deck: emptyDeck });
    expect(report.errors).toEqual([]);
    expect(report.card.pinyin).toBe('zhēn zhū nǎi chá');
  });

  it('validates the merged card, not just the patch', () => {
    const existing = makeCard({});
    const report = validateCardDraft(
      { traditional: existing.traditional, exampleSentenceTraditional: '這家的牛肉麵好吃。' },
      { deck: buildDeckIndex([existing]), existing },
    );
    expect(rules(report.errors)).toContain('sentence');
  });

  it('clears a field with null and keeps FSRS state', () => {
    const existing = makeCard({ notes: 'old note' });
    const report = validateCardDraft(
      { traditional: existing.traditional, notes: null },
      { deck: buildDeckIndex([existing]), existing },
    );
    expect(report.card.notes).toBeUndefined();
    expect(report.card.fsrs).toEqual(existing.fsrs);
    expect(report.card.createdAt).toBe(existing.createdAt);
  });

  it('catches a duplicate inside one batch', () => {
    const report = validateCardDraft(draft(), {
      deck: emptyDeck,
      batchSpellings: new Set(['珍珠奶茶']),
    });
    expect(rules(report.errors)).toContain('duplicate');
  });
});

describe('definitions written in Chinese', () => {
  it('must be Traditional too', () => {
    const report = validateCard(makeCard({ definition: '凉茶饮料' }), { deck: emptyDeck });
    expect(rules(report.errors)).toContain('traditional');
  });

  it('accepts a Traditional one', () => {
    const report = validateCard(makeCard({ definition: '涼茶飲料' }), { deck: emptyDeck });
    expect(rules(report.errors)).not.toContain('traditional');
  });
});
