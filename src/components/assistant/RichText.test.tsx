import { render, screen } from '@testing-library/react';
import { RichText } from './RichText';

describe('RichText', () => {
  it('gives Chinese runs the Taiwan glyph treatment', () => {
    const { container } = render(<RichText text="I added 珍珠奶茶 for you." />);
    const hanzi = container.querySelector('.hanzi');
    expect(hanzi?.textContent).toContain('珍珠奶茶');
    expect(hanzi?.getAttribute('lang')).toBe('zh-Hant-TW');
  });

  it('renders bullets as a list', () => {
    render(<RichText text={'- 滷肉飯\n- 牛肉麵'} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps paragraphs apart', () => {
    const { container } = render(<RichText text={'First line.\n\nSecond line.'} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('handles bold and inline code without leaving the markers behind', () => {
    const { container } = render(<RichText text="Use **this** not `that`." />);
    expect(container.querySelector('strong')?.textContent).toBe('this');
    expect(container.querySelector('code')?.textContent).toBe('that');
    expect(container.textContent).not.toContain('**');
  });
});
