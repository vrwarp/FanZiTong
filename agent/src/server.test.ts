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

  it('refuses a wrong pairing token', async () => {
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

  it('welcomes a client with the right token and opens a conversation', async () => {
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

describe('configuration', () => {
  it('insists on a token when it is not on loopback', () => {
    expect(() => loadConfig({ FZT_AGENT_HOST: '0.0.0.0' } as NodeJS.ProcessEnv)).toThrow(
      /FZT_AGENT_TOKEN/,
    );
  });

  it('allows a tokenless sidecar on loopback for development', () => {
    expect(loadConfig({ FZT_AGENT_HOST: '127.0.0.1' } as NodeJS.ProcessEnv).token).toBeNull();
  });
});
