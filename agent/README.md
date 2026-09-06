# 繁字通 assistant sidecar

Runs the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk) so the
app can have an assistant without an API key: the SDK spawns Claude Code, which
authenticates with your own login.

The deck never comes here. Every tool the model calls is forwarded to whichever
browser is connected, which validates it, applies it to IndexedDB and journals
it so you can undo it.

Setup, hosting recipes and the wire protocol: [`../docs/assistant.md`](../docs/assistant.md).

```bash
npm install          # once
npm run dev          # http://127.0.0.1:8787, uses your own Claude Code login
npm run validate     # typecheck, tests, bundle
```

Anthropic does not allow third-party products to offer claude.ai login. This is
the personal-use shape of that rule: your machine, your login, your devices.
Do not expose it to other people.
