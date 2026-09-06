import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthService, identify, type AccountIdentity } from './auth';
import { createLogger } from './log';

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_CLI = path.join(here, 'test', 'fakeClaude.mjs');
const log = createLogger('error');

async function makeService(
  options: {
    account?: AccountIdentity | null;
    env?: Record<string, string>;
  } = {},
) {
  const stateDir = await mkdtemp(path.join(tmpdir(), 'fzt-auth-'));
  const claudeConfigDir = path.join(stateDir, 'live');
  await mkdir(claudeConfigDir, { recursive: true });
  const service = new AuthService({
    stateDir,
    claudeConfigDir,
    claudeBinary: 'node',
    log,
    readAccount: async () =>
      options.account === undefined ? { email: 'owner@example.com' } : options.account,
    // The fake CLI stands in for the real binary, over the same pipes.
    spawnLogin: (args, env) =>
      spawn(process.execPath, [FAKE_CLI, ...args], {
        env: { ...env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      }) as never,
  });
  await service.load();
  return { service, stateDir, claudeConfigDir };
}

describe('identify', () => {
  it('prefers an email, then an organisation', () => {
    expect(identify({ email: 'Me@Example.com' })).toBe('email:me@example.com');
    expect(identify({ organization: 'Acme' })).toBe('org:acme');
  });

  it('will not identify an account that only says what kind it is', () => {
    // A weak identifier must not be mistaken for a match against another one.
    expect(identify({ subscriptionType: 'Claude Max' })).toBeNull();
    expect(identify(null)).toBeNull();
  });
});

describe('signing in', () => {
  it('hands back the link the CLI prints', async () => {
    const { service } = await makeService();
    const login = await service.startLogin();
    expect(login.url).toMatch(/^https:\/\/claude\.com\/cai\/oauth\/authorize/);
    service.cancel(login.id, 'test over');
  });

  it('claims the assistant when the code is accepted', async () => {
    const { service, claudeConfigDir } = await makeService();
    expect(service.claimed).toBe(false);

    const login = await service.startLogin();
    const result = await service.submitCode(login.id, 'good-code');

    expect(result.ok).toBe(true);
    expect(service.claimed).toBe(true);
    expect(service.owner?.account.email).toBe('owner@example.com');
    // The credentials the sign-in produced are now the ones the agent uses.
    const credentials = await readFile(path.join(claudeConfigDir, '.credentials.json'), 'utf8');
    expect(credentials).toContain('staged-token');
  });

  it('reports a rejected code without claiming anything', async () => {
    const { service, claudeConfigDir } = await makeService();
    const login = await service.startLogin();
    const result = await service.submitCode(login.id, 'wrong-code');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/400|not accepted/i);
    expect(service.claimed).toBe(false);
    expect(existsSync(path.join(claudeConfigDir, '.credentials.json'))).toBe(false);
  });

  it('refuses a sign-in from a different Claude account', async () => {
    const stateDir = await mkdtemp(path.join(tmpdir(), 'fzt-auth-'));
    const claudeConfigDir = path.join(stateDir, 'live');
    await mkdir(claudeConfigDir, { recursive: true });
    const build = (email: string) =>
      new AuthService({
        stateDir,
        claudeConfigDir,
        claudeBinary: 'node',
        log,
        readAccount: async () => ({ email }),
        spawnLogin: (args, env) =>
          spawn(process.execPath, [FAKE_CLI, ...args], {
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
          }) as never,
      });

    // The owner claims it.
    const owner = build('owner@example.com');
    await owner.load();
    const claim = await owner.startLogin();
    expect((await owner.submitCode(claim.id, 'good-code')).ok).toBe(true);
    const ownerCredentials = await readFile(
      path.join(claudeConfigDir, '.credentials.json'),
      'utf8',
    );

    // Someone else finds the address and signs in with their own account.
    const stranger = build('stranger@example.com');
    await stranger.load();
    const attempt = await stranger.startLogin();
    const result = await stranger.submitCode(attempt.id, 'good-code');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/different Claude account/);
    expect(stranger.owner?.account.email).toBe('owner@example.com');
    // Staging is what keeps the owner's credentials from being overwritten.
    expect(await readFile(path.join(claudeConfigDir, '.credentials.json'), 'utf8')).toBe(
      ownerCredentials,
    );
  });

  it('refuses a later sign-in when the owner cannot be matched', async () => {
    // An account that reports nothing comparable (a Console or API credential)
    // still claims the assistant, but from then on nothing can prove a sign-in
    // is the same account, so every one of them is turned away.
    const { service, claudeConfigDir } = await makeService({
      account: { subscriptionType: 'Claude API' },
    });
    const claim = await service.startLogin();
    expect((await service.submitCode(claim.id, 'good-code')).ok).toBe(true);
    expect(service.claimed).toBe(true);
    const claimed = await readFile(path.join(claudeConfigDir, '.credentials.json'), 'utf8');

    const attempt = await service.startLogin();
    const result = await service.submitCode(attempt.id, 'good-code');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/FZT_ALLOW_RECLAIM/);
    expect(await readFile(path.join(claudeConfigDir, '.credentials.json'), 'utf8')).toBe(claimed);
  });

  it('hands the assistant over when the owner asks to reclaim it', async () => {
    const stateDir = await mkdtemp(path.join(tmpdir(), 'fzt-auth-'));
    const claudeConfigDir = path.join(stateDir, 'live');
    await mkdir(claudeConfigDir, { recursive: true });
    const build = (email: string, allowReclaim: boolean) =>
      new AuthService({
        stateDir,
        claudeConfigDir,
        claudeBinary: 'node',
        log,
        allowReclaim,
        readAccount: async () => ({ email }),
        spawnLogin: (args, env) =>
          spawn(process.execPath, [FAKE_CLI, ...args], {
            env,
            stdio: ['pipe', 'pipe', 'pipe'],
          }) as never,
      });

    const owner = build('owner@example.com', false);
    await owner.load();
    const claim = await owner.startLogin();
    await owner.submitCode(claim.id, 'good-code');

    const reclaiming = build('someone-else@example.com', true);
    await reclaiming.load();
    const attempt = await reclaiming.startLogin();
    expect((await reclaiming.submitCode(attempt.id, 'good-code')).ok).toBe(true);
  });

  it('lets the same account sign in again', async () => {
    const { service } = await makeService();
    const first = await service.startLogin();
    await service.submitCode(first.id, 'good-code');

    const again = await service.startLogin();
    const result = await service.submitCode(again.id, 'good-code');
    expect(result.ok).toBe(true);
  });

  it('gives up when the CLI never offers a link', async () => {
    const { service } = await makeService({ env: { FAKE_EXIT_EARLY: '1', FAKE_NO_URL: '1' } });
    await expect(service.startLogin()).rejects.toThrow();
    expect(service.pendingCount).toBe(0);
  });

  it('will not let one code be used twice', async () => {
    const { service } = await makeService();
    const login = await service.startLogin();
    await service.submitCode(login.id, 'good-code');
    const second = await service.submitCode(login.id, 'good-code');
    expect(second.ok).toBe(false);
  });

  it('caps how many sign-ins can be in flight at once', async () => {
    const { service } = await makeService();
    const started = [
      await service.startLogin(),
      await service.startLogin(),
      await service.startLogin(),
    ];
    await expect(service.startLogin()).rejects.toThrow(/Too many/);
    for (const login of started) service.cancel(login.id, 'test over');
  });
});

