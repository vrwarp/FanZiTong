# The assistant

An optional helper that writes example sentences, suggests look-alike foils,
adds words on request, turns a photo of a menu into cards and talks through
what keeps slipping. It is off until you set it up, and the app works exactly
as before without it.

## Why there is a sidecar

The assistant runs on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk),
which spawns the Claude Code binary. That is what lets it authenticate with
**your existing Claude Code login instead of an API key** — and it is also why
it cannot run in the browser. So a small Node process (the "sidecar") holds the
login, and the app talks to it over one WebSocket.

The deck never goes to the sidecar. When the model calls a tool, the sidecar
forwards the call to whichever browser is connected; the app validates it,
writes it to IndexedDB and journals it. If the app is closed, the assistant has
nothing to work on.

```
 Browser (your deck, IndexedDB)              Sidecar (your Claude Code login)
  AssistantProvider  ── wss ──►  ws server ──►  query() ──► Claude Code
  executor + journal ◄── tool ──  in-process MCP tools are stubs that ask
                                  the browser to do the work
```

Anthropic does not allow third-party products to offer claude.ai login. This is
the personal-use shape of that: your machine, your login, your own devices. Do
not run it as a service for other people. If you want to share the app with
someone, they need their own sidecar and their own credentials.

## Setting it up

You need a machine that stays on and a domain pointed at it.

```bash
cd agent
cp .env.example .env      # set FZT_DOMAIN and FZT_ALLOWED_ORIGINS
docker compose up -d
```

Caddy gets a certificate for your domain on first start. The assistant's own
port is never published: Caddy is the only thing in front of it.

Then open the app on any device, put `wss://your-domain` into _Settings →
Assistant_, and press **Sign in with Claude**. It shows you a link; you approve
access on Claude's own site, copy the code it gives you, and paste it back. The
app stores the session that comes out of that and connects.

There is nothing else to configure, and nothing to run in the container by
hand.

### How the sign-in doubles as the lock

The assistant is on the public internet and spends your Claude subscription, so
it cannot be open to anyone who finds the address. Rather than inventing a
password, it uses the only credential that already matters:

- **The first sign-in claims it.** Whoever completes a Claude sign-in becomes
  the owner, and the account is recorded.
- **After that, only a signed-in device can start another sign-in.** Someone
  who finds the URL is turned away before any process is started.
- **A sign-in as a different account is refused.** Each attempt runs against a
  staging directory, and the credentials it produces are only promoted once the
  account matches the owner — so a stranger cannot replace your credentials
  even if they get that far.
- **Sessions last 30 days**, are stored as hashes rather than tokens, and can
  be ended from Settings.

The `claude auth login` flow drives cleanly over pipes: it prints the URL,
waits at a paste prompt, and exits 0 once the code is accepted. Success is
taken from that exit code and confirmed with `claude auth status`, not from
matching words in its output.

If you are locked out — every device signed out, or you want to hand the
assistant to another account — set `FZT_ALLOW_RECLAIM=true`, restart, sign in,
and turn it off again.

Sign-in attempts are rate limited per address, and at most three can be in
flight at once, because each one holds a running process.

### The session, the cookie, and why there are both

Completing the sign-in returns a session token and sets it as an `HttpOnly`
cookie. The app keeps the token as well and sends it when it opens the socket.

Both exist because they cover different deployments: the cookie is the better
mechanism when the app and the assistant share a site, but the app is usually
served from somewhere else entirely (GitHub Pages), which makes it a
third-party cookie — and Safari refuses those outright. The token always works,
so it is what the socket actually relies on.

### An assistant you supply credentials to

If you would rather give the container a credential than sign in through the
app — `claude setup-token` prints one that lasts a year — set
`CLAUDE_CODE_OAUTH_TOKEN`. There is then no sign-in to establish who owns the
assistant, so `FZT_AGENT_TOKEN` is required too and the app asks for it instead.
The sidecar refuses to start on a public address with one and not the other.

## What it can do

| Where                   | What                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Card editor             | _Fill in_ writes the missing sentence, reading, translation and foils for the card you are editing.                                   |
| Study, after you reveal | _Why this?_ explains the shape and gives you something to hold on to. Hidden while the card is still face down.                       |
| Anywhere                | The ✨ button opens a conversation: ask for words, fixes, or an explanation. Attach a photo of a menu and it reads the dishes off it. |
| Settings                | Pairing, connection status and the last ten changes it made, each with an undo.                                                       |

Everything it writes is applied straight away and journaled, so any batch can
be undone from the transcript or from Settings. Undoing a text change keeps the
scheduling you have built up: your review history is never rolled back.

## What stops it writing nonsense

Every card it proposes goes through `src/lib/assistant/validateCard.ts`, which
is the same code the card editor uses and which the starter deck is tested
against. A card is rejected, with the reason handed back to the model, when it

- uses a simplified character in the headword, sentence, variants or
  distractors (`src/data/simplifiedChars.ts`, generated from OpenCC with the
  Taiwan-standard forms 群, 痴, 秘 allowed);
- has pinyin without tone marks, or a syllable count that does not match the
  characters;
- has a definition shorter than 3 or longer than 60 characters, or one that
  smuggles a reading into the meaning;
- has an example sentence that does not contain the word, or a sentence reading
  that does not line up with it word by word;
- offers a foil that is a real way of writing the word, a different length from
  it, or an accepted spelling of another card;
