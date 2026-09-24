# The sidecar holds the Claude Code login and runs the Agent SDK. The deck
# never reaches it: the browser answers every tool call over the socket.
FROM node:22-bookworm-slim AS build
WORKDIR /build

# Agent manifests first so a code change does not reinstall the SDK.
COPY agent/package.json agent/package-lock.json agent/.npmrc ./agent/
# The optional platform package carries the Claude Code binary: keep it.
RUN cd agent && npm ci

COPY agent ./agent
COPY src ./src
RUN cd agent && npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /build/agent/node_modules ./node_modules
COPY --from=build /build/agent/dist ./dist
COPY --from=build /build/agent/prompts ./prompts
COPY --from=build /build/agent/package.json ./package.json

# `claude auth login` / `claude auth status` inside the container use the same
# binary the SDK spawns. It ships in a per-platform package
# (@anthropic-ai/claude-agent-sdk-linux-{x64,arm64}[-musl]), so the path is
# found rather than assumed — and the build fails if it is missing, because
# signing in inside the container depends on it.
#
# npm installs both the glibc and the musl package for the architecture, and
# a musl binary on this glibc image is a file that exists, is executable, and
# says "not found" when run, because its loader is not here. So the musl
# package is skipped, and the binary is run — not merely found — before it
# is installed as the command.
RUN set -eu; \
  binary="$(find /app/node_modules/@anthropic-ai -maxdepth 2 \
    \( -type d -name '*-musl' -prune \) -o \( -type f -name claude -perm -u+x -print \) \
    | head -n1)"; \
  test -n "$binary"; \
  "$binary" --version; \
  ln -sf "$binary" /usr/local/bin/claude; \
  claude --version

# Credentials and session transcripts share one volume, so a container restart
# keeps the learner signed in.
ENV CLAUDE_CONFIG_DIR=/data/claude \
    FZT_AGENT_HOST=0.0.0.0 \
    FZT_AGENT_PORT=8787 \
    FZT_AGENT_WORKSPACE=/data/workspace \
    ENABLE_PROMPT_CACHING_1H=1 \
    NODE_ENV=production
RUN mkdir -p /data/claude /data/workspace && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.FZT_AGENT_PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.mjs"]
