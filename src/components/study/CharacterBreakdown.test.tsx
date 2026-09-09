import { render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadEtymologyTable } from '@/lib/etymology';
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
  });

  it('omits the family line when the deck has no relatives yet', async () => {
    render(<CharacterBreakdown char="清" deckChars={[...'滷飯']} />);
    await screen.findByTestId('character-breakdown');
    expect(screen.queryByTestId('sound-family')).toBeNull();
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
