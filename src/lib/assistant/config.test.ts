import {
  DEFAULT_PREFS,
  forgetPairing,
  isSecureEndpoint,
  loadConfig,
  loadConversationId,
  parsePairingHash,
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

describe('pairing links', () => {
  const link = (payload: object) =>
    `#pair=${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_')}`;

  it('reads an endpoint and token out of the fragment', () => {
    const parsed = parsePairingHash(link({ u: 'wss://agent.example', t: 'tok' }));
    expect(parsed).toEqual({ endpoint: 'wss://agent.example', token: 'tok' });
  });

  it('ignores anything that is not a pairing link', () => {
    expect(parsePairingHash('')).toBeNull();
    expect(parsePairingHash('#settings')).toBeNull();
    expect(parsePairingHash('#pair=not-base64!!')).toBeNull();
    expect(parsePairingHash(link({ u: 'wss://agent.example' }))).toBeNull();
  });
});
