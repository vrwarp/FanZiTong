/**
 * Where the assistant's settings live.
 *
 * Deliberately not in `UserSettings`: those are exported in the JSON backup,
 * and a pairing token has no business in a file the learner emails themselves.
 * localStorage keeps the same `fzt-` convention as the theme and paused session.
 */
import { PROFILE_NAMES, type ProfileName } from './profiles';

const KEYS = {
  endpoint: 'fzt-assistant-endpoint',
  token: 'fzt-assistant-token',
  conversation: 'fzt-assistant-conversation',
  prefs: 'fzt-assistant-prefs',
} as const;

export interface AssistantPrefs {
  /** Profile used for the free-form panel; per-action ones override it. */
  profile: ProfileName;
  /** Ask before a delete or a large edit. */
  confirmDestructive: boolean;
  showCost: boolean;
}

export const DEFAULT_PREFS: AssistantPrefs = {
  profile: 'quick',
  confirmDestructive: true,
  showCost: false,
};

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Private mode, or storage disabled: the assistant is simply unavailable.
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the app works without the assistant.
  }
}

export interface AssistantConfig {
  endpoint: string;
  token: string;
  prefs: AssistantPrefs;
}

/**
 * A `ws://` endpoint is only safe on localhost; the deployed app is https, so
 * anything else must be `wss://` or the browser blocks it as mixed content.
 */
export function isSecureEndpoint(endpoint: string): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol === 'wss:') return true;
    if (url.protocol !== 'ws:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
}

export function loadConfig(): AssistantConfig {
  let prefs = DEFAULT_PREFS;
  const raw = read(KEYS.prefs);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AssistantPrefs>;
      prefs = {
        profile: PROFILE_NAMES.includes(parsed.profile as ProfileName)
          ? (parsed.profile as ProfileName)
          : DEFAULT_PREFS.profile,
        confirmDestructive: parsed.confirmDestructive ?? DEFAULT_PREFS.confirmDestructive,
        showCost: parsed.showCost ?? DEFAULT_PREFS.showCost,
      };
    } catch {
      prefs = DEFAULT_PREFS;
    }
  }
  return { endpoint: read(KEYS.endpoint) ?? '', token: read(KEYS.token) ?? '', prefs };
}

export function saveEndpoint(endpoint: string, token: string): void {
  write(KEYS.endpoint, endpoint.trim() || null);
  write(KEYS.token, token.trim() || null);
}

export function savePrefs(prefs: AssistantPrefs): void {
  write(KEYS.prefs, JSON.stringify(prefs));
}

export function forgetPairing(): void {
  write(KEYS.endpoint, null);
  write(KEYS.token, null);
  write(KEYS.conversation, null);
}

export function loadConversationId(): string | null {
  return read(KEYS.conversation);
}

export function saveConversationId(id: string | null): void {
  write(KEYS.conversation, id);
}
