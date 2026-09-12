import { render, screen } from '@testing-library/react';
import { characterKnowledge, describeElsewhere } from '@/lib/stats/characters';
import { makeCard, makeLog } from '@/test/factories';
import { CharacterChips } from './CharacterChips';

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