describe('sessions', () => {
  it('mints a token that verifies, and nothing else does', async () => {
    const { service } = await makeService();
    const { token } = await service.mintSession('a phone');
    expect(service.verify(token)).toBe(true);
    expect(service.verify('something-else')).toBe(false);
    expect(service.verify('')).toBe(false);
    expect(service.verify(null)).toBe(false);
  });

  it('stores only a hash, so the state file is not a set of live sessions', async () => {
    const { service, stateDir } = await makeService();
    const { token } = await service.mintSession();
    const state = await readFile(path.join(stateDir, 'auth.json'), 'utf8');
    expect(state).not.toContain(token);
  });

  it('survives a restart', async () => {
    const { service, stateDir, claudeConfigDir } = await makeService();
    const { token } = await service.mintSession();

    const restarted = new AuthService({
      stateDir,
      claudeConfigDir,
      claudeBinary: 'node',
      log,
      readAccount: async () => null,
    });
    await restarted.load();
    expect(restarted.verify(token)).toBe(true);
  });

  it('forgets a revoked session, and all of them on request', async () => {
    const { service } = await makeService();
    const one = await service.mintSession();
    const two = await service.mintSession();
    await service.revoke(one.token);
    expect(service.verify(one.token)).toBe(false);
    expect(service.verify(two.token)).toBe(true);

    await service.revokeAll();
    expect(service.verify(two.token)).toBe(false);
  });

  it('stops accepting a session once it has expired', async () => {
    const { service, stateDir, claudeConfigDir } = await makeService();
    const { token } = await service.mintSession();

    // A month and a day later, the same token is no longer a way in.
    const later = new AuthService({
      stateDir,
      claudeConfigDir,
      claudeBinary: 'node',
      log,
      readAccount: async () => null,
      now: () => Date.now() + 31 * 24 * 60 * 60_000,
    });
    await later.load();
    expect(later.verify(token)).toBe(false);
  });
});
