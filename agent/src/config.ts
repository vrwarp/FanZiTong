/**
 * Everything the sidecar reads from its environment.
 *
 * On a public address the sidecar is not protected by a shared secret: it is
 * protected by the Claude sign-in itself, which the app drives. A fixed token
 * is only needed when there is no sign-in to prove ownership — an
 * operator-supplied credential, or a loopback sidecar in development.
 */
import { homedir } from 'node:os';
import path from 'node:path';

export interface AgentConfig {
  host: string;
  port: number;
  /**
   * A fixed token, for a sidecar that is not signed in through the app (an
   * operator-supplied Claude credential, or local development).
   */
  token: string | null;
  /** Where sessions, ownership and staged sign-ins are kept. */
  stateDir: string;
  claudeConfigDir: string;
  /** Let a sign-in take the assistant over when its owner is locked out. */
  allowReclaim: boolean;
  allowedOrigins: string[];
  workspace: string;
  maxSessions: number;
  idleTimeoutMs: number;
  detachGraceMs: number;
  rpcTimeoutMs: number;
  permissionTimeoutMs: number;
  turnTimeoutMs: number;
  maxBudgetUsd: number | null;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const host = env.FZT_AGENT_HOST?.trim() || '127.0.0.1';
  const loopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  const token = env.FZT_AGENT_TOKEN?.trim() || null;

  const origins = (env.FZT_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // An operator-supplied credential means nobody signs in through the app, so
  // there is no Claude login to prove who the owner is: a token stands in.
  const operatorCredential = Boolean(
    env.CLAUDE_CODE_OAUTH_TOKEN?.trim() || env.ANTHROPIC_API_KEY?.trim(),
  );
  if (!loopback && operatorCredential && !token) {
    throw new Error(
      'This sidecar has its own Claude credential, so signing in through the app cannot establish who owns it. Set FZT_AGENT_TOKEN as well, or remove CLAUDE_CODE_OAUTH_TOKEN and sign in from the app instead.',
    );
  }

  const claudeConfigDir = env.CLAUDE_CONFIG_DIR?.trim() || path.join(homedir(), '.claude');

  return {
    host,
    port: int(env.FZT_AGENT_PORT, 8787),
    token,
    stateDir: env.FZT_AGENT_STATE_DIR?.trim() || path.join(claudeConfigDir, 'fanzitong'),
    claudeConfigDir,
    allowReclaim: env.FZT_ALLOW_RECLAIM?.trim() === 'true',
    allowedOrigins: origins,
    workspace: env.FZT_AGENT_WORKSPACE?.trim() || process.cwd(),
    maxSessions: int(env.FZT_AGENT_MAX_SESSIONS, 3),
    idleTimeoutMs: int(env.FZT_AGENT_IDLE_TIMEOUT_MS, 10 * 60_000),
    detachGraceMs: int(env.FZT_AGENT_DETACH_GRACE_MS, 3 * 60_000),
    rpcTimeoutMs: int(env.FZT_AGENT_RPC_TIMEOUT_MS, 60_000),
    permissionTimeoutMs: int(env.FZT_AGENT_PERMISSION_TIMEOUT_MS, 5 * 60_000),
    turnTimeoutMs: int(env.FZT_AGENT_TURN_TIMEOUT_MS, 10 * 60_000),
    maxBudgetUsd: env.FZT_AGENT_MAX_BUDGET_USD ? Number(env.FZT_AGENT_MAX_BUDGET_USD) : null,
    logLevel: (env.FZT_LOG_LEVEL as AgentConfig['logLevel']) || 'info',
  };
}