- writes `spoken` in POJ rather than Tâi-lô;
- duplicates a word already in the deck, or another card in the same batch.

Foils are deliberately allowed to be simplified characters: a wrong-but-plausible
shape is the point of that drill, and the deck ships several.

## The reading is never leaked early

The rule the whole app is built on is that pinyin does not appear beside a
character you are being asked to read. The assistant is held to it:

- While a study card is unrevealed the ✨ button is not rendered and the panel
  is closed.
- `study_context` returns only that a session is running. The card, its reading
  and its meaning are withheld until you reveal it.
- The panel is a dialog outside the card, so nothing it renders can appear
  inside the prompt or trip the tap-to-reveal handler.

## The sign-in endpoints

Alongside the socket the sidecar answers a handful of HTTP routes, all of them
restricted to the origins in `FZT_ALLOWED_ORIGINS`:

| Route               | What it does                                                           |
| ------------------- | ---------------------------------------------------------------------- |
| `GET /healthz`      | The process is up. No origin required, for the container's own check.  |
| `GET /readyz`       | Claude Code has usable credentials.                                    |
| `GET /auth/state`   | Claimed or not, signed in or not, and whether this device may sign in. |
| `POST /auth/start`  | Starts a sign-in and returns the link to open.                         |
| `POST /auth/code`   | Hands back the pasted code; returns a session and sets the cookie.     |
| `POST /auth/cancel` | Abandons a half-finished sign-in.                                      |
| `POST /auth/logout` | Ends this device's session.                                            |

## The wire protocol

JSON frames over one socket, defined and validated by
`src/lib/assistant/protocol.ts` on both sides.

The app opens with `hello` carrying its session token, the conversation id and
the last frame it saw. The sidecar checks the origin against its allowlist and
the token in constant time, then answers `welcome`.

Every frame the sidecar sends carries a sequence number and is kept in a
500-frame ring. When a phone locks, its socket dies but the turn does not: the
sidecar holds the conversation for three minutes, queues any tool call it
cannot deliver, and replays what was missed when the app reconnects with a
`lastSeq`. Past that grace it closes the subprocess; the transcript is on disk,
so the next question resumes the same conversation.

Frames: `turn`, `note`, `rpc_result`, `interrupt`, `new_conversation`, `ping`
from the app; `welcome`, `turn_started`, `delta`, `thinking`, `tool_started`,
`rpc`, `status`, `result`, `suggestion`, `notice`, `pong` back.

## Keeping it quick

Model turns take seconds, and each tool call is another round trip to a phone.
What the code does about it:

- **One warm subprocess per conversation.** Turns are pushed into a live
  `query()` rather than spawning Claude Code each time.
- **A cacheable prompt.** The style guide and format rules sit in front of
  `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`, so they are billed once and cached for an
  hour; only today's date and the deck size go after it.
- **Context injected, not fetched.** A `UserPromptSubmit` hook attaches what
  you are looking at, so a single-card edit is one model turn plus one write
  rather than a search first.
- **Profiles.** Single-card work runs on Sonnet at low effort; audits, photo
  import and coaching run on Opus.
- **Streaming everywhere.** Text appears as it is written, tool activity shows
  the moment a call starts, and nothing in the app ever waits on a reply.

The sidecar logs `ttft` and duration per turn, so slow paths are measurable
rather than guessed at.

## Configuration

| Variable                    | Default            | What it does                                                              |
| --------------------------- | ------------------ | ------------------------------------------------------------------------- |
| `FZT_AGENT_HOST`            | `127.0.0.1`        | Bind address; `0.0.0.0` in the container.                                 |
| `FZT_AGENT_PORT`            | `8787`             | Port.                                                                     |
| `FZT_AGENT_TOKEN`           | none               | Fixed token, only for an assistant that is not signed in through the app. |
| `FZT_ALLOW_RECLAIM`         | `false`            | Let a sign-in take a claimed assistant over.                              |
| `FZT_AGENT_STATE_DIR`       | beside credentials | Sessions, ownership and staged sign-ins.                                  |
| `FZT_ALLOWED_ORIGINS`       | localhost          | Exact origins allowed to open a socket or sign in.                        |
| `FZT_AGENT_MAX_SESSIONS`    | `3`                | Live conversations, and so subprocesses.                                  |
| `FZT_AGENT_IDLE_TIMEOUT_MS` | `600000`           | Close a quiet conversation.                                               |
| `FZT_AGENT_DETACH_GRACE_MS` | `180000`           | How long a locked phone keeps its turn.                                   |
| `FZT_AGENT_RPC_TIMEOUT_MS`  | `60000`            | How long a tool call waits for the app.                                   |
| `FZT_AGENT_MAX_BUDGET_USD`  | none               | Optional per-turn spend cap.                                              |
| `CLAUDE_CODE_OAUTH_TOKEN`   | none               | Operator-supplied credential; needs `FZT_AGENT_TOKEN` too.                |
| `CLAUDE_CONFIG_DIR`         | `/data/claude`     | Where credentials and transcripts live.                                   |

## What the model cannot do

The sidecar starts the session with `tools: []`, so none of Claude Code's own
tools exist: no shell, no file access, no web fetch. The only things it can
call are the deck tools, every one of which is answered by your browser. It
also runs with `settingSources: []`, so nothing in your own Claude Code
configuration reaches it. Deleting and merging are not auto-approved.
