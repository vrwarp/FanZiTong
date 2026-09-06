/**
 * Who is allowed to use this sidecar.
 *
 * The sidecar sits on the public internet and spends the owner's Claude
 * subscription, so it cannot be open to anyone who finds the URL. Rather than
 * inventing a password, it reuses the only credential that already matters:
 * the Claude login itself. Signing in through the app proves you hold the
 * account the sidecar runs as, and that is what mints a session.
 *
 * The CLI drives this well with plain pipes. `claude auth login` prints a URL,
 * waits at "Paste code here if prompted", and exits 0 once the pasted code is
 * accepted — so the app can show the link, take the code back, and never ask
 * anyone to open a shell in the container.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from './log';

/** How long a half-finished login may occupy a process. */
const LOGIN_TIMEOUT_MS = 10 * 60_000;
/** How long the app has to hand back the code once the URL is shown. */
const CODE_TIMEOUT_MS = 5 * 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
/** One at a time: each pending login is a live subprocess. */
const MAX_PENDING_LOGINS = 3;

export const SESSION_COOKIE = 'fzt_session';

export interface AccountIdentity {
  email?: string;
  organization?: string;
  subscriptionType?: string;
}

interface StoredSession {
  /** SHA-256 of the token: a leaked state file is not a set of live sessions. */
  hash: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  label?: string;
}

interface AuthState {
  owner: { claimedAt: string; account: AccountIdentity } | null;
  sessions: StoredSession[];
}

const EMPTY: AuthState = { owner: null, sessions: [] };

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Compare two hex digests without leaking their contents through timing. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * The account this sidecar belongs to, as best it can be identified.
 *
 * A subscription login carries an email; a Console or API credential may only
 * report its kind. Whatever is available becomes the identity, and an identity
 * that cannot be compared is treated as a mismatch rather than a match.
 */
export function identify(account: AccountIdentity | null | undefined): string | null {
  if (!account) return null;
  if (account.email) return `email:${account.email.trim().toLowerCase()}`;
  if (account.organization) return `org:${account.organization.trim().toLowerCase()}`;
  return null;
}

export interface LoginHandle {
  id: string;
  url: string;
  startedAt: number;
}

interface PendingLogin extends LoginHandle {
  child: ChildProcessWithoutNullStreams;
  configDir: string;
  stderr: string;
  timer: NodeJS.Timeout;
  /** Resolves when the child exits, with what the CLI made of the code. */
  settle: (result: LoginResult) => void;
  done: Promise<LoginResult>;
  codeSubmitted: boolean;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export interface AuthDeps {
  /** Where credentials and the auth state live; the container's data volume. */
  stateDir: string;
  claudeConfigDir: string;
  /** Path to the Claude Code binary, so the login runs the same one the SDK does. */
  claudeBinary: string;
  log: Logger;
  /** Reads the signed-in account, used to keep a stranger from taking over. */
  readAccount: (configDir: string) => Promise<AccountIdentity | null>;
  /** Let a sign-in hand a claimed assistant to a different Claude account. */
  allowReclaim?: boolean;
  /** Overridable so tests do not spawn anything. */
  spawnLogin?: (args: string[], env: NodeJS.ProcessEnv) => ChildProcessWithoutNullStreams;
  now?: () => number;
}

export class AuthService {
  private state: AuthState = EMPTY;
  private loaded = false;
  private readonly pending = new Map<string, PendingLogin>();
  private readonly statePath: string;

