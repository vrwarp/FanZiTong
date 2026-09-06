/**
 * The only module that imports the Agent SDK.
 *
 * Everything else takes this interface, so the session logic can be tested
 * against a fake generator without spawning the Claude Code binary.
 */
import {
  createSdkMcpServer,
  query,
  tool,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  type Options,
  type Query,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';

export interface SdkApi {
  query: (params: { prompt: AsyncIterable<SDKUserMessage>; options?: Options }) => Query;
  tool: typeof tool;
  createSdkMcpServer: typeof createSdkMcpServer;
  dynamicBoundary: string;
}

export const realSdk: SdkApi = {
  query,
  tool,
  createSdkMcpServer,
  dynamicBoundary: SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
};

export type { Options, Query, SDKUserMessage };
