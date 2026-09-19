import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadEtymologyTable } from '@/lib/etymology';
import { characterKnowledge, describeElsewhere } from '@/lib/stats/characters';
import { makeCard, makeLog } from '@/test/factories';
import { CharacterChips } from './CharacterChips';

// Readings and glosses arrive with the dictionary chunk; load it once.
beforeAll(() => loadEtymologyTable());

const day = (d: number) => new Date(2026, 8, d, 10, 0).toISOString();

describe('CharacterChips — what the learner has read each character in', () => {
  const luRouFan = makeCard({ traditional: '滷肉飯', pinyin: 'lǔ ròu fàn' });
  const luWei = makeCard({ traditional: '滷味', pinyin: 'lǔ wèi' });
  const niuRouMian = makeCard({ traditional: '牛肉麵', pinyin: 'niú ròu miàn' });
  const pool = [luRouFan, luWei, niuRouMian];
  const knowledge = characterKnowledge(pool, [
    makeLog({ cardId: luRouFan.id, rating: 4, reviewTimestamp: day(5) }),
    makeLog({ cardId: niuRouMian.id, rating: 3, reviewTimestamp: day(5) }),
    makeLog({ cardId: luWei.id, rating: 1, reviewTimestamp: day(6) }),
  ]);

  it('says "read in" for a character read in another word, and "new here" otherwise', () => {
    expect(describeElsewhere(knowledge, '滷', '滷味')).toEqual({
      text: 'read in',
      word: '滷肉飯',
      more: 0,
      tone: 'read',
    });
    expect(describeElsewhere(knowledge, '肉', '滷味')).toMatchObject({
      text: 'read in',
      more: 1,
      tone: 'read',
    });
    expect(describeElsewhere(knowledge, '味', '滷味')).toEqual({
      text: 'new here',
      more: 0,
      tone: 'new',
    });
    expect(describeElsewhere(knowledge, '滷', '滷肉飯')).toEqual({
      text: 'missed in',
      word: '滷味',
      more: 0,
      tone: 'missed',
    });
    expect(describeElsewhere(undefined, '滷', '滷味')).toBeNull();
  });

  it('renders the claim on each chip', () => {
    render(
      <CharacterChips
        card={luWei}
        pool={pool}
        knowledge={knowledge}
        selected={null}
        onSelect={() => undefined}
      />,
    );
    const claims = screen.getAllByTestId('character-elsewhere');
    expect(claims).toHaveLength(2);
    expect(claims[0]).toHaveTextContent('read in 滷肉飯');
    expect(claims[0]).toHaveAttribute('data-tone', 'read');
    expect(claims[1]).toHaveTextContent('new here');
    expect(claims[1]).toHaveAttribute('data-tone', 'new');
  });

  it('falls back to the word count when no knowledge is given', () => {
    render(<CharacterChips card={luWei} pool={pool} selected={null} onSelect={() => undefined} />);
    expect(screen.queryByTestId('character-elsewhere')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('character-chip')[0]).toHaveTextContent('1 more word');
  });
});

describe('CharacterChips — every character has a reading and a meaning', () => {
  const qianShui = makeCard({
    traditional: '潛水',
    pinyin: 'qián shuǐ',
    definition: 'To lurk in a group without posting',
    domain: 'slang',
  });

  it('glosses each chip from the dictionary, with the word’s own syllable', () => {
    render(
      <CharacterChips card={qianShui} pool={[qianShui]} selected={null} onSelect={() => {}} />,
    );
    const chips = screen.getAllByTestId('character-chip');
    expect(chips[0]).toHaveTextContent('潛');
    expect(chips[0]).toHaveTextContent('qián');
    expect(chips[0]).toHaveTextContent('to hide');
    expect(chips[1]).toHaveTextContent('shuǐ');
    expect(chips[1]).toHaveTextContent('water');
    expect(screen.getAllByTestId('character-gloss')).toHaveLength(2);
  });

  it('opens the character with its reading and full meaning', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <CharacterChips card={qianShui} pool={[qianShui]} selected={null} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getAllByTestId('character-chip')[0]);
    expect(onSelect).toHaveBeenCalledWith('潛');
    rerender(
      <CharacterChips card={qianShui} pool={[qianShui]} selected="潛" onSelect={onSelect} />,
    );
    expect(screen.getByTestId('character-also-in')).toHaveTextContent(
      '潛 qián “to hide; secret, latent, hidden” · no other deck word yet',
    );
  });
});
