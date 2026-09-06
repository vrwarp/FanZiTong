/**
 * Everything the sidecar reads from its environment.
 *
 * Bound to loopback with no token it is a development convenience; anywhere
 * else a token and an origin allowlist are required, because this process can
 * spend the owner's Claude subscription.
 */
import { randomBytes } from 'node:crypto';

export interface AgentConfig {
  host: string;
  port: number;
  token: string | null;
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

  if (!loopback && !token) {
    throw new Error(
      'FZT_AGENT_TOKEN is required when the sidecar listens on anything but loopback. Generate one with: openssl rand -base64 32',
    );
  }

  const origins = (env.FZT_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    host,
    port: int(env.FZT_AGENT_PORT, 8787),
    token,
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

/** A token for a first run, printed once so the owner can paste it into the app. */
export function generateToken(): string {
  return randomBytes(24).toString('base64url');
}
