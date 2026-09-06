/**
 * The live conversations this process is holding.
 *
 * One conversation maps to one Claude Code subprocess, so the cap here is a
 * memory cap: three is enough for a phone, a laptop and a background job.
 */
import type { AgentConfig } from './config';
import type { Logger } from './log';
import { AgentSession, type SessionDeps } from './session';
import type { SdkApi } from './sdk';
import type { SessionFacts } from './prompt';

export class SessionRegistry {
  private readonly sessions = new Map<string, AgentSession>();

  constructor(
    private readonly sdk: SdkApi,
    private readonly config: AgentConfig,
    private readonly log: Logger,
  ) {}

  get(id: string): AgentSession | undefined {
    return this.sessions.get(id);
  }

  get size(): number {
    return this.sessions.size;
  }

  /** Find the conversation or start one; null when the process is at capacity. */
  open(id: string, facts: SessionFacts): AgentSession | null {
    const existing = this.sessions.get(id);
    if (existing) return existing;
    if (this.sessions.size >= this.config.maxSessions) {
      // Reclaim a detached one before refusing.
      const idle = [...this.sessions.values()].find((s) => !s.attached);
      if (idle) void idle.close('made room for a new conversation');
      else return null;
    }
    const deps: SessionDeps = { sdk: this.sdk, config: this.config, log: this.log, facts };
    const session = new AgentSession(id, deps, (closed) => this.sessions.delete(closed));
    this.sessions.set(id, session);
    return session;
  }

  async closeAll(reason: string): Promise<void> {
    await Promise.all([...this.sessions.values()].map((s) => s.close(reason)));
  }
}
