import { beforeAll, describe, expect, it } from 'vitest';
import {
  breakdown,
  describeBreakdown,
  hanziyuanUrl,
  loadEtymologyTable,
  resetEtymologyTableForTests,
  soundFamily,
} from './index';

// The table is a lazily loaded chunk; every assertion below is about what it
// says, not about when it arrives.
beforeAll(() => loadEtymologyTable());

describe('breakdown', () => {
  it('splits a phono-semantic character into the half that means and the half that sounds', () => {
    const b = breakdown('滷');
    expect(b).not.toBeNull();
    expect(b!.ids).toBe('⿰氵鹵');
    expect(b!.meaning?.char).toBe('氵');
    expect(b!.meaning?.gloss).toMatch(/water/);
    expect(b!.meaning?.full).toBe('水');
    expect(b!.sound?.char).toBe('鹵');
    expect(b!.sound?.match).toBe('exact');
  });

  it('names where each part sits for a plain two-part layout', () => {
    expect(breakdown('滷')!.parts.map((p) => p.position)).toEqual(['on the left', 'on the right']);
    expect(breakdown('燙')!.parts.map((p) => p.position)).toEqual(['on top', 'underneath']);
  });

  it('leaves position unsaid when the layout is nested', () => {
    // 靈 is ⿳雨⿲口口口巫: no two-part name describes where anything sits.
    expect(breakdown('靈')!.parts.every((p) => p.position === undefined)).toBe(true);
  });

  it('reads the sound component off the readings, not off the source table', () => {
    // The upstream data files 麵 as semantic 面 / phonetic 麥, which is backwards.
    // 麥 is mài and 面 is miàn, so only one of them can be lending the reading.
    const b = breakdown('麵');
    expect(b!.sound?.char).toBe('面');
    expect(b!.meaning?.char).toBe('麥');
    expect(b!.meaning?.gloss).toMatch(/wheat/);
  });

  it('claims no sound component when no part predicts the reading', () => {
    // 魯 lǔ is 魚 yú over 日 rì. Neither is the reading, and the popular
    // "a fish that talks" story is a mnemonic, not a derivation.
    const b = breakdown('魯');
    expect(b!.sound).toBeUndefined();
    expect(b!.meaning?.char).toBe('魚');
  });

  it('grades a partial match rather than overstating it', () => {
    // 飯 fàn from 反 fǎn: same syllable, different tone.
    expect(breakdown('飯')!.sound).toMatchObject({ char: '反', match: 'tone' });
  });

  it('does not mistake a rhyming stroke for a sound component', () => {
    // 七 qī really is ⿻一乚 and 一 really is yī. It is still a coincidence.
    expect(breakdown('七')?.sound).toBeUndefined();
  });

  it('does not let the meaning component claim the reading on a rhyme alone', () => {
    // 嘔 ǒu is ⿰口區: 口 kǒu rhymes, but it is 區 that carried the sound.
    expect(breakdown('嘔')?.sound).toBeUndefined();
  });

  it('says nothing about characters that only decompose into bare strokes', () => {
    // 肉 "is" ⿻冂仌, which is true of the shape and useless to a reader.
    expect(breakdown('肉')).toBeNull();
  });

  it('returns null for a character it has never heard of', () => {
    expect(breakdown('x')).toBeNull();
    expect(breakdown('')).toBeNull();
  });
});

describe('describeBreakdown', () => {
  it('reads as a sentence when both halves are known', () => {
    expect(describeBreakdown(breakdown('滷')!)).toBe(
      '滷 is 氵 (water) on the left, 鹵 lǔ on the right gives the reading.',
    );
  });

  it('qualifies the claim when the reading only half matches', () => {
    expect(describeBreakdown(breakdown('飯')!)).toContain('same syllable, different tone');
  });

  it('drops the sound clause entirely when nothing lends a reading', () => {
    const line = describeBreakdown(breakdown('魯')!);
    expect(line).toContain('魚');
    expect(line).not.toContain('reading');
  });
});

describe('soundFamily', () => {
  it('gathers the deck characters built on the same sound component', () => {
    const deck = [...'清情請晴鯖滷飯青肉'];
    expect(soundFamily('清', deck)).toEqual(['情', '晴', '請', '鯖']);
  });

  it('is empty when the character has no sound component to share', () => {
    expect(soundFamily('魯', [...'魚日魯鱸'])).toEqual([]);
  });

  it('never includes the character itself, even given duplicates', () => {
    expect(soundFamily('清', [...'清清情'])).toEqual(['情']);
  });
});

describe('before the table has loaded', () => {
  it('reports nothing rather than guessing, and recovers once it lands', async () => {
    resetEtymologyTableForTests();
    expect(breakdown('滷')).toBeNull();
    await loadEtymologyTable();
    expect(breakdown('滷')).not.toBeNull();
  });
});

describe('hanziyuanUrl', () => {
  it('percent-encodes the character into the site’s hash route', () => {
    expect(hanziyuanUrl('滷')).toBe('https://hanziyuan.net/#%E6%BB%B7');
  });
});
