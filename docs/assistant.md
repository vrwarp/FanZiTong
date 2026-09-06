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

## Setting it up with Docker

```bash
cd agent
cp .env.example .env          # fill in FZT_AGENT_TOKEN and FZT_ALLOWED_ORIGINS
docker compose --profile tailscale up -d
```

**Credentials.** Either is fine:

- On a machine where you are already signed in, run `claude setup-token`. It
  prints a one-year OAuth token tied to your subscription, meant for scripts.
  Put it in `.env` as `CLAUDE_CODE_OAUTH_TOKEN`.
- Or sign in inside the container once:
  `docker compose exec -it agent claude auth login`. It prints a URL; the
  browser shows a code you paste back, which is the documented path for
  containers and SSH. The login is kept in the `claude-data` volume, because
  `CLAUDE_CONFIG_DIR=/data/claude` moves credentials there along with the
  session transcripts.

Do not set `ANTHROPIC_API_KEY` unless you mean to bill the API: it outranks the
subscription login.

**Reaching it from a phone.** The app is served over https, so the socket must
be `wss://`; the agent port is never published on its own.

- `--profile tailscale` runs the official Tailscale container beside it and
  serves `https://fanzitong-agent.<your-tailnet>.ts.net` with a real
  certificate. Install Tailscale on the phone and nothing is exposed publicly.
  Put your `TS_AUTHKEY` in `.env`.
- `--profile caddy` is for a public domain. Edit `Caddyfile`, point DNS at the
  host, and the pairing token becomes the only thing standing between the
  internet and the sidecar — so make it long.

**Pairing the app.** Open Settings on the phone, enter the address and the
token, and press _Save & connect_. The status line shows the account it is
signed in as.

Updating: `docker compose pull && docker compose up -d`. The image is
`docker.io/vrwarp/fanzitong-agent`, built for x86-64 and ARM64 by
`.github/workflows/agent-image.yml`; point `FZT_AGENT_IMAGE` at your own
namespace if you publish it yourself.

### Publishing the image yourself

The workflow builds the image on every pull request that touches the sidecar —
starting the container and checking it answers `/healthz`, without pushing
anything — and publishes to Docker Hub on a push to `main`. To publish under
your own account, add two settings under _Settings → Secrets and variables →
Actions_:

- `DOCKERHUB_TOKEN` (secret): an access token from
  [Docker Hub](https://app.docker.com/settings/personal-access-tokens), with
  Read & Write scope.
- `DOCKERHUB_USERNAME` (variable): only if your Docker Hub account is not named
  after the GitHub owner.

Pull requests from forks never see those credentials, which is why the dry run
does not log in.

## Running it on your desktop instead

```bash
cd agent && npm install
npm run agent          # from the repo root; binds 127.0.0.1:8787
```

On loopback no token is needed, and `npm run dev` proxies `/agent` to it, so
the app finds it with no configuration at all. This is the same code the image
runs.

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

## The wire protocol

JSON frames over one socket, defined and validated by
`src/lib/assistant/protocol.ts` on both sides.

The app opens with `hello` carrying the pairing token, the conversation id and
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

| Variable                    | Default        | What it does                                      |
| --------------------------- | -------------- | ------------------------------------------------- |
| `FZT_AGENT_HOST`            | `127.0.0.1`    | Bind address; `0.0.0.0` in the container.         |
| `FZT_AGENT_PORT`            | `8787`         | Port.                                             |
| `FZT_AGENT_TOKEN`           | none           | Pairing token. Required unless bound to loopback. |
| `FZT_ALLOWED_ORIGINS`       | localhost      | Exact origins allowed to open a socket.           |
| `FZT_AGENT_MAX_SESSIONS`    | `3`            | Live conversations, and so subprocesses.          |
| `FZT_AGENT_IDLE_TIMEOUT_MS` | `600000`       | Close a quiet conversation.                       |
| `FZT_AGENT_DETACH_GRACE_MS` | `180000`       | How long a locked phone keeps its turn.           |
| `FZT_AGENT_RPC_TIMEOUT_MS`  | `60000`        | How long a tool call waits for the app.           |
| `FZT_AGENT_MAX_BUDGET_USD`  | none           | Optional per-turn spend cap.                      |
| `CLAUDE_CODE_OAUTH_TOKEN`   | none           | Long-lived token from `claude setup-token`.       |
| `CLAUDE_CONFIG_DIR`         | `/data/claude` | Where credentials and transcripts live.           |

## What the model cannot do

The sidecar starts the session with `tools: []`, so none of Claude Code's own
tools exist: no shell, no file access, no web fetch. The only things it can
call are the deck tools, every one of which is answered by your browser. It
also runs with `settingSources: []`, so nothing in your own Claude Code
configuration reaches it. Deleting and merging are not auto-approved.
