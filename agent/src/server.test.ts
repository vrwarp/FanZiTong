import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { loadConfig } from './config';
import { startServer } from './server';

/** Talk to a real socket on an ephemeral port; nothing spawns Claude Code. */
function connect(port: number, origin?: string): WebSocket {
  return new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {});
}

function boot(env: Record<string, string>) {
  const config = loadConfig({
    FZT_AGENT_PORT: '0',
    FZT_LOG_LEVEL: 'error',
    ...env,
  } as NodeJS.ProcessEnv);
  const server = startServer(config);
  return new Promise<{ port: number; stop: () => Promise<void> }>((resolve) => {
    server.http.once('listening', () => {
      const port = (server.http.address() as AddressInfo).port;
      resolve({
        port,
        stop: async () => {
          await server.registry.closeAll('test over');
          server.wss.close();
          await new Promise<void>((done) => server.http.close(() => done()));
        },
      });
    });
  });
}

describe('the sidecar socket', () => {
  it('refuses an origin that is not on the allowlist', async () => {
    const { port, stop } = await boot({ FZT_ALLOWED_ORIGINS: 'https://good.example' });
    const ws = connect(port, 'https://evil.example');
    const error = await new Promise<Error>((resolve) => ws.on('error', resolve));
    expect(error.message).toMatch(/403/);
    await stop();
  });

  it('refuses a socket that presents no session', async () => {
    const { port, stop } = await boot({
      FZT_AGENT_HOST: '0.0.0.0',
      FZT_ALLOWED_ORIGINS: 'https://good.example',
    });
    const ws = connect(port, 'https://good.example');
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ type: 'hello', protocolVersion: 1, token: 'made-up', app: {} }));
    const code = await new Promise<number>((resolve) => ws.on('close', resolve));
    expect(code).toBe(4401);
    await stop();
  });

  it('refuses a wrong fixed token', async () => {
    const { port, stop } = await boot({
      FZT_AGENT_HOST: '0.0.0.0',
      FZT_AGENT_TOKEN: 'the-real-token',
      FZT_ALLOWED_ORIGINS: 'https://good.example',
    });
    const ws = connect(port, 'https://good.example');
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ type: 'hello', protocolVersion: 1, token: 'guess', app: {} }));
    const code = await new Promise<number>((resolve) => ws.on('close', resolve));
    expect(code).toBe(4401);
    await stop();
  });

  it('welcomes a client with the right fixed token and opens a conversation', async () => {
    const { port, stop } = await boot({
      FZT_AGENT_HOST: '0.0.0.0',
      FZT_AGENT_TOKEN: 'the-real-token',
      FZT_ALLOWED_ORIGINS: 'https://good.example',
    });
    const ws = connect(port, 'https://good.example');
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(
      JSON.stringify({ type: 'hello', protocolVersion: 1, token: 'the-real-token', app: {} }),
    );
    const welcome = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
    });
    expect(welcome.type).toBe('welcome');
    expect(welcome.conversationId).toEqual(expect.any(String));
    ws.close();
    await stop();
  });

  it('drops a client that never introduces itself', async () => {
    vi.useRealTimers();
    const { port, stop } = await boot({ FZT_ALLOWED_ORIGINS: 'https://good.example' });
    const ws = connect(port, 'https://good.example');
    await new Promise((resolve) => ws.on('open', resolve));
    const code = await new Promise<number>((resolve) => ws.on('close', resolve));
    expect(code).toBe(4401);
    await stop();
  }, 10_000);

  it('answers a health check', async () => {
    const { port, stop } = await boot({});
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    await expect(res.json()).resolves.toMatchObject({ ok: true });
    await stop();
  });
});

describe('anonymous access', () => {
  it('is refused on anything but loopback, whatever the operator asks for', () => {
    // Binding to loopback behind a reverse proxy makes every internet client
    // look local, so this cannot be inferred from the connection.
    expect(() =>
      loadConfig({
        FZT_AGENT_HOST: '0.0.0.0',
        FZT_ALLOW_ANONYMOUS: 'true',
      } as NodeJS.ProcessEnv),
    ).toThrow(/loopback/);
  });

  it('opens the socket with no credential when it is asked for on loopback', async () => {
    const { port, stop } = await boot({
      FZT_ALLOW_ANONYMOUS: 'true',
      FZT_ALLOWED_ORIGINS: 'https://good.example',
    });
    const ws = connect(port, 'https://good.example');
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ type: 'hello', protocolVersion: 1, token: '', app: {} }));
    const welcome = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
    });
    expect(welcome.type).toBe('welcome');
    ws.close();
    await stop();
  });

  it('is off by default, so a local socket still needs a credential', async () => {
    const { port, stop } = await boot({ FZT_ALLOWED_ORIGINS: 'https://good.example' });
    const ws = connect(port, 'https://good.example');
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ type: 'hello', protocolVersion: 1, token: '', app: {} }));
    const code = await new Promise<number>((resolve) => ws.on('close', resolve));
    expect(code).toBe(4401);
    await stop();
  });
});

describe('configuration', () => {
  it('needs no token on a public address: the Claude sign-in is the credential', () => {
    const config = loadConfig({ FZT_AGENT_HOST: '0.0.0.0' } as NodeJS.ProcessEnv);
    expect(config.token).toBeNull();
  });

  it('insists on a token when the operator supplies the Claude credential', () => {
    // Nobody signs in through the app in that setup, so there is no sign-in to
    // establish who the assistant belongs to.
    expect(() =>
      loadConfig({
        FZT_AGENT_HOST: '0.0.0.0',
        CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat-example',
      } as NodeJS.ProcessEnv),
    ).toThrow(/FZT_AGENT_TOKEN/);
  });

  it('leaves loopback alone, credential or not', () => {
    const config = loadConfig({
      FZT_AGENT_HOST: '127.0.0.1',
      CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat-example',
    } as NodeJS.ProcessEnv);
    expect(config.token).toBeNull();
  });

  it('keeps its state beside the Claude credentials by default', () => {
    const config = loadConfig({ CLAUDE_CONFIG_DIR: '/data/claude' } as NodeJS.ProcessEnv);
    expect(config.stateDir).toBe('/data/claude/fanzitong');
  });
});
