# 繁字通 assistant sidecar

Runs the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk) so the
app can have an assistant without an API key: the SDK spawns Claude Code, which
authenticates with your own login.

The deck never comes here. Every tool the model calls is forwarded to whichever
browser is connected, which validates it, applies it to IndexedDB and journals
it so you can undo it.

Setup, hosting recipes and the wire protocol: [`../docs/assistant.md`](../docs/assistant.md).

```bash
npm ci --prefix ..   # the app's install too: see below
npm install          # once
npm run dev          # http://127.0.0.1:8787, uses your own Claude Code login
npm run validate     # typecheck, tests, bundle
```

Its own lockfile exists so the app's install never pulls the SDK's bundled
Claude Code binaries. The dependency runs the other way, though: the validator
and the wire protocol live in `../src`, and a file there declares its
dependencies — zod — in the app's `package.json`. Module resolution only walks
up, so `../src` can never see `agent/node_modules`. Type-checking and testing
the sidecar therefore need the app installed as well. Only the bundle is
standalone: `--packages=external` leaves those imports to be resolved from
`dist/`, which is why the image ships without `../src` or the app's modules.

Anthropic does not allow third-party products to offer claude.ai login. This is
the personal-use shape of that rule: your machine, your login, your devices.
Do not expose it to other people.
