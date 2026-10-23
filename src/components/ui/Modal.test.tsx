import { render, screen } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('labels the dialog by its own title', () => {
    render(
      <Modal open title="Hello" testId="greeting">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByTestId('greeting');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)?.textContent).toBe('Hello');
  });

  it('gives dialogs without a testId distinct title ids', () => {
    render(
      <>
        <Modal open title="First">
          <p>one</p>
        </Modal>
        <Modal open title="Second">
          <p>two</p>
        </Modal>
      </>,
    );
    const [first, second] = screen.getAllByRole('heading', { level: 2, hidden: true });
    expect(first.id).not.toBe(second.id);
    expect(document.getElementById(first.id)?.textContent).toBe('First');
    expect(document.getElementById(second.id)?.textContent).toBe('Second');
  });

  it('renders nothing inside while closed', () => {
    render(
      <Modal open={false} title="Hidden" testId="closed">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByText('body')).toBeNull();
  });
});
