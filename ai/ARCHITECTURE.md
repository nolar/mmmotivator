# ai/ARCHITECTURE.md

Technical reference for the self-hosted AI backend. Covers the rationale and
constraints that shaped the design — things that won't be obvious from
`compose.yaml` or `README.md` alone.

## Purpose

Give the app server-side access to LLM inference with:

- The inference origin hidden (no public DNS record, no inbound ports).
- Cost bounded by application-level rate limits (per-IP and global) and
  by Cloudflare AI Gateway's edge-side rate limit, even though the
  endpoint itself is publicly callable.
- Cost predictability — flat-rate cloud inference instead of metered
  per-token API fees, when using `:cloud` tagged models.

The app calls the backend directly from the browser (frontend-direct).
There is **no Cloudflare Access policy** in front of the public
hostname: a service-token check there would require putting the secret
in client-side code, where it can't actually stay secret. Authentication
on the endpoint is therefore intentionally absent; the protection model
is "hidden origin + bounded cost via rate limits."

**Privacy boundary**: with `:cloud` model tags (the current default),
inference runs on Ollama Cloud, so prompt content is visible to Cloudflare
*and* Ollama. Earlier iterations of the design assumed local-only
inference and avoided third-party API exposure; the cloud-model decision
trades that property away in exchange for not needing GPU hardware on the
server. Local-only inference is still possible — just use models without
the `:cloud` suffix.

## Architecture

```
App (browser, frontend-direct)
   │ HTTPS
   ▼
Cloudflare edge (publicly reachable; no Access policy)
   │ tunnel
   ▼
cloudflared on host
   │ HTTP (internal docker network)
   ▼
api:8000 (FastAPI)
   │
   ├─▶ redis:6379 — two rolling 24h counters sharded into hourly
   │     buckets (INCR current, MGET 24 latest, SUM): a global one
   │     (MAX_REQUESTS_GLOBALLY_PER_DAY) and a per-user one keyed by the hashed
   │     caller identifier (MAX_REQUESTS_PER_USER_PER_DAY). Persists
   │     via AOF in mmmai_redis_data.
   │
   │ openai Python SDK (async, OpenAI-compatible API)
   ▼
   ├─▶ CF AI Gateway — default; OPENAI_BASE_URL points at the gateway
   │     URL; gateway forwards to Workers AI; rate limits, observability,
   │     optional caching configured at the Gateway, not in the app.
   │
   ├─▶ Workers AI directly, Ollama Cloud, OpenAI proper, or any other
   │     OpenAI-compat provider (just edit env_llm; commented examples
   │     shipped).
   │
   └─▶ ollama:11434 (local) — when OPENAI_BASE_URL=http://ollama:11434/v1
            │
            ├─▶ Ollama Cloud (uses ed25519 keypair on the local container)
            └─▶ local model from the models volume (no external traffic)
```

The Cloudflare-tunnel route points at `api:8000`; the `api` service is
the public surface. The local `ollama` and `ollama-pull` services start
with the rest of the stack but are off the default path — they only
participate when the api is configured to route through the local
Ollama (or when used directly for ad-hoc smoke testing via
`docker compose exec`).

- The server host has **no inbound ports open** and **no public DNS
  record** pointing at it. Only `cloudflared` keeps an outbound persistent
  connection to Cloudflare.
- The public tunnel hostname is reachable by anyone who finds it —
  there is no Access policy. Cost is bounded by `api`'s rate limits
  (per-IP and global, both rolling 24h, fail-closed on Redis outage)
  and by AI Gateway's edge-side rate limit. A scanner finding the URL
  can call it up to the per-IP cap; the global cap backstops broader
  abuse.
