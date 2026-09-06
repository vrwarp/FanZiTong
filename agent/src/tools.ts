/**
 * Registering the deck tools with the Agent SDK.
 *
 * Each handler is a stub: it forwards the call to the browser and turns the
 * answer into an MCP tool result. Nothing about the deck is computed here.
 */
import type { z } from 'zod';
import type { ClientBridge } from './bridge';
import type { SdkApi } from './sdk';
import { TOOLS, TOOL_INSTRUCTIONS, TOOL_ORDER, TOOL_SERVER } from '@/lib/assistant/tools';

/** Tool results are JSON text; keep one payload from filling the context. */
const MAX_RESULT_CHARS = 24_000;

function render(value: unknown): string {
  const text = JSON.stringify(value, null, 2) ?? 'null';
  if (text.length <= MAX_RESULT_CHARS) return text;
  return `${text.slice(0, MAX_RESULT_CHARS)}\n… truncated; narrow the request.`;
}

export function buildDeckServer(sdk: SdkApi, bridge: ClientBridge) {
  const tools = TOOL_ORDER.map((name) => {
    const spec = TOOLS[name];
    return sdk.tool(
      name,
      spec.description,
      (spec.input as z.ZodObject<z.ZodRawShape>).shape,
      async (args: unknown) => {
        const answer = await bridge.call(name, args);
        if (!answer.ok) {
          return {
            content: [
              {
                type: 'text' as const,
                text: answer.error ?? 'The app could not run that just now.',
              },
            ],
            isError: true,
          };
        }
        const payload = answer.result as { result?: unknown; isError?: boolean } | undefined;
        return {
          content: [{ type: 'text' as const, text: render(payload?.result ?? payload) }],
          isError: Boolean(payload?.isError),
        };
      },
      { annotations: { readOnlyHint: spec.readOnly, destructiveHint: !spec.readOnly } },
    );
  });

  return sdk.createSdkMcpServer({
    name: TOOL_SERVER,
    version: '1.0.0',
    instructions: TOOL_INSTRUCTIONS,
    tools,
  });
}
