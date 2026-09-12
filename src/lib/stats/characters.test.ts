import { makeCard, makeLog } from '@/test/factories';
import {
  characterElsewhere,
  characterKnowledge,
  firstSightProfile,
  summarizeCharacters,
} from './characters';

const day = (d: number, hour = 10) => new Date(2026, 8, d, hour, 0).toISOString();

describe('characterKnowledge', () => {
  const luRouFan = makeCard({ traditional: '滷肉飯', domain: 'food' });
  const luWei = makeCard({ traditional: '滷味', domain: 'food' });
  const niuRouMian = makeCard({ traditional: '牛肉麵', domain: 'food' });
  const yiMian = makeCard({ traditional: '意麵', domain: 'food' });
  const huoGuo = makeCard({ traditional: '火鍋', domain: 'food' });
  const tuanQi = makeCard({ traditional: '團契', domain: 'church' });
  const cards = [luRouFan, luWei, niuRouMian, yiMian, huoGuo, tuanQi];
  const logs = [
    // Read on sight: the word is known, so every character counts as read in it.
    makeLog({ cardId: luRouFan.id, rating: 4, reviewTimestamp: day(5) }),
    // Failed on sight, failed again the next day.
    makeLog({ cardId: luWei.id, rating: 1, reviewTimestamp: day(5) }),
    makeLog({ cardId: luWei.id, rating: 1, reviewTimestamp: day(6) }),
    makeLog({ cardId: niuRouMian.id, rating: 3, reviewTimestamp: day(5) }),
    // Failed on sight; the same-day looks are the screen; the next-day pass is real.
    makeLog({ cardId: yiMian.id, rating: 1, reviewTimestamp: day(5) }),
    makeLog({ cardId: yiMian.id, rating: 3, reviewTimestamp: day(5, 10) }),
    makeLog({ cardId: yiMian.id, rating: 3, reviewTimestamp: day(5, 11) }),
    makeLog({ cardId: yiMian.id, rating: 3, reviewTimestamp: day(6) }),
    // Failed on sight, then only ever passed the same day (and once in a drill).
    makeLog({ cardId: huoGuo.id, rating: 1, reviewTimestamp: day(5) }),
    makeLog({ cardId: huoGuo.id, rating: 3, reviewTimestamp: day(5, 11) }),
    makeLog({
      cardId: huoGuo.id,
      rating: 3,
      exerciseType: 'foil_discrimination',
      reviewTimestamp: day(6),
    }),
    // Hard on sight says nothing either way.
    makeLog({ cardId: tuanQi.id, rating: 2, reviewTimestamp: day(5) }),
  ];
  const knowledge = characterKnowledge(cards, logs);

  it('records, per character, the words it was read in and failed in', () => {
    expect(knowledge.get('滷')).toEqual({
      char: '滷',
      words: ['滷肉飯', '滷味'],
      readIn: ['滷肉飯'],
      failedIn: ['滷味'],
    });
    expect(knowledge.get('味')).toMatchObject({ readIn: [], failedIn: ['滷味'] });
    expect(knowledge.get('麵')).toMatchObject({ readIn: ['牛肉麵', '意麵'], failedIn: ['意麵'] });
    expect(knowledge.get('意')).toMatchObject({ readIn: ['意麵'] });
    // The same-day passes and the drill were not real tests.
    expect(knowledge.get('火')).toMatchObject({ readIn: [], failedIn: ['火鍋'] });
    expect(knowledge.get('團')).toMatchObject({ readIn: [], failedIn: [] });
    expect(knowledge.size).toBe(11);
  });

  it('tells a word which of its characters the learner has met elsewhere', () => {
    expect(characterElsewhere(knowledge, '滷', '滷味')).toEqual({
      readIn: ['滷肉飯'],
      failedIn: [],
    });
    expect(characterElsewhere(knowledge, '味', '滷味')).toEqual({ readIn: [], failedIn: [] });
    expect(characterElsewhere(knowledge, '麵', '意麵')).toEqual({
      readIn: ['牛肉麵'],
      failedIn: [],
    });
    // A character failed elsewhere and never read there.
    expect(characterElsewhere(knowledge, '滷', '滷肉飯')).toEqual({
      readIn: [],
      failedIn: ['滷味'],
    });
    expect(characterElsewhere(knowledge, '龍', '滷味')).toEqual({ readIn: [], failedIn: [] });
  });

  it('summarizes what has been read and what has not, most-failed first', () => {
    const summary = summarizeCharacters(knowledge);
    expect(summary).toMatchObject({ met: 11, read: 6, notYet: 5 });
    expect(summary.notYetChars.map((f) => f.char)).toEqual(['味', '火', '鍋', '團', '契']);
  });

  it('ignores cards never studied', () => {
    expect(characterKnowledge([makeCard({ traditional: '蛋餅' })], []).size).toBe(0);
  });
});

describe('firstSightProfile', () => {
  it('tallies the first rating each domain got, and what was read on sight', () => {
    const cards = [
      makeCard({ traditional: '滷肉飯', domain: 'food' }),
      makeCard({ traditional: '滷味', domain: 'food' }),
      makeCard({ traditional: '米粉', domain: 'food' }),
      makeCard({ traditional: '團契', domain: 'church' }),
      makeCard({ traditional: '禱告', domain: 'church' }),
    ];
    const logs = [
      makeLog({ cardId: cards[0].id, rating: 4, reviewTimestamp: day(5) }),
      makeLog({ cardId: cards[0].id, rating: 1, reviewTimestamp: day(6) }),
      makeLog({ cardId: cards[1].id, rating: 1, reviewTimestamp: day(5) }),
      makeLog({ cardId: cards[2].id, rating: 2, reviewTimestamp: day(5) }),
      makeLog({ cardId: cards[3].id, rating: 3, reviewTimestamp: day(5) }),
    ];
    const profile = firstSightProfile(cards, logs);
    expect(profile.find((d) => d.domain === 'food')).toEqual({
      domain: 'food',
      met: 3,
      ratings: { 1: 1, 2: 1, 3: 0, 4: 1 },
      onSight: 1,
    });
    expect(profile.find((d) => d.domain === 'church')).toMatchObject({ met: 1, onSight: 1 });
    expect(profile.find((d) => d.domain === 'anime')).toMatchObject({ met: 0, onSight: 0 });
  });
});
