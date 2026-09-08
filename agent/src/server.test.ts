import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createLogger } from './log';
import { loadConfig } from './config';
import { ensureWorkspace, platformCandidates, startServer } from './server';

/** Talk to a real socket on an ephemeral port; nothing spawns Claude Code. */
function connect(port: number, origin?: string): WebSocket {
  return new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {});
}

function boot(env: Record<string, string>, overrides: Parameters<typeof startServer>[1] = {}) {
  const config = loadConfig({
    FZT_AGENT_PORT: '0',
    FZT_LOG_LEVEL: 'error',
    ...env,
  } as NodeJS.ProcessEnv);
  const server = startServer(config, overrides);
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

  // The handshake used to be sent from inside `probeAuth().then(...)`, and that
  // probe shells out to `claude auth status` with a fifteen-second timeout. The
  // app sat on "connecting" for as long as a cold process start took, and this
  // suite failed whenever that overran its own five seconds. A probe that never
  // answers is the honest way to state the rule: nothing waits on it.
  it('welcomes a client without waiting to hear whether it is signed in', async () => {
    const stuck = Object.assign(() => new Promise<never>(() => {}), {
      peek: () => 'unknown' as const,
    });
    const { port, stop } = await boot(
      {
        FZT_AGENT_HOST: '0.0.0.0',
        FZT_AGENT_TOKEN: 'the-real-token',
        FZT_ALLOWED_ORIGINS: 'https://good.example',
      },
      { probeAuth: stuck },
    );
    const ws = connect(port, 'https://good.example');
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(
      JSON.stringify({ type: 'hello', protocolVersion: 1, token: 'the-real-token', app: {} }),
    );
    const welcome = await new Promise<Record<string, unknown>>((resolve) => {
      ws.on('message', (raw) => resolve(JSON.parse(raw.toString())));
    });
    expect(welcome.type).toBe('welcome');
    // Not knowing yet is a fine answer. Waiting to find out is not.
    expect((welcome.sidecar as { authState: string }).authState).toBe('unknown');
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

/**
 * The bug this pins: the search was a fixed list starting with linux-x64, so an
 * arm64 machine with both packages installed got an x86-64 binary and the only
 * symptom was "exists but failed to launch" — after the learner had asked a
 * question and waited for the answer.
 */
describe('choosing the Claude Code binary', () => {
  it('never offers a binary for the wrong architecture', () => {
    for (const arch of ['arm64', 'x64']) {
      for (const glibc of [true, false]) {
        const wrong = arch === 'arm64' ? 'x64' : 'arm64';
        const candidates = platformCandidates({ platform: 'linux', arch }, glibc);
        expect(candidates.every((c) => c.includes(arch))).toBe(true);
        expect(candidates.some((c) => c.includes(`-${wrong}`))).toBe(false);
      }
    }
  });

  it('asks for the libc it is running on first', () => {
    expect(platformCandidates({ platform: 'linux', arch: 'arm64' }, true)[0]).toBe('linux-arm64');
    expect(platformCandidates({ platform: 'linux', arch: 'arm64' }, false)[0]).toBe(
      'linux-arm64-musl',
    );
    expect(platformCandidates({ platform: 'linux', arch: 'x64' }, false)[0]).toBe('linux-x64-musl');
  });

  it('has one answer on macOS, which has no musl', () => {
    expect(platformCandidates({ platform: 'darwin', arch: 'arm64' }, true)).toEqual([
      'darwin-arm64',
    ]);
  });
});

/**
 * The bug this pins: a conversation is spawned with the workspace as its
 * working directory, and a missing working directory is an ENOENT against the
 * command — which the SDK reports as the Claude Code binary failing to launch,
 * libc and all. The binary was never the problem, and the container's
 * /data/workspace is exactly what a bind-mounted /data does not have.
 */
describe('the workspace conversations run in', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fzt-workspace-'));
  const log = createLogger('error');

  it('creates it when it is not there', () => {
    const dir = path.join(root, 'data', 'workspace');
    expect(existsSync(dir)).toBe(false);
    expect(ensureWorkspace(dir, log)).toBe(dir);
    expect(existsSync(dir)).toBe(true);
  });

  it('leaves one that already exists alone', () => {
    const dir = path.join(root, 'again');
    ensureWorkspace(dir, log);
    expect(ensureWorkspace(dir, log)).toBe(dir);
  });

  it('answers with a directory that exists rather than refusing to serve', () => {
    // A file where the directory should be: creating it cannot work, and every
    // turn failing is a worse answer than running somewhere else.
    const taken = path.join(root, 'taken');
    writeFileSync(taken, 'not a directory');
    expect(ensureWorkspace(taken, log)).toBe(process.cwd());
  });

  it('is created by the time the sidecar is listening', async () => {
    const dir = path.join(root, 'on-boot');
    const { stop } = await boot({ FZT_AGENT_WORKSPACE: dir });
    expect(existsSync(dir)).toBe(true);
    await stop();
  });
});
