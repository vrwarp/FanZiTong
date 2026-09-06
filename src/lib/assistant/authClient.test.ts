import { httpBase, normalizeCode } from './authClient';

describe('httpBase', () => {
  it('turns the socket address into the address its endpoints live at', () => {
    expect(httpBase('wss://agent.example.com')).toBe('https://agent.example.com');
    expect(httpBase('ws://localhost:8787')).toBe('http://localhost:8787');
  });

  it('keeps a path prefix, for a sidecar behind a shared domain', () => {
    expect(httpBase('wss://home.example.com/agent')).toBe('https://home.example.com/agent');
  });

  it('drops anything that would not belong in an endpoint address', () => {
    expect(httpBase('wss://agent.example.com/x?a=1#frag')).toBe('https://agent.example.com/x');
  });
});

describe('normalizeCode', () => {
  it('takes the code on its own', () => {
    expect(normalizeCode('  abc123#state  ')).toBe('abc123#state');
  });

  it('takes the whole URL, because that is what people copy', () => {
    expect(
      normalizeCode('https://platform.claude.com/oauth/code/callback?code=abc123&state=xyz'),
    ).toBe('abc123');
  });
});
