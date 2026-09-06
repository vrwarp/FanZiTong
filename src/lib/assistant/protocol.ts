/**
 * The wire protocol between the app and the sidecar.
 *
 * Both ends parse with these schemas, so a version skew fails loudly at the
 * boundary instead of halfway through a turn. Frames are JSON text over one
 * WebSocket.
 */
import { z } from 'zod';
import { PROFILE_NAMES } from './profiles';

export const PROTOCOL_VERSION = 1;

/** Limits, enforced on both sides. */
export const LIMITS = {
  maxTextChars: 20_000,
  maxImages: 3,
  /** Base64 payload of one image. */
  maxImageBytes: 2_500_000,
  maxFrameBytes: 8_000_000,
  /** Frames kept per conversation for replay after a reconnect. */
  replayBuffer: 500,
} as const;

/** Close codes the sidecar uses; the app maps them to an explanation. */
export const CLOSE_CODES = {
  unauthorized: 4401,
  forbiddenOrigin: 4403,
  superseded: 4409,
  tooLarge: 4413,
  rateLimited: 4429,
  busy: 4503,
} as const;

// ---- content -------------------------------------------------------------

export const imageBlockSchema = z.object({
  type: z.literal('image'),
  source: z.object({
    type: z.literal('base64'),
    media_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    data: z.string().max(LIMITS.maxImageBytes),
  }),
});

export const textBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().max(LIMITS.maxTextChars),
});

export const contentBlockSchema = z.discriminatedUnion('type', [textBlockSchema, imageBlockSchema]);
export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const turnContentSchema = z.union([
  z.string().max(LIMITS.maxTextChars),
  z
    .array(contentBlockSchema)
    .min(1)
    .max(LIMITS.maxImages + 1),
]);

// ---- client → sidecar ----------------------------------------------------

export const helloSchema = z.object({
  type: z.literal('hello'),
  protocolVersion: z.number().int(),
  token: z.string().max(400),
  conversationId: z.string().uuid().optional(),
  /** Highest `seq` the client already has, so the sidecar can replay the rest. */
  lastSeq: z.number().int().nonnegative().optional(),
  app: z.object({
    buildId: z.string().max(60).optional(),
    /** The phone's own day and zone: "today" is a local idea. */
    localDate: z.string().max(20).optional(),
    timeZone: z.string().max(60).optional(),
  }),
});

export const turnSchema = z.object({
  type: z.literal('turn'),
  turnId: z.string().uuid(),
  content: turnContentSchema,
  profile: z.enum(PROFILE_NAMES).optional(),
  /** Rendered by the app, not the model: shown above the reply as "about 滷肉飯". */
  label: z.string().max(80).optional(),
});

export const noteSchema = z.object({
  type: z.literal('note'),
  text: z.string().max(2000),
});

export const rpcResultSchema = z.object({
  type: z.literal('rpc_result'),
  id: z.string(),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().max(2000).optional(),
});

export const permissionResultSchema = z.object({
  type: z.literal('permission_result'),
  id: z.string(),
  behavior: z.enum(['allow', 'deny']),
  message: z.string().max(400).optional(),
});

export const clientFrameSchema = z.discriminatedUnion('type', [
  helloSchema,
  turnSchema,
  noteSchema,
  rpcResultSchema,
  permissionResultSchema,
  z.object({ type: z.literal('interrupt') }),
  z.object({ type: z.literal('new_conversation') }),
  z.object({ type: z.literal('ping') }),
]);
export type ClientFrame = z.infer<typeof clientFrameSchema>;

// ---- sidecar → client ----------------------------------------------------

export const accountSchema = z.object({
  email: z.string().optional(),
  organization: z.string().optional(),
  subscriptionType: z.string().optional(),
  source: z.string().optional(),
});
export type AssistantAccount = z.infer<typeof accountSchema>;

export const welcomeSchema = z.object({
  type: z.literal('welcome'),
  protocolVersion: z.number().int(),
  conversationId: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  /** Null when the client's lastSeq is older than the buffer: it must reset. */
  replayedFrom: z.number().int().nonnegative().nullable(),
  sidecar: z.object({
    version: z.string(),
    claudeCodeVersion: z.string().optional(),
    account: accountSchema.nullable(),
    authState: z.enum(['ok', 'unknown', 'needs_login']),
  }),
  models: z.array(z.object({ id: z.string(), label: z.string().optional() })).optional(),
});

const seqFields = { seq: z.number().int().nonnegative(), turnId: z.string().optional() };

export const serverFrameSchema = z.discriminatedUnion('type', [
  welcomeSchema,
  z.object({ type: z.literal('turn_started'), ...seqFields, conversationId: z.string() }),
  z.object({ type: z.literal('delta'), ...seqFields, text: z.string() }),
  z.object({
    type: z.literal('thinking'),
    ...seqFields,
    text: z.string(),
  }),
  z.object({
    type: z.literal('tool_started'),
    ...seqFields,
    callId: z.string(),
    tool: z.string(),
  }),
  z.object({
    type: z.literal('assistant_text'),
    ...seqFields,
    text: z.string(),
  }),
  z.object({
    type: z.literal('rpc'),
    ...seqFields,
    id: z.string(),
    method: z.string(),
    input: z.unknown(),
    timeoutMs: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('permission'),
    ...seqFields,
    id: z.string(),
    tool: z.string(),
    input: z.unknown(),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal('status'),
    ...seqFields,
    status: z.enum(['thinking', 'requesting', 'compacting', 'idle', 'running']),
  }),
  z.object({
    type: z.literal('result'),
    ...seqFields,
    ok: z.boolean(),
    text: z.string().optional(),
    costUsd: z.number().optional(),
    numTurns: z.number().int().optional(),
    durationMs: z.number().optional(),
    ttftMs: z.number().optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal('suggestion'),
    ...seqFields,
    text: z.string(),
  }),
  z.object({
    type: z.literal('notice'),
    ...seqFields,
    level: z.enum(['info', 'warning', 'error']),
    text: z.string(),
  }),
  z.object({ type: z.literal('pong'), ...seqFields }),
]);
export type ServerFrame = z.infer<typeof serverFrameSchema>;

export function parseClientFrame(raw: string): ClientFrame | null {
  try {
    const parsed = clientFrameSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseServerFrame(raw: string): ServerFrame | null {
  try {
    const parsed = serverFrameSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
