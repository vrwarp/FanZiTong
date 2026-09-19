import { render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadEtymologyTable } from '@/lib/etymology';
import { characterKnowledge } from '@/lib/stats/characters';
import { makeCard, makeLog } from '@/test/factories';
import { CharacterBreakdown } from './CharacterBreakdown';
import { CharacterContrast } from './CharacterContrast';

// The components load the composition chunk on mount, so every assertion waits
// for it; the two "renders nothing" cases wait for it too, then check again.
beforeAll(() => loadEtymologyTable());

describe('CharacterBreakdown', () => {
  it('shows the meaning part and the sound part of a compound character', async () => {
    render(<CharacterBreakdown char="滷" />);
    const panel = await screen.findByTestId('character-breakdown');
    expect(panel).toHaveTextContent('氵');
    expect(panel).toHaveTextContent('water');
    expect(panel).toHaveTextContent('鹵');
    expect(panel).toHaveTextContent('gives the reading');
  });

  it('renders nothing for a character with no useful breakdown', async () => {
    const { container } = render(<CharacterBreakdown char="肉" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('warns when the sound component only half predicts the reading', async () => {
    render(<CharacterBreakdown char="飯" />);
    expect(await screen.findByTestId('character-breakdown')).toHaveTextContent(
      /same syllable, different tone/,
    );
  });

  it('says nothing about the reading when no part supplies it', async () => {
    render(<CharacterBreakdown char="魯" />);
    expect(await screen.findByTestId('character-breakdown')).not.toHaveTextContent(
      'gives the reading',
    );
  });

  it('links out to 字源 for the ancient forms rather than inventing an origin', async () => {
    render(<CharacterBreakdown char="滷" />);
    const link = await screen.findByTestId('hanziyuan-link');
    expect(link).toHaveAttribute('href', 'https://hanziyuan.net/#%E6%BB%B7');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('drops the link where the caller has no room for it', async () => {
    render(<CharacterBreakdown char="滷" showSource={false} />);
    await screen.findByTestId('character-breakdown');
    expect(screen.queryByTestId('hanziyuan-link')).toBeNull();
  });

  it('lists deck characters sharing the same sound part', async () => {
    render(<CharacterBreakdown char="清" deckChars={[...'情請晴滷']} />);
    expect(await screen.findByTestId('sound-family')).toHaveTextContent('情');
    expect(screen.getByTestId('sound-family')).toHaveTextContent('請');
    expect(screen.getByTestId('sound-family')).not.toHaveTextContent('滷');
    // Nothing is known about the learner, so every member is one not yet met.
    for (const m of screen.getAllByTestId('family-member')) {
      expect(m).toHaveAttribute('data-status', 'unseen');
    }
  });

  it('says the family is empty when the deck has no relatives yet', async () => {
    render(<CharacterBreakdown char="清" deckChars={[...'滷飯']} />);
    await screen.findByTestId('character-breakdown');
    expect(screen.getByTestId('sound-family')).toHaveTextContent('no other deck word yet');
    expect(screen.queryAllByTestId('family-member')).toHaveLength(0);
  });
});

describe('CharacterContrast', () => {
  it('names the component that separates two confusable characters', async () => {
    render(<CharacterContrast picked="販" correct="飯" />);
    const line = await screen.findByTestId('foil-contrast');
    expect(line).toHaveTextContent('飯 has 飠 (food)');
    expect(line).toHaveTextContent('販 has 貝 (money)');
    // 反 is shared, so it is not offered as a difference.
    expect(line).not.toHaveTextContent('反');
  });

  it('renders nothing when the pair does not break down into nameable parts', async () => {
    const { container } = render(<CharacterContrast picked="己" correct="已" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('CharacterBreakdown — every part has a reading and a meaning', () => {
  it('names the sound part’s own reading and meaning, not only its role', async () => {
    render(<CharacterBreakdown char="認" />);
    const panel = await screen.findByTestId('character-breakdown');
    const sound = screen
      .getAllByTestId('breakdown-part')
      .find((el) => el.dataset.role === 'sound')!;
    expect(sound).toHaveTextContent('忍');
    expect(sound).toHaveTextContent('rěn');
    expect(sound).toHaveTextContent('to endure');
    expect(sound).toHaveTextContent('gives the reading');
    expect(panel).toHaveTextContent('yán');
  });

  it('glosses a part that carries neither role from the dictionary', async () => {
    render(<CharacterBreakdown char="潛" />);
    await screen.findByTestId('character-breakdown');
    const plain = screen.getAllByTestId('breakdown-part').find((el) => el.dataset.role === 'part')!;
    expect(plain).toHaveTextContent('朁');
    expect(plain).toHaveTextContent('cǎn');
    expect(plain).toHaveTextContent('if, supposing');
  });
});

describe('CharacterBreakdown — the sound family in the learner’s own words', () => {
  const pool = [
    makeCard({ traditional: '清湯', pinyin: 'qīng tāng', definition: 'Clear broth' }),
    makeCard({ traditional: '心情', pinyin: 'xīn qíng', definition: 'Mood' }),
    makeCard({ traditional: '請問', pinyin: 'qǐng wèn', definition: 'Excuse me' }),
    makeCard({ traditional: '眼睛', pinyin: 'yǎn jīng', definition: 'Eyes' }),
    makeCard({ traditional: '青菜', pinyin: 'qīng cài', definition: 'Greens' }),
  ];
  const deckChars = pool.flatMap((c) => [...c.traditional]);

  it('puts the characters met first, each with the word they were met in', async () => {
    const logs = [
      makeLog({ cardId: pool[1].id, rating: 3, reviewTimestamp: '2026-09-10T08:00:00.000Z' }),
      makeLog({ cardId: pool[2].id, rating: 1, reviewTimestamp: '2026-09-10T08:00:00.000Z' }),
    ];
    const knowledge = characterKnowledge(pool, logs);
    render(
      <CharacterBreakdown char="清" deckChars={deckChars} pool={pool} knowledge={knowledge} />,
    );
    const family = await screen.findByTestId('sound-family');
    expect(family).toHaveTextContent('Same sound part 青');
    expect(family).toHaveTextContent('qīng');
    const members = screen.getAllByTestId('family-member');
    expect(members.map((m) => m.textContent?.[0])).toEqual(['情', '請', '睛', '青']);
    expect(members[0]).toHaveAttribute('data-status', 'read');
    expect(members[0]).toHaveTextContent('心情');
    expect(members[1]).toHaveAttribute('data-status', 'missed');
    expect(members[1]).toHaveTextContent('請問');
    expect(members[2]).toHaveAttribute('data-status', 'unseen');
    expect(members[2]).toHaveTextContent('眼睛');
    // The sound part itself is a deck character: 青 as in 青菜.
    expect(members[3]).toHaveTextContent('青菜');
  });

  it('says so when no other deck word shares the sound part', async () => {
    render(<CharacterBreakdown char="滷" deckChars={[...'滷肉飯']} pool={[]} />);
    expect(await screen.findByTestId('sound-family')).toHaveTextContent('no other deck word yet');
    expect(screen.queryAllByTestId('family-member')).toHaveLength(0);
  });
});
