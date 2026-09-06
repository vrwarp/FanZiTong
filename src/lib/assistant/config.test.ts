import {
  DEFAULT_PREFS,
  forgetPairing,
  isSecureEndpoint,
  loadConfig,
  loadConversationId,
  savePrefs,
  saveConversationId,
  saveEndpoint,
} from './config';

beforeEach(() => localStorage.clear());

describe('endpoint safety', () => {
  it('accepts an encrypted endpoint', () => {
    expect(isSecureEndpoint('wss://agent.example.ts.net')).toBe(true);
  });

  it('allows plain ws only on this machine', () => {
    expect(isSecureEndpoint('ws://localhost:8787')).toBe(true);
    expect(isSecureEndpoint('ws://127.0.0.1:8787')).toBe(true);
    // The deployed app is https, so anything else is blocked as mixed content
    // by the browser anyway; refusing it here explains why.
    expect(isSecureEndpoint('ws://192.168.1.10:8787')).toBe(false);
    expect(isSecureEndpoint('https://agent.example')).toBe(false);
    expect(isSecureEndpoint('')).toBe(false);
    expect(isSecureEndpoint('not a url')).toBe(false);
  });
});

describe('stored pairing', () => {
  it('round-trips the endpoint and token', () => {
    saveEndpoint('wss://agent.example', 'secret-token');
    const config = loadConfig();
    expect(config.endpoint).toBe('wss://agent.example');
    expect(config.token).toBe('secret-token');
  });

  it('keeps the token out of the deck backup by living in localStorage', () => {
    saveEndpoint('wss://agent.example', 'secret-token');
    expect(localStorage.getItem('fzt-assistant-token')).toBe('secret-token');
  });

  it('forgets everything, conversation included', () => {
    saveEndpoint('wss://agent.example', 'secret-token');
    saveConversationId('conv-1');
    forgetPairing();
    expect(loadConfig().endpoint).toBe('');
    expect(loadConversationId()).toBeNull();
  });

  it('falls back to defaults when the stored preferences are damaged', () => {
    localStorage.setItem('fzt-assistant-prefs', '{not json');
    expect(loadConfig().prefs).toEqual(DEFAULT_PREFS);
  });

  it('ignores a profile name it does not recognise', () => {
    savePrefs({ ...DEFAULT_PREFS, profile: 'turbo' as never });
    expect(loadConfig().prefs.profile).toBe(DEFAULT_PREFS.profile);
  });
});
