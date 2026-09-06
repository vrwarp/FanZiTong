/**
 * Signing in to the assistant from the app.
 *
 * There is no password to invent: the sidecar belongs to whoever can sign in
 * to its Claude account, so the app shows the link Claude Code produced, takes
 * the code back, and gets a session in return.
 */

export interface AuthState {
  /** Somebody has already signed this assistant in to a Claude account. */
  claimed: boolean;
  /** This device holds a valid session. */
  authenticated: boolean;
  /** Claude Code has usable credentials. */
  signedIn: boolean;
  account: { email?: string; organization?: string; subscriptionType?: string } | null;
  /** Whether this device may start a sign-in right now. */
  canSignIn: boolean;
}

export interface StartedLogin {
  loginId: string;
  url: string;
}

export interface SignedIn {
  token: string;
  expiresAt: string;
  account: AuthState['account'];
}

/** `wss://host/path` → `https://host/path`, so both halves share an origin. */
export function httpBase(endpoint: string): string {
  const url = new URL(endpoint);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

async function request<T>(
  endpoint: string,
  route: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = init;
  const response = await fetch(`${httpBase(endpoint)}${route}`, {
    ...rest,
    // Send the cookie when the sidecar and the app share a site; the token in
    // the header covers every other case, including Safari.
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(rest.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? `The assistant answered ${response.status}.`);
  }
  return body;
}

export function fetchAuthState(endpoint: string, token: string | null): Promise<AuthState> {
  return request<AuthState>(endpoint, '/auth/state', { token });
}

export function startSignIn(
  endpoint: string,
  token: string | null,
  mode: 'claudeai' | 'console' = 'claudeai',
): Promise<StartedLogin> {
  return request<StartedLogin>(endpoint, '/auth/start', {
    method: 'POST',
    body: JSON.stringify({ mode }),
    token,
  });
}

export function submitSignInCode(
  endpoint: string,
  loginId: string,
  code: string,
): Promise<SignedIn> {
  return request<SignedIn>(endpoint, '/auth/code', {
    method: 'POST',
    body: JSON.stringify({ loginId, code }),
  });
}

export function cancelSignIn(endpoint: string, loginId: string): Promise<unknown> {
  return request(endpoint, '/auth/cancel', {
    method: 'POST',
    body: JSON.stringify({ loginId }),
  }).catch(() => undefined);
}

export function signOut(endpoint: string, token: string | null): Promise<unknown> {
  return request(endpoint, '/auth/logout', { method: 'POST', token }).catch(() => undefined);
}

/**
 * What the learner pastes back is a URL fragment, and people paste the whole
 * thing as often as the code alone. Both work.
 */
export function normalizeCode(pasted: string): string {
  const trimmed = pasted.trim();
  const fromUrl = /[?&]code=([^&\s]+)/.exec(trimmed);
  return (fromUrl?.[1] ?? trimmed).trim();
}
