import type { AddressInfo } from 'node:net';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, type Server } from 'node:http';
import { AuthService } from './auth';
import { loadConfig } from './config';
import { createHttpHandler, readCookie } from './http';
import { createLogger } from './log';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_CLI = path.join(here, 'test', 'fakeClaude.mjs');
const APP = 'https://learner.example';

async function boot(
  options: { claimed?: boolean; allowReclaim?: boolean; fixedToken?: string } = {},
) {
  const stateDir = await mkdtemp(path.join(tmpdir(), 'fzt-http-'));
  const claudeConfigDir = path.join(stateDir, 'live');
  await mkdir(claudeConfigDir, { recursive: true });

  const auth = new AuthService({
    stateDir,
    claudeConfigDir,
    claudeBinary: 'node',
    log: createLogger('error'),
    readAccount: async () => ({ email: 'owner@example.com' }),
    spawnLogin: (args, env) =>
      spawn(process.execPath, [FAKE_CLI, ...args], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      }) as never,
  });
  await auth.load();
  if (options.claimed) {
    const login = await auth.startLogin();
    await auth.submitCode(login.id, 'good-code');
  }

  const config = loadConfig({
    FZT_ALLOWED_ORIGINS: APP,
    FZT_ALLOW_RECLAIM: options.allowReclaim ? 'true' : '',
    ...(options.fixedToken ? { FZT_AGENT_TOKEN: options.fixedToken } : {}),
  } as NodeJS.ProcessEnv);

  const handle = createHttpHandler({
    auth,
    config,
    log: createLogger('error'),
    version: 'test',
    probeAuth: async () => 'ok',
    sessions: () => 0,
    verifyFixedToken: (token) => Boolean(config.token && token === config.token),
  });
  const server: Server = createServer((req, res) => void handle(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    auth,
    base,
    call: (route: string, init: RequestInit = {}) =>
      fetch(`${base}${route}`, {
        ...init,
        headers: { origin: APP, 'content-type': 'application/json', ...(init.headers ?? {}) },
      }),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('the sign-in endpoints', () => {
  it('lets an unclaimed assistant be signed into, and hands back a session', async () => {
    const { call, auth, stop } = await boot();

    const before = (await (await call('/auth/state')).json()) as Record<string, unknown>;
    expect(before).toMatchObject({ claimed: false, authenticated: false, canSignIn: true });

    const started = (await (await call('/auth/start', { method: 'POST', body: '{}' })).json()) as {
      loginId: string;
      url: string;
    };
    expect(started.url).toMatch(/^https:\/\//);

    const response = await call('/auth/code', {
      method: 'POST',
      body: JSON.stringify({ loginId: started.loginId, code: 'good-code' }),
    });
    const body = (await response.json()) as { token: string };
    expect(response.status).toBe(200);
    expect(auth.verify(body.token)).toBe(true);

    // Also set as a cookie, for a sidecar hosted alongside the app.
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(readCookie(cookie.split(';')[0], 'fzt_session')).toBe(body.token);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=None/);
    expect(cookie).toMatch(/Secure/);
    await stop();
  });

  it('turns a rejected code away without a session', async () => {
    const { call, stop } = await boot();
    const started = (await (await call('/auth/start', { method: 'POST', body: '{}' })).json()) as {
      loginId: string;
    };
    const response = await call('/auth/code', {
      method: 'POST',
      body: JSON.stringify({ loginId: started.loginId, code: 'wrong-code' }),
    });
    expect(response.status).toBe(400);
    expect(response.headers.get('set-cookie')).toBeNull();
    await stop();
  });

  it('will not let a stranger start a sign-in once it is claimed', async () => {
    const { call, stop } = await boot({ claimed: true });
    const state = (await (await call('/auth/state')).json()) as Record<string, unknown>;
    expect(state).toMatchObject({ claimed: true, authenticated: false, canSignIn: false });

    const response = await call('/auth/start', { method: 'POST', body: '{}' });
    expect(response.status).toBe(403);
    await stop();
  });

  it('lets a signed-in device start another sign-in', async () => {
    const { call, auth, stop } = await boot({ claimed: true });
    const { token } = await auth.mintSession();
    const response = await call('/auth/start', {
      method: 'POST',
      body: '{}',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    await stop();
  });

  it('opens back up when the owner asks to reclaim it', async () => {
    const { call, stop } = await boot({ claimed: true, allowReclaim: true });
    const response = await call('/auth/start', { method: 'POST', body: '{}' });
    expect(response.status).toBe(200);
    await stop();
  });

  it('accepts the cookie as proof, not just the header', async () => {
    const { call, auth, stop } = await boot({ claimed: true });
    const { token } = await auth.mintSession();
    const state = (await (
      await call('/auth/state', { headers: { cookie: `fzt_session=${token}` } })
    ).json()) as { authenticated: boolean };
    expect(state.authenticated).toBe(true);
    await stop();
  });

  it('signs a device out', async () => {
    const { call, auth, stop } = await boot({ claimed: true });
    const { token } = await auth.mintSession();
    const response = await call('/auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(auth.verify(token)).toBe(false);
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    await stop();
  });

  it('rate-limits sign-in attempts so the endpoint cannot be used to spawn processes', async () => {
    const { call, stop } = await boot();
    const codes: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      codes.push((await call('/auth/start', { method: 'POST', body: '{}' })).status);
    }
    expect(codes).toContain(429);
    await stop();
  });
});

describe('an assistant opened with a fixed token', () => {
  // Credentials come from the operator here, so nobody ever signs in and the
  // assistant is never "claimed". Without a gate the sign-in flow would stay
  // open to the internet and hand a stranger a session that spends them.
  it('will not let a stranger sign in and be issued a session', async () => {
    const { call, stop } = await boot({ fixedToken: 'operator-token' });

    const state = (await (await call('/auth/state')).json()) as { canSignIn: boolean };
    expect(state.canSignIn).toBe(false);

    const start = await call('/auth/start', { method: 'POST', body: '{}' });
    expect(start.status).toBe(403);

    const code = await call('/auth/code', {
      method: 'POST',
      body: JSON.stringify({ loginId: 'anything', code: 'good-code' }),
    });
    expect(code.status).toBe(403);
    await stop();
  });

  it('lets the operator through with their token', async () => {
    const { call, stop } = await boot({ fixedToken: 'operator-token' });
    const response = await call('/auth/start', {
      method: 'POST',
      body: '{}',
      headers: { authorization: 'Bearer operator-token' },
    });
    expect(response.status).toBe(200);
    await stop();
  });
});

describe('what an unauthenticated caller can learn', () => {
  it('does not name the owner', async () => {
    const { call, stop } = await boot({ claimed: true });
    const state = (await (await call('/auth/state')).json()) as {
      claimed: boolean;
      account: unknown;
    };
    expect(state.claimed).toBe(true);
    expect(state.account).toBeNull();
    await stop();
  });

  it('names the owner to a device that is signed in', async () => {
    const { call, auth, stop } = await boot({ claimed: true });
    const { token } = await auth.mintSession();
    const state = (await (
      await call('/auth/state', { headers: { authorization: `Bearer ${token}` } })
    ).json()) as { account: { email: string } | null };
    expect(state.account?.email).toBe('owner@example.com');
    await stop();
  });

  it('shrugs off a cookie header it cannot decode', async () => {
    const { call, stop } = await boot();
    const response = await call('/auth/state', { headers: { cookie: 'fzt_session=%' } });
    expect(response.status).toBe(200);
    await stop();
  });
});

describe('cross-origin rules', () => {
  it('answers a preflight for the app it knows', async () => {
    const { base, stop } = await boot();
    const response = await fetch(`${base}/auth/start`, {
      method: 'OPTIONS',
      headers: { origin: APP, 'access-control-request-method': 'POST' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(APP);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    await stop();
  });

  it('turns away an origin it does not know', async () => {
    const { base, stop } = await boot();
    const preflight = await fetch(`${base}/auth/start`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(preflight.status).toBe(403);

    const post = await fetch(`${base}/auth/start`, {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(post.status).toBe(403);
    await stop();
  });

  it('never echoes a wildcard origin back with credentials', async () => {
    const { call, stop } = await boot();
    const response = await call('/auth/state');
    expect(response.headers.get('access-control-allow-origin')).toBe(APP);
    await stop();
  });
});

describe('health', () => {
  it('answers without any origin at all, for a container health check', async () => {
    const { base, stop } = await boot();
    const response = await fetch(`${base}/healthz`);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    await stop();
  });
});
