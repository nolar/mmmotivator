# ai/ARCHITECTURE.md

Technical reference for the self-hosted AI backend. Covers the rationale and
constraints that shaped the design — things that won't be obvious from
`compose.yaml` or `README.md` alone.

## Purpose

Give the app server-side access to LLM inference with:

- The inference origin hidden (no public DNS record, no inbound ports).
- App-only authentication (only the app holds the credentials needed to
  reach the backend through Cloudflare's edge).
- Cost predictability — flat-rate cloud inference instead of metered
  per-token API fees, when using `:cloud` tagged models.

The app calls the backend from its server-side runtime only; the browser
never speaks to the backend directly. The two CF Access service-token
secrets live as server-side environment variables in the app's hosting
platform.

**Privacy boundary**: with `:cloud` model tags (the current default),
inference runs on Ollama Cloud, so prompt content is visible to Cloudflare
*and* Ollama. Earlier iterations of the design assumed local-only
inference and avoided third-party API exposure; the cloud-model decision
trades that property away in exchange for not needing GPU hardware on the
server. Local-only inference is still possible — just use models without
the `:cloud` suffix.

## Architecture

```
App (server side)
   │ HTTPS
   ▼
Cloudflare edge (Access enforces service-token auth, HTTP 403 on missing tokens)
   │ tunnel
   ▼
cloudflared on host
   │ HTTP (internal docker network)
   ▼
api:8000 (FastAPI)
   │ openai Python SDK (async, OpenAI-compatible API)
   │
   ├─▶ Ollama Cloud — default; OPENAI_BASE_URL=https://ollama.com/v1, OPENAI_API_KEY in env_llm
   │
   ├─▶ OpenAI proper, Cloudflare Workers AI, or any other OpenAI-compat provider
   │     (just edit env_llm; commented examples shipped)
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
- Auth is enforced at Cloudflare's edge: requests without a valid
  `CF-Access-Client-Id` / `CF-Access-Client-Secret` pair are rejected with
  HTTP 403 before reaching the tunnel.
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
  OpenAI-compatible endpoint, so the same code works with Ollama Cloud,
  OpenAI proper, Cloudflare Workers AI, Groq, and other providers
  exposing the same API. Endpoints:
  - `GET /` — returns `"Hello!"`. Doubles as the tunnel/Access health
    check from outside.
  - `POST /bio/` — accepts a raw text bio (≤ `MAX_INPUT_CHARS = 1024`),
    sends it through a system prompt that asks for a strict
    JSON-schema-conformant list of `LifePeriod` records, caps generation
    at `MAX_OUTPUT_TOKENS = 2000`. Output validated by Pydantic; on
    schema mismatch the call returns 502 (fail-closed, prompt-injection
    containment).

  `env_file: env_llm` injects (read directly by the OpenAI SDK):
  - `OPENAI_BASE_URL` — provider endpoint, default
    `https://ollama.com/v1`. Switch to any OpenAI-compatible provider
    by changing this.
  - `OPENAI_API_KEY` — bearer token for the chosen provider. For Ollama
    Cloud, issued at <https://ollama.com/settings/keys>.
  - `MODEL` — model identifier (default `gemma4:31b-cloud`); the
    valid values depend on the configured provider.
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

`env_llm.example` ships commented configuration blocks for:

- **Ollama Cloud** (default) — `https://ollama.com/v1`, account-bound
  API key, models like `gemma4:31b-cloud` or `qwen3.5:397b-cloud`.
- **Local Ollama** in this stack — `http://ollama:11434/v1`, any
  non-empty `OPENAI_API_KEY` (the SDK rejects an empty one). The local
  Ollama's own auth (ed25519) governs *its* upstream calls.
- **OpenAI proper** — `https://api.openai.com/v1`, `sk-...` key,
  models like `gpt-4o-mini`.
- **Cloudflare Workers AI** — account-scoped URL,
  `https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/v1`,
  Cloudflare API token, models like `@cf/qwen/...`.

Switching providers is "edit `env_llm`, restart the api container".
No code change required.

## Cloudflare configuration (dashboard locations)

Cloudflare's UI has reorganized; the current paths (as of the setup
session) are:

- Tunnel creation: **Cloudflare dashboard → Networking → Tunnels**.
  *Not* under Zero Trust anymore.
- Service tokens: **Zero Trust → Access controls → Service credentials**.
- Applications: **Zero Trust → Access controls → Applications**.
- Policies (also viewable separately): **Zero Trust → Access controls →
  Policies**.

The route type to expose a tunnel publicly is **Published Application**
(was previously called "Public Hostname"). The other route options
(Private Hostname, Private CIDR, Workers VPC) are for WARP / Cloudflare
Workers and not applicable when the consumer is a Vercel-style serverless
function.

The Access policy on the application uses **action: Service Auth** with
**Include → Service Token → \<the token\>**. The "Allow" action is the
wrong choice and a common foot-gun — it will let everyone through.

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

There is no database, no session storage, nothing in `/var/lib`. The only
on-disk state is:

- The `models` volume — local model weights for any non-cloud models
  (cloud models leave nothing here).
- Host-local credential files (`env_tunnel`, `env_llm`,
  `id_ed25519`, `id_ed25519.pub`). Configuration, not session state, but
  not in source either.

The volume can be wiped (`docker compose down --volumes`) and the
credentials regenerated without external coordination — though
regenerating ed25519 keys requires re-registering the public half on
ollama.com, and rotating `OPENAI_API_KEY` requires issuing a new key
on the configured provider's dashboard. Per-session storage (chat history, retrieval indexes, etc.) on
the backend is a non-goal; if a future change wants to introduce it,
that should be flagged and discussed rather than silently added.

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
- `ai/env_tunnel` — `.gitignore`'d; holds `TUNNEL_TOKEN` on the server
  only. Mode 0600.
- `ai/env_tunnel.example` — committed template, value blank.
- `ai/.gitignore` — only excludes `env_tunnel`.
- `ai/testserver/index.html` — single-line `Hello`.
- `ai/README.md` — operator-facing manual: Cloudflare configuration
  steps, server deployment, maintenance procedures, end-to-end smoke
  test commands.

The repo is at `https://github.com/nolar/mmmotivator.git`. The branch
holding this work was `ai`.

## Pending / not done

- **App-side wiring is not implemented.** The React app at the repo root
  doesn't yet call the backend. When implementing: the call must be
  server-side only (never from the browser); the two service-token
  values must be Sensitive env vars in the app's hosting environment
  (`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`); the URL is
  whatever Cloudflare hostname is configured for the tunnel route.

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