- TLS is terminated at Cloudflare. **Cloudflare can technically read
  prompts and responses on its edge** — this trade-off was accepted in
  exchange for CF's hidden-origin / DDoS-absorption / cert-management
  benefits. If that becomes unacceptable, the documented fallback is
  Tailscale; see [Rejected alternatives](#rejected-alternatives).

## Stack components

Stack lives entirely in `ai/compose.yaml`. The compose project name is set
explicitly to `mmmai` via the top-level `name:` field, so volumes and
networks are namespaced as `mmmai_models` / `mmmai_ollama` (independent
of whichever directory `docker compose` is invoked from).

- **`cloudflared`** — `cloudflare/cloudflared:latest`. Outbound-only
  tunnel daemon. Reads `TUNNEL_TOKEN` from `env_tunnel` via `env_file:`
  (deliberately explicit; project-level `.env` auto-loading is not used).
- **`api`** — built from `ai/api/`. FastAPI app on port 8000 using
  Python 3.14-slim. Dependencies declared in `pyproject.toml`, locked
  in a checked-in `uv.lock` for reproducible builds. The Dockerfile
  installs them with `uv sync --frozen --no-install-project` (no
  `requirements.txt`). All endpoints async; the upstream LLM call uses
  the official `openai` Python SDK's `AsyncOpenAI` against an
  OpenAI-compatible endpoint, so the same code works with CF AI
  Gateway, Workers AI, Ollama Cloud, OpenAI proper, Groq, and other
  providers exposing the same API.

  Quota enforcement: two rolling 24-hour sums, sharded across hourly
  bucket keys. The bucket id is the unix timestamp of the bucket's
  starting boundary —
  `floor(unix_time / GRANULARITY_SECONDS) * GRANULARITY_SECONDS` —
  with `GRANULARITY_SECONDS = 3600` (constants in `main.py`). The
  bucket id format is human-readable when scanning Redis: each key
  carries its own clock, and you can match a key to a wall-clock
  hour by feeding the suffix to `date -u -d @<bucket>`.

  - **Global**: keys `bio:count:<bucket>`, summed against
    `MAX_REQUESTS_GLOBALLY_PER_DAY`.
  - **Per-user**: keys `bio:user:<hash>:<bucket>`, summed against
    `MAX_REQUESTS_PER_USER_PER_DAY`. The caller is identified by
    `CF-Connecting-IP` (set by Cloudflare's edge), falling back to
    `X-Forwarded-For` first hop, then the immediate sender. The
    identifier is **hashed** (BLAKE2b, 4-byte / 8-hex-char digest)
    before any Redis interaction — plaintext identifiers never reach
    Redis. The
    identifier extraction is isolated in
    `_user_key_from_request()`, so swapping IP for an auth token or
    account id later is a one-function change.

  On each `/bio/` call the api `INCR`s both current buckets,
  refreshes both TTLs to `KEY_TTL_SECONDS = 25h`, then `MGET`s the
  most recent `WINDOW_BUCKETS = 24` keys for each window and sums
  them. Per-user check fires first, then global. If either sum
  exceeds its cap, returns HTTP 429 *without* hitting the LLM. The
  window slides continuously — no calendar reset. The TTL is
  intentionally a bit larger than the window so the oldest bucket
  in any sum is still alive. **Redis-down → fail closed**: the api
  returns HTTP 503 and refuses to invoke the LLM. The decision was
  changed deliberately: an LLM bill leaked during a Redis outage is
  worse than the api being temporarily unavailable, since the cap is
  the only spend control on this path.

  Endpoints:
  - `GET /` — returns `"Hello!"`. Doubles as the tunnel/Access health
    check from outside.
  - `POST /bio/` — accepts a raw text bio (≤ `MAX_INPUT_CHARS = 1024`),
    sends it through a system prompt that asks for a strict
    JSON-schema-conformant list of `LifePeriod` records, caps generation
    at `MAX_OUTPUT_TOKENS = 2000`. Output validated by Pydantic; on
    schema mismatch the call returns 502 (fail-closed, prompt-injection
    containment).

  `env_file: env_llm` injects (read directly by the OpenAI SDK):
  - `OPENAI_BASE_URL` — provider endpoint. Default points at a CF AI
    Gateway URL routed to Workers AI; commented blocks in
    `env_llm.example` show direct Workers AI, Ollama Cloud, local
    Ollama, and OpenAI alternatives.
  - `OPENAI_API_KEY` — bearer token for the chosen provider. For CF
    Workers AI / Gateway, a CF API token with the "Workers AI"
    permission.
  - `MODEL` — model identifier (default
    `workers-ai/@cf/qwen/qwen3-30b-a3b-fp8` for the Gateway path;
    drop the `workers-ai/` prefix when calling Workers AI directly).
    Valid values depend on the configured provider.

  `env_file: env_llm` also provides:
  - `MAX_REQUESTS_GLOBALLY_PER_DAY` — global cap on `/bio/` calls across a
    rolling 24-hour window (default `100`).
  - `MAX_REQUESTS_PER_USER_PER_DAY` — per-caller cap across the same
    window (default `50`). The caller identifier is hashed before
    Redis sees it.
  - `ALLOWED_ORIGINS` — comma-separated browser origins allowed by
    `CORSMiddleware`. Empty default blocks all browsers; non-browser
    callers (curl, server-to-server) are unaffected since they don't
    send `Origin`. This effectively doubles as the Origin allow-list
    that prevents another site from piggybacking on a visitor's
    per-IP quota.

  Treated as deployment artefacts like the LLM credentials so they
  can be tuned per environment.

  `compose.yaml` injects via `environment:` (internal docker network
  config, not deployment-tunable):
  - `REDIS_URL` — `redis://redis:6379` (the in-stack Redis service).
- **`ollama`** *(off the default path)* — `ollama/ollama:latest`.
  Starts with the stack but is only reached when the `api`'s
  `api`'s `OPENAI_BASE_URL` is pointed at it, or when used directly
  via `docker compose exec`. Acts as proxy to Ollama Cloud for
  `:cloud` model tags, or as a local inference server for non-cloud
  models.
  CPU-only (no GPU device requests). `OLLAMA_MODELS=/models` redirects
  local model storage to a named Docker volume.
  `OLLAMA_KEEP_ALIVE=1h` only matters for local models. Healthcheck
  uses `ollama list`. Cloud auth via ed25519 keypair: `id_ed25519` and
  `id_ed25519.pub` bind-mounted into `/root/.ollama/`. The public key
  must be registered at <https://ollama.com/settings/keys>.
- **`ollama-pull`** *(off the default path)* — pre-registers the
  configured models on the local Ollama at `compose up`. Uses
  `curlimages/curl` and calls Ollama's HTTP `/api/pull` endpoint
  **deliberately, not the `ollama` CLI** (see gotcha below). Only
  meaningful when local Ollama is in use. `restart: "no"` so it
  doesn't loop after success.
- **`redis`** — `redis:7-alpine` with append-only file persistence
  (`--appendonly yes`). Holds the monthly `/bio/` request counter so
  the cap survives container restarts. Exposed only on the docker
  network (no host port). Persists in the `redis_data` named volume
  (host path `mmmai_redis_data`). Healthcheck via `redis-cli ping`.
  The api's `depends_on: redis: condition: service_healthy` ensures
  the api doesn't start before Redis is ready.

All services share a custom network named `ollama` (the user preferred
this over a generic `internal` name).

## Models pre-pulled

`qwen3.5:397b-cloud` and `gemma4:31b-cloud` are registered on the local
Ollama by `ollama-pull`. Only relevant when the local Ollama is in use;
they're a no-op in the default cloud-direct path. The user confirmed
these names manually — do not second-guess or substitute. If they ever
fail to pull or authenticate, surface the error and ask for
confirmation rather than swap to a different tag.

## Ollama Cloud authentication

There are two authentication paths to Ollama Cloud, used by different
services:

- **`api` service → upstream provider (default: Ollama Cloud).** Uses
  an account-bound **API key** passed as `Authorization: Bearer <key>`
  by the OpenAI SDK. The key is read from `OPENAI_API_KEY` in
  `env_llm`. This is the simpler, headless mechanism — no SSH-key
  management on the deployment host. Issuing/rotating keys is provider
  side: <https://ollama.com/settings/keys> for Ollama Cloud,
  <https://platform.openai.com/api-keys> for OpenAI proper, etc.
- **Local `ollama` service → Ollama Cloud (only when api routes
  through it, or for direct `compose exec` smoke tests).** Uses
  **ed25519 keypair** auth: `id_ed25519` / `id_ed25519.pub` bind-mounted
  into the container's `/root/.ollama/`. The public half must be
  registered at <https://ollama.com/settings/keys>.

Both API keys and SSH keys are issued from
<https://ollama.com/settings/keys>. They're separate credentials —
having one doesn't grant the other.

`env_llm`, `id_ed25519`, and `id_ed25519.pub` are all gitignored.
They're deployment-host artefacts, not source.

## LLM provider switch

`OPENAI_BASE_URL` / `OPENAI_API_KEY` / `MODEL` in `env_llm` select the
upstream the `api` calls. Anything that exposes an OpenAI-compatible
chat-completions endpoint will work; the same code path covers all of
them.

`env_llm.example` ships configuration blocks for:

- **CF Workers AI via AI Gateway** (default) — gateway URL
  `https://gateway.ai.cloudflare.com/v1/<account_id>/<gateway_id>/workers-ai/v1`,
  Cloudflare API token, models like
  `workers-ai/@cf/qwen/qwen3-30b-a3b-fp8`. The `workers-ai/` prefix
  is how the Gateway's compat endpoint identifies the upstream
  provider. The Gateway adds rate-limit caps, per-request
  observability, and optional response caching, configured at the
  Gateway itself rather than in the app.
- **CF Workers AI direct** (no Gateway) — account-scoped URL
  `https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/v1`,
  same model catalog but **without the `workers-ai/` prefix** on the
  model id (e.g. `@cf/qwen/qwen3-30b-a3b-fp8`). Skips the
  Gateway-side features.
- **Ollama Cloud** — `https://ollama.com/v1`, account-bound
  API key, huge models like `gemma4:31b-cloud` or
  `qwen3.5:397b-cloud`. Not supported by AI Gateway.
- **Local Ollama** in this stack — `http://ollama:11434/v1`, any
  non-empty `OPENAI_API_KEY` (the SDK rejects an empty one). The
  local Ollama's own auth (ed25519) governs *its* upstream calls.
- **OpenAI proper** — `https://api.openai.com/v1`, `sk-...` key,
  models like `gpt-4o-mini`.

Switching providers is "edit `env_llm`, restart the api container".
No code change required.

## Cloudflare configuration (dashboard locations)

Cloudflare's UI has reorganized; the current paths (as of the setup
session) are:

- Tunnel creation: **Cloudflare dashboard → Networking → Tunnels**.
  *Not* under Zero Trust anymore.

The route type to expose a tunnel publicly is **Published Application**
(was previously called "Public Hostname"). The other route options
(Private Hostname, Private CIDR, Workers VPC) are for WARP / Cloudflare
Workers and don't apply here.

No Access application or service-token policy is configured in this
design — the published hostname is intentionally open and protected by
in-app rate limits instead. See the Architecture section for why.

## Key design decisions

### DNS must live on Cloudflare for the tunnel hostname

Cloudflare requires the public hostname to be in a Cloudflare-managed
DNS zone for Named Tunnels with Access enforcement. **Subdomain-only zone
setup** ("CF hosts DNS for `ai.example.com` only, parent stays
elsewhere") is Enterprise-only. The two viable free-tier paths are:

1. Move the full domain's DNS to Cloudflare. Vercel-hosted apex/www
   records still resolve correctly with proxy disabled (grey cloud).
   Cloudflare just acts as a DNS provider for those records, while
   proxying only the tunnel subdomain.
2. Use a different domain entirely for the tunnel hostname, kept on
   Cloudflare DNS, while the app's main domain stays on its existing
   DNS provider untouched.

### Stateless backend, models the only persisted state

There is no database in the session-state sense (no chat history, no
retrieval index). On-disk state is limited to:

- The `models` volume — local model weights for any non-cloud models
  (cloud models leave nothing here).
- The `redis_data` volume — Redis AOF holding the monthly request
  counter. Wipe-able; loses the spent-quota record for the current
  month, which just means the cap effectively resets early. No harm.
- Host-local credential / config files (`env_tunnel`, `env_llm`,
  `id_ed25519`, `id_ed25519.pub`). Not session state, not in source.

Volumes can be wiped (`docker compose down --volumes`) and the
credentials regenerated without external coordination — though
regenerating ed25519 keys requires re-registering the public half on
ollama.com, and rotating `OPENAI_API_KEY` requires issuing a new key
on the configured provider's dashboard. Per-message session storage
(chat history, retrieval indexes, etc.) on the backend is a non-goal;
if a future change wants to introduce it, that should be flagged and
discussed rather than silently added.

## Rejected alternatives

Each of these was considered and ruled out. Captured here so future changes
don't re-debate them from scratch.

### Tailscale + app-server integration

End-to-end WireGuard, no MITM, no public DNS — strictly more private than
Cloudflare Tunnel. Rejected because:

- Ephemeral-node minute limits on Tailscale's free tier (1,000 min/month
  Personal); 10,000 min/month on Premium ($18/user-month). A constantly
  warm serverless function can burn through these.
- Adds tailnet handshake latency to function cold starts.
- More moving parts than two HTTP headers.

The privacy advantage is real (Cloudflare can read prompt content;
Tailscale peers can't), so this is the documented fallback if the CF
trade-off ever becomes unacceptable.

### mTLS directly to a public origin IP

Equivalent in encryption + auth to the chosen design, with a simpler stack
(no third-party in the data path). Rejected because the origin IP would
be public — losing the hidden-origin / DDoS-absorption / no-inbound-port
property the user wanted.

### Direct calls to `<uuid>.cfargotunnel.com`

The technical tunnel hostname only proxies traffic for DNS records **in
the same Cloudflare account** — it is not a publicly hittable endpoint.
So "point the app at the tunnel's tech hostname and skip the domain" does
not work.

### Quick Tunnels (`*.trycloudflare.com`)

No DNS setup needed, but disqualified for production:

- Random hostname per `cloudflared` restart.
- No SLA, explicitly testing/dev only per CF docs.
- No authentication.
- 200 concurrent request cap.
- **No SSE support** — would break Ollama's streaming responses.

### Cloudflare subdomain-only zone setup

Letting CF be authoritative for a single subdomain while the parent stays
elsewhere is **Enterprise-only** as of the setup session. This constraint
is why the design ends up requiring a full domain (or a separate domain)
on Cloudflare's DNS.

### Service token replaced by mTLS

Bearer headers are dramatically simpler to operate than mTLS (CA + client
cert + rotation in env vars), and roughly equivalent in security at this
scale. mTLS would only be worth the operational cost if the threat model
required Cloudflare *not* to be a trust anchor.

### Local CPU inference on small models

Earlier iterations pre-pulled small local models (`qwen3.5:2b`,
`gemma4:e4b`) and ran inference on the host CPU. Rejected for the
default flow because practical performance was unusable —
approximately **one minute per token** on the available hardware — and
each loaded model occupied roughly its file size in RAM, pressuring the
box's working memory under any concurrent use. Bigger local models
would be faster per-parameter but don't fit at all without GPU.

Local inference is still *supported* by the stack (the `models` volume
and the local `ollama` service handle it). It just isn't the default
because the small models that fit don't perform, and the ones that
perform don't fit. Cloud routing is the only path to usable latency on
a CPU-only host.

### AWS NPU instance families (Inferentia, Trainium)

Briefly considered for cheaper LLM inference on AWS. **Ollama uses
`llama.cpp`, which only supports CPU / CUDA / Metal — not Inferentia /
Trainium / Habana Gaudi.** An `inf2` instance would silently fall back to
CPU at NPU prices. Actually using AWS NPUs requires a different inference
stack (vLLM with Neuron backend, TGI on Inferentia, hosted endpoints) —
different architecture entirely, out of scope for this design.

## Operational gotchas

### Ollama CLI in non-TTY containers fails

Recent versions of the `ollama` CLI try to launch a TUI launcher menu on
startup and fail with `Error: run launcher menu: error running TUI: open
/dev/tty: no such device or address` when there's no controlling terminal
(i.e. inside a non-interactive Docker container). The container exits 0
without doing anything, which is silently broken.

`ollama-pull` therefore uses `curlimages/curl` and POSTs to Ollama's
`/api/pull` HTTP endpoint instead of shelling out to `ollama pull`. The
API has no TTY dependency and is the canonical automation interface.

The pull response uses `stream:true` (default) so progress is visible in
`docker compose logs ollama-pull`. The HTTP status is **200 even on pull
errors** (e.g. nonexistent model), so the command pipes through
`tee /dev/stderr | grep -q '"status":"success"'` to catch failures
properly. Without that grep, a missing-model error would pass through as
a successful exit.

`tty: true` on the original `ollama/ollama` based puller would also fix
the symptom but depends on Ollama keeping its current TUI behavior
across versions — fragile.

### Cloudflare returns 403 on missing tokens, not 401

The negative end-to-end test in `README.md` expects HTTP 403. CF docs
sometimes describe other codes; the real observed behavior on this stack
is 403. Don't "fix" the doc to say 401.

### docker compose down vs --volumes

Plain `down` keeps the `models` volume; `down --volumes` deletes it. The
README explicitly uses the long form (`--volumes` not `-v`) per user
preference, partly because `-v` is dangerously easy to type without
realizing it nukes downloaded models.

## Repo / file layout

- `ai/compose.yaml` — the stack definition. Modern name (was renamed
  from `docker-compose.yml`).
- `ai/api/` — FastAPI service source: `Dockerfile`, `pyproject.toml`,
  checked-in `uv.lock`, `main.py`.
- `ai/env_tunnel` / `ai/env_llm` — `.gitignore`'d; hold the tunnel
  token and LLM credentials respectively, mode 0600 on the server.
- `ai/env_tunnel.example` / `ai/env_llm.example` — committed
  templates with blank/placeholder values and commented alternatives.
- `ai/.gitignore` — excludes the env files, ed25519 keys, and Python
  build artefacts.
- `ai/README.md` — operator-facing manual: Cloudflare configuration
  steps, server deployment, maintenance procedures, end-to-end smoke
  test commands.
- `ai/COSTS.md` — snapshot of inference cost estimates across
  providers, sized to the `/bio/` workload.

The repo is at `https://github.com/nolar/mmmotivator.git`. The branch
holding this work was `ai`.

## Pending / not done

- **App-side wiring is not implemented.** The React app at the repo
  root doesn't yet call the backend. The architecture is
  frontend-direct: the browser calls the public tunnel hostname
  itself, with no auth headers — endpoint protection is in `api`'s
  rate limits, not in any client-side credential. The URL is whatever
  hostname is configured for the tunnel route. Handle 429 (over cap)
  and 503 (Redis unavailable) gracefully in the UI.

## User preferences observed during setup

- Wants concise, no-fluff answers.
- Makes architectural choices personally — present options with
  trade-offs, don't push toward one.
- Prefers explicit configuration over magic conventions (chose
  `env_file: env_tunnel` over implicit `.env` auto-loading; chose
  `--volumes` over `-v`).
- Wants generic / host-agnostic language in user-facing docs (e.g., "App"
  rather than a specific hosting service).
- Will tell you when to trust their input (e.g. model names) — do so.
- The naming convention for this stack was set by the user: network
  `ollama`, init service renamed to `ollama-pull`, env file
  `env_tunnel`.
