# AI Backend

A FastAPI front-door (`api`) running on a private server, exposed to the
app through a Cloudflare Tunnel. The host has no inbound ports open and
no public DNS record — only an outbound connection to Cloudflare. The
tunnel hostname itself is publicly reachable; access control on the
endpoint is enforced inside `api` (rate limits, input validation),
not at Cloudflare's edge.

The API talks to its LLM provider via the OpenAI-compatible endpoint
configured in `env_llm` (default: Cloudflare Workers AI through AI
Gateway). A local Ollama service is also included for when you want to
run local models, or have a local Ollama proxy cloud calls — but it's
not on the default path.

Request count is tracked in Redis as rolling 24-hour sums and capped
both globally (`MAX_REQUESTS_GLOBALLY_PER_DAY`, default 100) and per caller
(`MAX_REQUESTS_PER_USER_PER_DAY`, default 50). The caller is identified
by source IP today (always hashed before going to Redis). Over-cap
calls are rejected with HTTP 429 before reaching the LLM.

The on-disk state is just the Redis append-only file (in the
`redis_data` volume), the cache of any locally-stored models (in the
`models` volume), and — only if the local Ollama is in use — its
ed25519 keypair for cloud auth.

## Architecture

```
App
   │ HTTPS
   ▼
Cloudflare edge ──tunnel──▶ cloudflared ──▶ api:8000 ──▶ CF AI Gateway ──▶ Workers AI
                                              │
                                              ├─▶ redis:6379 (rolling 24h counter)
                                              │
                                              └─▶ ollama:11434 (optional path)
```

## Services

- `cloudflared` — outbound-only connection to Cloudflare; routes
  incoming tunnel requests to the right internal service.
- `api` — FastAPI service handling the public endpoints. Calls any
  OpenAI-compatible LLM provider (Cloudflare Workers AI via Gateway by
  default, plus commented examples for direct Workers AI, Ollama
  Cloud, local Ollama, and OpenAI). Configurable via `OPENAI_BASE_URL`
  / `OPENAI_API_KEY` / `MODEL`. Enforces global and per-user rolling
  24-hour request caps stored in Redis.
- `redis` — Redis 7 with append-only file persistence. Holds the
  hourly `/bio/` request buckets that the rolling-window cap reads
  from, so the cap survives restarts.
- `ollama` *(optional in concept)* — local Ollama instance. Useful for
  local-only models, or for letting a local Ollama proxy cloud calls
  with its own ed25519 auth. Default deployments don't route through
  it, but it starts with the rest of the stack.
- `ollama-pull` *(optional in concept)* — one-shot job that registers
  the configured models on the local Ollama at startup. Only relevant
  when the `api` is pointed at the local Ollama, or for separate local
  testing. Harmless when unused.

## Cloudflare configuration (one-time, in the dashboard)

1. **Domain on Cloudflare.** The hostname you expose (for example
   `ai.example.com`) must live in a Cloudflare-managed DNS zone. If the
   domain isn't on Cloudflare yet, add it from the main dashboard and update
   its nameservers at the registrar. Existing records can be carried over
   with proxy disabled (grey cloud) so other services keep working
   unchanged.

2. **Create the tunnel.** Cloudflare dashboard → Networking → Tunnels →
   Create a tunnel → Cloudflared. Pick a name (for example `ai-backend`).
   On the install screen, copy the **tunnel token**; it goes into
   `env_tunnel` on the server later.

3. **Add a Published Application route.** While creating the tunnel (or
   editing it afterwards), choose route type **Published Application** and
   configure:
   - Subdomain: `ai` (or whatever you prefer)
   - Domain: the Cloudflare-managed zone
   - Path: empty
   - Service type: `HTTP`
   - URL: `api:8000` (point at `ollama:11434` only if you want raw
     access to Ollama for debugging)

   The hostname is now publicly reachable. There is no Cloudflare
   Access policy in front of it — `api`'s own rate limits are the
   only abuse defence on the endpoint. This is a deliberate choice
   for a frontend-direct architecture where the app can't safely
   hold a service-token secret (it would leak through the browser).

## Server deployment

Prerequisites: a server with Docker and Docker Compose pre-installed (out
of scope for this document), SSH access, and a firewall blocking all
inbound traffic except SSH. The tunnel is outbound only, so no other
inbound ports need to be open.

Clone the repository and configure secrets:

```bash
git clone https://github.com/nolar/mmmotivator.git
cd mmmotivator/ai
cp env_tunnel.example env_tunnel
chmod 600 env_tunnel
```

Edit `env_tunnel` and set `TUNNEL_TOKEN` to the value from the Cloudflare dashboard.

Configure how the `api` service reaches its LLM provider:

```bash
cp env_llm.example env_llm
chmod 600 env_llm
```

Edit `env_llm`. By default it points at Ollama Cloud and expects an API
key issued at <https://ollama.com/settings/keys> in `OPENAI_API_KEY`
(read directly by the OpenAI Python SDK). The same file ships commented
alternative blocks for the local Ollama service, OpenAI proper, and
Cloudflare Workers AI — switching providers is just changing the
uncommented block.

If you also want the local Ollama in this stack to talk to Ollama Cloud
(only needed when the api routes through it), generate an ed25519
keypair and register the public half at
<https://ollama.com/settings/keys>:

```bash
./generate-keys.sh
```

Start the stack:

```bash
docker compose up -d
```

Verify locally:

```bash
docker compose ps
docker compose logs cloudflared
docker compose logs ollama-pull   # should show successful model pulls
```

Verify end-to-end from any machine. The `api`'s root endpoint returns
`Hello!`:

```bash
curl https://ai.example.com/
# expect: "Hello!"
```

