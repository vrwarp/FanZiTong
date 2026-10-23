import { act, fireEvent, render, screen } from '@testing-library/react';
import { InstallPrompt } from './InstallPrompt';

function offerInstall(prompt: () => Promise<void>) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
}

describe('InstallPrompt', () => {
  beforeEach(() => localStorage.clear());

  it('stays hidden until the browser offers an install', () => {
    render(<InstallPrompt />);
    expect(screen.queryByTestId('install-prompt')).toBeNull();
  });

  it('drops a spent install event after the dialog is dismissed', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    render(<InstallPrompt />);
    offerInstall(prompt);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('install-prompt')).toBeNull();
  });

  it('survives prompt() rejecting because the event was already used', async () => {
    const prompt = vi.fn().mockRejectedValue(new Error('already used'));
    render(<InstallPrompt />);
    offerInstall(prompt);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(screen.queryByTestId('install-prompt')).toBeNull();
  });
});
