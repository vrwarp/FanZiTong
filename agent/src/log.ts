/** Minimal leveled logging that never prints a credential or a card. */
const ORDER = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof ORDER;

const SECRET = /(token|authorization|credential|api[-_]?key)/i;

function scrub(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET.test(key) ? '[redacted]' : item;
  }
  return out;
}

export function createLogger(level: LogLevel = 'info') {
  const min = ORDER[level] ?? ORDER.info;
  const write = (at: LogLevel, message: string, data?: unknown) => {
    if (ORDER[at] < min) return;
    const line = `[${new Date().toISOString()}] ${at} ${message}`;
    const payload = data === undefined ? '' : ` ${JSON.stringify(scrub(data))}`;
    if (at === 'error') console.error(line + payload);
    else if (at === 'warn') console.warn(line + payload);
    else console.log(line + payload);
  };
  return {
    debug: (m: string, d?: unknown) => write('debug', m, d),
    info: (m: string, d?: unknown) => write('info', m, d),
    warn: (m: string, d?: unknown) => write('warn', m, d),
    error: (m: string, d?: unknown) => write('error', m, d),
  };
}

export type Logger = ReturnType<typeof createLogger>;
