
# Discord Bot MVP — Gemini Flash + AWS Lambda (TypeScript, CDK)

This repo is a **steering document + skeleton** to ship an MVP Discord bot:
- **Slash commands**: `/ask question:<text> [private:true]`, `/help`
- **Infra**: AWS **Lambda** + **API Gateway (HTTP API)** + **Secrets Manager**
- **Runtime**: TypeScript on Node.js 20
- **IaC**: AWS **CDK v2** (TypeScript)
- **Model**: Google **Gemini 1.5 Flash** via API key (placeholder client provided)

---

## MVP Scope

- `/ask question:<text>` → answer via Gemini Flash (public by default; add `private:true` for ephemeral).
- `/help` → short usage/help text.
- Interaction verification (Ed25519) on **every** request.
- Defer when work > 2s; send follow‑up webhook message.
- JSON logs, basic alarms; no DB, no VPC.

### Non-goals (MVP)
- No RAG, tools, memory, or file uploads.
- No per-guild config; single small guild.
- No provisioned concurrency (can add later).

---

## Architecture

**Discord** → HTTPS interaction webhook (**API Gateway HTTP API**) → **Lambda (`interactionsFn`)**  
→ verifies signature → routes commands → calls **Gemini** → responds (immediate or deferred follow-up).

**Secrets Manager** stores:
- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `GEMINI_API_KEY`

**CloudWatch** for logs/alarms.

(Optional) `registerCommandsFn`/script to register slash commands on deploy.

---

## CDK Design

**Stack**: `DiscordBotStack`
- `HttpApi` (POST `/discord/interactions`)
- `interactionsFn` (Node 20, 128–256MB, 10–15s timeout)
- Secrets in **AWS Secrets Manager** (referenced by name)
- IAM policy: read listed secrets only
- `LogGroup` (14–30 days retention)
- Alarm on high error rate/5xx from API

### Environment variables (example)
- `SECRETS_DISCORD_TOKEN_NAME`
- `SECRETS_DISCORD_PUBLIC_KEY_NAME`
- `SECRETS_GEMINI_API_KEY_NAME`
- `MODEL_ID=gemini-1.5-flash`
- `RESPONSE_MAX_TOKENS=1024`
- `TIMEOUT_MS=9000`

---

## Discord Interaction Handling

- Validate `X-Signature-Ed25519` and `X-Signature-Timestamp` using your **Discord public key**.
- Respond types:
  - **4**: `CHANNEL_MESSAGE_WITH_SOURCE` (immediate).
  - **5**: `DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE` (then follow-up via webhook).
- Ephemeral: set `flags=64` in `data`.

---

## Observability & Security

- JSON logs: `requestId`, `guildId`, `command`, `latencyMs`, `status`, `errorCode`.
- Don’t log user content; log lengths/hashes only.
- Strict input length caps; truncate long prompts with a notice.
- Timeouts on outbound calls to Gemini; single retry max.
- Least-privilege IAM; no secrets in code.

---

## Project Layout

```
/infra
  bin/discord-bot.ts
  lib/discord-bot-stack.ts
  package.json
  tsconfig.json
/runtime
  src/handlers/interactions.ts
  src/discord/verify.ts
  src/discord/types.ts
  src/gemini/client.ts
  package.json
/scripts
  register-commands.ts
README.md
```

---

## Quickstart

1) **Install CDK deps**
```bash
cd infra
npm i
```

2) **Bootstrap & deploy**
```bash
# First time in your account/region:
npx cdk bootstrap

# Deploy the stack:
npx cdk deploy --require-approval never
```

3) **Secrets**
Create three secrets in **AWS Secrets Manager**:
- `DISCORD_BOT_TOKEN`
- `DISCORD_PUBLIC_KEY`
- `GEMINI_API_KEY`

Update the **environment variables** in `lib/discord-bot-stack.ts` to the corresponding **secret names**.

4) **Discord endpoint**
- In the Discord Developer Portal, set **Interactions Endpoint URL** to the API Gateway invoke URL shown in the CDK outputs + `/discord/interactions`.
- Put the **public key** into Secrets Manager (`DISCORD_PUBLIC_KEY`).

5) **Register slash commands**
- Use `scripts/register-commands.ts` once (or turn it into a custom resource).

---

## Acceptance Criteria

- `/help` responds within 2s (ephemeral).
- `/ask` returns a useful answer; defers when needed.
- Signatures verified; invalid requests rejected.
- No hardcoded secrets; Lambda reads from Secrets Manager.
- P95 non-deferred Lambda duration < 1500ms.
- Error rate < 2%/day (excl. invalid signatures).

---

## Backlog (Post-MVP)

- Options for temperature/length.
- Per-guild config/allow-lists.
- Rate limits/quotas.
- Tracing (X-Ray) and canary env.
- Provisioned concurrency if cold starts bother you.
