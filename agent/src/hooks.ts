/**
 * Hooks that make a turn cheaper and safer.
 *
 * Injecting the app's context on every prompt saves a round trip: without it
 * the model's first move is almost always "what am I looking at?", which costs
 * a whole model turn plus an RPC to a phone.
 */
import type { ClientBridge } from './bridge';
import { APP_CONTEXT_METHOD } from '@/lib/assistant/tools';

/** Cards one turn may create, update or delete before the hook stops it. */
export const MUTATION_BUDGET = 300;

const MUTATING = /^mcp__fanzitong__deck_(upsert|delete|merge)_cards$/;

export interface HookDeps {
  bridge: ClientBridge;
  /** Reset per turn by the session. */
  spent: { count: number };
}

export function buildHooks(deps: HookDeps) {
  return {
    UserPromptSubmit: [
      {
        hooks: [
          async () => {
            const answer = await deps.bridge.call(APP_CONTEXT_METHOD, {});
            if (!answer.ok) return { continue: true };
            const payload = answer.result as { result?: unknown } | undefined;
            const context = JSON.stringify(payload?.result ?? payload);
            if (!context || context.length > 4000) return { continue: true };
            return {
              continue: true,
              hookSpecificOutput: {
                hookEventName: 'UserPromptSubmit' as const,
                additionalContext: `The learner is here right now: ${context}`,
              },
            };
          },
        ],
      },
    ],
    PreToolUse: [
      {
        matcher: 'mcp__fanzitong__deck_.*',
        hooks: [
          async (input: unknown) => {
            const event = input as { tool_name?: string; tool_input?: { cards?: unknown[] } };
            if (!event.tool_name || !MUTATING.test(event.tool_name)) return { continue: true };
            const size = Array.isArray(event.tool_input?.cards) ? event.tool_input.cards.length : 1;
            if (deps.spent.count + size > MUTATION_BUDGET) {
              return {
                continue: true,
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse' as const,
                  permissionDecision: 'deny' as const,
                  permissionDecisionReason: `This turn has already changed ${deps.spent.count} cards. Tell the learner what is left and let them ask again.`,
                },
              };
            }
            deps.spent.count += size;
            return { continue: true };
          },
        ],
      },
    ],
  };
}
