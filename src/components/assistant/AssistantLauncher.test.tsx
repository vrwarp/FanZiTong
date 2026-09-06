import { render, screen } from '@testing-library/react';
import {
  AssistantContext,
  NO_ASSISTANT,
  type AssistantApi,
} from '@/lib/assistant/assistantContext';
import { initialState } from '@/lib/assistant/store';
import { AssistantLauncher } from './AssistantLauncher';

function renderLauncher(api: Partial<AssistantApi>) {
  return render(
    <AssistantContext.Provider value={{ ...NO_ASSISTANT, ...api }}>
      <AssistantLauncher />
    </AssistantContext.Provider>,
  );
}

describe('AssistantLauncher', () => {
  it('stays out of the way when no assistant is set up', () => {
    renderLauncher({ available: false });
    expect(screen.queryByTestId('assistant-launcher')).not.toBeInTheDocument();
  });

  it('appears once an assistant is available', () => {
    renderLauncher({ available: true, state: { ...initialState, connection: 'connected' } });
    expect(screen.getByTestId('assistant-launcher')).toBeInTheDocument();
  });

  it('is a real button, so the study screen’s tap-to-reveal ignores it', () => {
    renderLauncher({ available: true, state: { ...initialState, connection: 'connected' } });
    expect(screen.getByTestId('assistant-launcher').tagName).toBe('BUTTON');
  });

  it('shows nothing but an icon: no card text can leak through it', () => {
    renderLauncher({ available: true, state: { ...initialState, connection: 'connected' } });
    const launcher = screen.getByTestId('assistant-launcher');
    expect(launcher.textContent?.trim()).toBe('✨');
  });
});
