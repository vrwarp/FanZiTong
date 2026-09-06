/**
 * The small HTTP surface in front of the socket.
 *
 * Everything here is reachable from the public internet, so each handler is
 * written on the assumption that whoever is calling it has not been invited.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SESSION_COOKIE, type AuthService } from './auth';
import type { AgentConfig } from './config';
import type { Logger } from './log';

/** Bodies are tiny; anything larger is not one of ours. */
const MAX_BODY_BYTES = 8 * 1024;

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;
    const raw = rest.join('=');
    try {
      return decodeURIComponent(raw);
    } catch {
      // A cookie we cannot decode is not one of ours.
      return null;
    }
  }
  return null;
}

/** The session presented by this request, from either the header or the cookie. */
export function bearerOf(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  return readCookie(req.headers.cookie, SESSION_COOKIE);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('That request was too large.');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export interface HttpDeps {
  auth: AuthService;
  config: AgentConfig;
  log: Logger;
  version: string;
  /** True when the caller presented the configured fixed token. */
  verifyFixedToken: (token: string | null) => boolean;
  /** Whether Claude Code has usable credentials right now. */
  probeAuth: () => Promise<'ok' | 'unknown' | 'needs_login'>;
  sessions: () => number;
}

/**
 * Per-IP throttling for the endpoints that cost something.
 *
 * Starting a sign-in spawns a process, so an open endpoint would be a way to
 * exhaust the host from a browser tab.
 */
class Throttle {
  private readonly hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

export function createHttpHandler(deps: HttpDeps) {
  const startThrottle = new Throttle(5, 10 * 60_000);
  const codeThrottle = new Throttle(20, 10 * 60_000);

  const originAllowed = (origin: string | undefined): boolean =>
    Boolean(origin && deps.config.allowedOrigins.includes(origin));

  const send = (
    req: IncomingMessage,
    res: ServerResponse,
    status: number,
    body: unknown,
    cookie?: string,
  ) => {
    const headers: Record<string, string | string[]> = {
      'content-type': 'application/json',
      // Nothing here should ever be cached or reused across origins.
      'cache-control': 'no-store',
      vary: 'Origin',
    };
    const origin = req.headers.origin;
    if (originAllowed(origin)) {
      headers['access-control-allow-origin'] = origin as string;
      headers['access-control-allow-credentials'] = 'true';
    }
    if (cookie) headers['set-cookie'] = cookie;
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  };

  const sessionCookie = (token: string, expiresAt: string): string =>
    [
      `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      'Path=/',
      'HttpOnly',
      // The app is usually on another origin (GitHub Pages), so the cookie has
      // to be cross-site. Browsers that refuse third-party cookies simply fall
      // back to the token the app keeps itself.
      'SameSite=None',
      'Secure',
      `Expires=${new Date(expiresAt).toUTCString()}`,
    ].join('; ');

  const clearCookie = (): string =>
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0`;

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = url.pathname;
    const ip = req.socket.remoteAddress ?? 'unknown';

    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      if (!originAllowed(origin)) {
        res.writeHead(403).end();
        return;
      }
      res.writeHead(204, {
        'access-control-allow-origin': origin as string,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization',
        'access-control-max-age': '600',
        vary: 'Origin',
      });
      res.end();
      return;
    }

    if (route === '/healthz') {
      send(req, res, 200, { ok: true, version: deps.version, sessions: deps.sessions() });
      return;
    }

    if (route === '/readyz') {
      const auth = await deps.probeAuth();
      send(req, res, auth === 'ok' ? 200 : 503, { auth, claimed: deps.auth.claimed });
      return;
    }

    // Everything below is the sign-in flow, and only for the app's own origin.
    if (route.startsWith('/auth/')) {
      if (!originAllowed(req.headers.origin) && req.headers.origin !== undefined) {
        send(req, res, 403, {
          error: 'This assistant does not accept requests from that address.',
        });
        return;
      }

      const token = bearerOf(req);
      const authenticated = deps.auth.verify(token) || deps.verifyFixedToken(token);

      /**
       * Who may begin a sign-in.
       *
       * Once the assistant is claimed, only a device that already holds a
       * session. And whenever a fixed token is configured — the setup where
       * credentials come from the operator and nobody ever signs in, so
       * `claimed` would stay false forever — that token is the credential and
       * an anonymous sign-in would hand a stranger a session that spends it.
       */
      const mayStartSignIn =
        authenticated ||
        deps.config.allowReclaim ||
        deps.config.allowAnonymous ||
        (!deps.auth.claimed && !deps.config.token);

      if (route === '/auth/state' && req.method === 'GET') {
        send(req, res, 200, {
          claimed: deps.auth.claimed,
          authenticated,
          signedIn: (await deps.probeAuth()) === 'ok',
          // Only a device that is already signed in gets to see whose it is.
          account: authenticated ? (deps.auth.owner?.account ?? null) : null,
          canSignIn: mayStartSignIn,
        });
        return;
      }

      if (route === '/auth/start' && req.method === 'POST') {
        if (!mayStartSignIn) {
          send(req, res, 403, {
            error: deps.config.token
              ? 'This assistant is opened with its own token, which the app asks for instead.'
              : 'This assistant already belongs to a Claude account. Sign in from a device that is already connected, or restart it with FZT_ALLOW_RECLAIM=true.',
          });
          return;
        }
        if (!startThrottle.allow(ip)) {
          send(req, res, 429, { error: 'Too many sign-in attempts. Wait a few minutes.' });
          return;
        }
        try {
          const body = (await readBody(req)) as { mode?: 'claudeai' | 'console' };
          const login = await deps.auth.startLogin({ mode: body.mode });
          send(req, res, 200, { loginId: login.id, url: login.url });
        } catch (error) {
          deps.log.warn('could not start a sign-in', { error: String(error) });
          send(req, res, 500, {
            error: error instanceof Error ? error.message : 'Could not start the sign-in.',
          });
        }
        return;
      }

      if (route === '/auth/code' && req.method === 'POST') {
        if (!mayStartSignIn) {
          send(req, res, 403, { error: 'This assistant is not accepting sign-ins.' });
          return;
        }
        if (!codeThrottle.allow(ip)) {
          send(req, res, 429, { error: 'Too many attempts. Wait a few minutes.' });
          return;
        }
        try {
          const body = (await readBody(req)) as { loginId?: string; code?: string };
          if (!body.loginId || !body.code) {
            send(req, res, 400, { error: 'That sign-in is missing its code.' });
            return;
          }
          const outcome = await deps.auth.submitCode(body.loginId, body.code);
          if (!outcome.ok) {
            send(req, res, 400, { error: outcome.error ?? 'The code was not accepted.' });
            return;
          }
          const session = await deps.auth.mintSession(req.headers['user-agent']?.slice(0, 80));
          send(
            req,
            res,
            200,
            {
              token: session.token,
              expiresAt: session.expiresAt,
              account: outcome.account ?? null,
            },
            sessionCookie(session.token, session.expiresAt),
          );
        } catch (error) {
          send(req, res, 500, {
            error: error instanceof Error ? error.message : 'The sign-in failed.',
          });
        }
        return;
      }

      if (route === '/auth/cancel' && req.method === 'POST') {
        const body = (await readBody(req).catch(() => ({}))) as { loginId?: string };
        if (body.loginId) deps.auth.cancel(body.loginId, 'cancelled from the app');
        send(req, res, 200, { ok: true });
        return;
      }

      if (route === '/auth/logout' && req.method === 'POST') {
        if (token) await deps.auth.revoke(token);
        send(req, res, 200, { ok: true }, clearCookie());
        return;
      }

      send(req, res, 404, { error: 'No such endpoint.' });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'No such endpoint.' }));
  };
}