  constructor(private readonly deps: AuthDeps) {
    this.statePath = path.join(deps.stateDir, 'auth.json');
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(raw) as AuthState;
      this.state = {
        owner: parsed.owner ?? null,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch {
      this.state = { owner: null, sessions: [] };
    }
    this.loaded = true;
    await this.prune();
  }

  private async save(): Promise<void> {
    await mkdir(this.deps.stateDir, { recursive: true });
    // Write then rename, so a crash cannot leave a truncated state file that
    // would silently sign every device out.
    const temporary = `${this.statePath}.${randomUUID()}`;
    await writeFile(temporary, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    await rename(temporary, this.statePath);
  }

  private async prune(): Promise<void> {
    const now = this.now();
    const live = this.state.sessions.filter((s) => Date.parse(s.expiresAt) > now);
    if (live.length !== this.state.sessions.length) {
      this.state.sessions = live;
      await this.save();
    }
  }

  get claimed(): boolean {
    return this.state.owner !== null;
  }

  get owner(): AuthState['owner'] {
    return this.state.owner;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /** True when the token names a live session. */
  verify(token: string | null | undefined): boolean {
    if (!token) return false;
    const hash = sha256(token);
    const now = this.now();
    // Expiry is absolute: using a session does not extend it, so there is
    // nothing to write back here.
    return this.state.sessions.some((s) => sameHash(s.hash, hash) && Date.parse(s.expiresAt) > now);
  }

  async mintSession(label?: string): Promise<{ token: string; expiresAt: string }> {
    const token = randomBytes(32).toString('base64url');
    const now = this.now();
    const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
    this.state.sessions.push({
      hash: sha256(token),
      createdAt: new Date(now).toISOString(),
      lastSeenAt: new Date(now).toISOString(),
      expiresAt,
      ...(label ? { label } : {}),
    });
    await this.save();
    return { token, expiresAt };
  }

  async revoke(token: string): Promise<void> {
    const hash = sha256(token);
    this.state.sessions = this.state.sessions.filter((s) => !sameHash(s.hash, hash));
    await this.save();
  }

  async revokeAll(): Promise<void> {
    this.state.sessions = [];
    await this.save();
  }

  /**
   * Start a sign-in and return the link for the learner to open.
   *
   * The child keeps running, holding the PKCE verifier for its own URL, until
   * the code comes back or it times out.
   */
  async startLogin(options: { mode?: 'claudeai' | 'console' } = {}): Promise<LoginHandle> {
    if (this.pending.size >= MAX_PENDING_LOGINS) {
      throw new Error('Too many sign-ins are already in progress. Try again in a few minutes.');
    }

    const id = randomUUID();
    // Sign in against a staging directory: an attempt that turns out to be a
    // different account must not overwrite the credentials already in use.
    const configDir = path.join(this.deps.stateDir, 'login', id);
    await mkdir(configDir, { recursive: true });

    const args = ['auth', 'login', options.mode === 'console' ? '--console' : '--claudeai'];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CLAUDE_CONFIG_DIR: configDir,
      // Nothing to open in a container, and the CLI falls back to printing the
      // URL, which is exactly what the app needs.
      BROWSER: '/bin/true',
    };
    // An ambient credential would make the CLI skip the flow we are driving.
    delete env.CLAUDE_CODE_OAUTH_TOKEN;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;

    const child = (
      this.deps.spawnLogin ?? ((a, e) => spawn(this.deps.claudeBinary, a, { env: e }))
    )(args, env) as ChildProcessWithoutNullStreams;

    let settle!: (result: LoginResult) => void;
    const done = new Promise<LoginResult>((resolve) => {
      settle = resolve;
    });

    const entry: PendingLogin = {
      id,
      url: '',
      startedAt: this.now(),
      child,
      configDir,
      stderr: '',
      codeSubmitted: false,
      settle,
      done,
      timer: setTimeout(() => this.cancel(id, 'The sign-in timed out.'), LOGIN_TIMEOUT_MS),
    };
    this.pending.set(id, entry);

    const url = await new Promise<string>((resolve, reject) => {
      let out = '';
      const deadline = setTimeout(() => {
        reject(new Error('Claude Code did not offer a sign-in link.'));
      }, 60_000);

      child.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString();
        const match = /https:\/\/\S+/.exec(out);
        if (match) {
          clearTimeout(deadline);
          resolve(match[0].replace(/[.,)]+$/, ''));
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        entry.stderr += chunk.toString();
      });
      child.on('error', (error) => {
        clearTimeout(deadline);
        reject(error);
      });
      child.on('exit', (code) => {
        clearTimeout(deadline);
        reject(new Error(entry.stderr.trim() || `Claude Code exited (${code}) before signing in.`));
      });
    }).catch((error: unknown) => {
      this.cancel(id, 'start failed');
      throw error instanceof Error ? error : new Error(String(error));
    });

    entry.url = url;
    child.once('exit', (code) => {
      clearTimeout(entry.timer);
      const failure = /Login failed:?\s*(.*)/i.exec(entry.stderr);
      entry.settle(
        code === 0
          ? { ok: true }
          : {
              ok: false,
              error: failure?.[1]?.trim() || entry.stderr.trim() || 'The code was not accepted.',
            },
      );
    });

    this.deps.log.info('sign-in started', { id });
    return { id, url, startedAt: entry.startedAt };
  }