Exercise the `/bio/` endpoint to confirm the upstream LLM auth is
wired up:

```bash
curl -X POST https://ai.example.com/bio/ \
  -H "Content-Type: text/plain" \
  --data "Born 1985 in Paris. Studied physics at MIT 2003-2007. Worked at Google 2008-2015. Founded a startup in 2016, ongoing."
# expect a JSON object with {"periods": [...]}
```

Or locally:

```bash
docker run -it --rm --network=mmmai_ollama curlimages/curl:latest curl -i -X POST http://api:8000/bio/  --data "Born 1985 in Paris. Studied physics at MIT 2003-2007. Worked at Google 2008-2015. Founded a startup in 2016, ongoing."
```

Authentication errors from the upstream LLM (502 with "Upstream error")
usually mean `OPENAI_API_KEY` in `env_llm` is missing, expired, or
doesn't match a key issued by the configured provider (for the default
Ollama Cloud, that's <https://ollama.com/settings/keys>).

If you also want to smoke-test the local Ollama directly, that path
remains:

```bash
docker compose exec -it ollama ollama run gemma4:31b-cloud
```

Exit the REPL with `/bye` or Ctrl-D.

## Updating

```bash
cd mmmotivator
git pull
cd ai
docker compose pull
docker compose up -d
```

## Maintenance

### Removing models

To free disk space or drop a model that's no longer needed, exec into the
running `ollama` container and run `ollama rm`:

```bash
docker compose exec ollama ollama rm gemma4:31b-cloud
```

The model is deleted from the `models` volume immediately. To stop it
being pulled again on the next stack start, also remove it from the
`command:` of the `ollama-pull` service in `compose.yaml`.

### Complete reset

`docker compose down` stops the stack but keeps the `models` volume — the
safe default. To wipe everything including the downloaded models, add
`--volumes`:

```bash
docker compose down --volumes
```

This deletes the `models` volume, so the next `docker compose up` re-pulls
every model from scratch. Useful when changing the storage layout or
recovering from a corrupted volume; not needed for routine restarts.

## Operational notes

- **Inference location.** By default the `api` calls Ollama Cloud
  directly with `OPENAI_API_KEY` against the OpenAI-compatible
  endpoint. Server CPU, RAM and disk usage stay near-zero regardless of
  request volume. To route through a different provider, edit
  `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `MODEL` in `env_llm`.
  `OLLAMA_KEEP_ALIVE` (on the local `ollama` service) is a no-op for
  cloud models; it starts mattering only if local-only models are in
  use.
- **Choosing the bio model.** `MODEL` in `env_llm` overrides the model
  used by `/bio/`. Default is `workers-ai/@cf/qwen/qwen3-30b-a3b-fp8`
  on Cloudflare Workers AI via AI Gateway. The `workers-ai/` prefix
  is required when going through the Gateway; calling Workers AI
  directly (the alternative block in `env_llm.example`) takes the
  bare `@cf/...` form.
- **Hard cost caps (two layers, both rolling 24h).**
  1. **Global** — `MAX_REQUESTS_GLOBALLY_PER_DAY` (default `100`). Summed
     across hourly bucket keys `bio:count:<bucket>`, where
     `<bucket>` is the unix timestamp of the bucket's starting
     boundary (`floor(unix_time / 3600) * 3600`).
  2. **Per-user** — `MAX_REQUESTS_PER_USER_PER_DAY` (default `50`).
     Identifies the caller by source IP (CF-Connecting-IP from
     Cloudflare's edge, falling back to X-Forwarded-For, then the
     immediate sender). The identifier is **hashed** (BLAKE2b, 4
     bytes / 8 hex chars) before going to Redis, so plaintext IPs
     never appear in Redis dumps or scans. Bucket keys are
     `bio:user:<hash>:<bucket>`.

  Each request `INCR`s the current bucket of both counters and `MGET`s
  the last 24 buckets of each to compute the rolling sums. Over-cap
  requests get HTTP 429 before the LLM is touched. The per-user check
  triggers first, then the global check. The window slides
  continuously (no calendar reset). All bucket keys expire after 25
  hours — old data is pruned automatically. Persists across restarts
  (Redis AOF). **Redis-unreachable → fail closed**: the api returns
  HTTP 503 and refuses to call the LLM. Without the counter we can't
  bound spend, and an unbounded LLM bill is a worse failure than
  temporary unavailability.
- **Adjusting the caps.** Edit `MAX_REQUESTS_GLOBALLY_PER_DAY` and/or
  `MAX_REQUESTS_PER_USER_PER_DAY` in `env_llm` on the server, then
  `docker compose up -d api`.
- **Inspecting the bucket keys.**
  ```bash
  # Global keys
  docker compose exec redis redis-cli --scan --pattern 'bio:count:*'
  # Per-user keys (one prefix per caller, hashed)
  docker compose exec redis redis-cli --scan --pattern 'bio:user:*'
  ```
- **Input limits.** `/bio/` rejects bodies longer than 1024 characters
  with HTTP 413 before forwarding to Ollama, capping cost-per-request.
  Generation is also capped at ~2000 tokens.
- **Model storage.** `models` is a named Docker volume holding any
  *locally* stored models; cloud models leave nothing on disk. Inspect
  with `docker volume inspect mmmai_models`.
- **Changing pre-pulled models.** Edit the `command:` of `ollama-pull` in
  `compose.yaml`, then `docker compose up -d ollama-pull`. The
  service runs once and exits.
- **Debugging the tunnel.** `api`'s `GET /` endpoint returns `Hello!`
  and doesn't touch Redis or the LLM, so it doubles as a tunnel /
  cloudflared smoke test on its own — no separate test service is
  needed.