  /**
   * Hand the pasted code to the waiting CLI and see whether it is accepted.
   *
   * A sign-in only counts when the account matches the one this sidecar
   * already belongs to; the first successful sign-in is what decides that.
   */
  async submitCode(id: string, code: string): Promise<LoginResult & { account?: AccountIdentity }> {
    const entry = this.pending.get(id);
    if (!entry) return { ok: false, error: 'That sign-in has expired. Start again.' };
    if (entry.codeSubmitted) return { ok: false, error: 'That code was already used.' };
    entry.codeSubmitted = true;

    entry.child.stdin.write(`${code.trim()}\n`);
    const outcome = await Promise.race([
      entry.done,
      new Promise<LoginResult>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, error: 'Claude did not answer in time.' }),
          CODE_TIMEOUT_MS,
        ),
      ),
    ]);

    if (!outcome.ok) {
      this.cancel(id, 'code rejected');
      return outcome;
    }

    const account = await this.deps.readAccount(entry.configDir).catch(() => null);
    const identity = identify(account);
    const ownerIdentity = identify(this.state.owner?.account);

    // Once claimed, a sign-in has to prove it is the same account. Both sides
    // must be identifiable to say that, so an identity that cannot be compared
    // is a mismatch rather than a pass — otherwise an assistant claimed by an
    // account with no comparable identity would accept anyone's sign-in.
    if (this.state.owner && !this.deps.allowReclaim) {
      if (!ownerIdentity || !identity || identity !== ownerIdentity) {
        this.cancel(id, 'different account');
        this.deps.log.warn('refused a sign-in that is not the owner', { id });
        return {
          ok: false,
          error:
            ownerIdentity && identity
              ? 'That is a different Claude account from the one this assistant belongs to.'
              : 'This assistant already belongs to a Claude account, and this sign-in could not be matched against it. Restart it with FZT_ALLOW_RECLAIM=true to hand it over.',
        };
      }
    }

    // Accepted: promote the staged credentials and take ownership if unclaimed.
    await this.promote(entry.configDir);
    if (!this.state.owner) {
      this.state.owner = {
        claimedAt: new Date(this.now()).toISOString(),
        account: account ?? {},
      };
      this.deps.log.info('assistant claimed', { account: identity ?? 'unidentified' });
    }
    await this.save();
    this.pending.delete(id);
    return { ok: true, ...(account ? { account } : {}) };
  }

  /**
   * Move the credentials the sign-in produced into the directory the SDK reads.
   *
   * The file's location is part of the documented credential layout, which is
   * what makes staging possible at all.
   */
  private async promote(configDir: string): Promise<void> {
    const from = path.join(configDir, '.credentials.json');
    const to = path.join(this.deps.claudeConfigDir, '.credentials.json');
    await mkdir(this.deps.claudeConfigDir, { recursive: true });
    const credentials = await readFile(from, 'utf8');
    const temporary = `${to}.${randomUUID()}`;
    await writeFile(temporary, credentials, { mode: 0o600 });
    await rename(temporary, to);
  }

  cancel(id: string, reason: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.settle({ ok: false, error: reason });
    entry.child.kill('SIGKILL');
  }

  /** Abandon every half-finished sign-in; used on shutdown. */
  cancelAll(): void {
    for (const id of [...this.pending.keys()]) this.cancel(id, 'the sidecar is stopping');
  }
}
