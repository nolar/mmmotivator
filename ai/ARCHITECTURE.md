# ai/ARCHITECTURE.md

Technical reference for the self-hosted AI backend. Covers the rationale and
constraints that shaped the design — things that won't be obvious from
`compose.yaml` or `README.md` alone.

## Purpose

Give the app server-side access to LLM inference without:

- Sending prompt content to a third-party API (privacy).
- Paying per-token fees (cost).
- Exposing the inference server to the public internet (attack surface).

The app calls the backend from its server-side runtime only; the browser
never speaks to the backend directly. The two CF Access service-token
secrets live as server-side environment variables in the app's hosting
platform.

## Architecture

```
App (server side) ──HTTPS──▶ Cloudflare edge (Access) ──tunnel──▶ cloudflared ──HTTP──▶ ollama:11434
```

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
- **`ollama`** — `ollama/ollama:latest`. CPU-only inference (no GPU
  device requests anywhere). `OLLAMA_MODELS=/models` redirects model
  storage to a named Docker volume so models survive restarts.
  `OLLAMA_KEEP_ALIVE=1h` keeps the most-recently-used model loaded for
  an hour to avoid reload latency on subsequent calls. Healthcheck uses
  `ollama list` because that's a lightweight roundtrip to the local
  server. The official image binds to `0.0.0.0:11434` by default — no
  `OLLAMA_HOST` override needed on the server itself.
- **`ollama-pull`** — pre-pulls preferred models on `compose up`. Uses
  the `curlimages/curl` image and calls Ollama's HTTP `/api/pull`
  endpoint **deliberately, not the `ollama` CLI** (see gotcha below).
  Depends on `ollama` being healthy. `restart: "no"` so it doesn't loop
  after success.
- **`testserver`** — `python:3.14-slim` with an inline
  `python3 -m http.server` command serving `./testserver/`. Returns
  `Hello` for `/`. Used to verify the tunnel + Access setup without
  involving Ollama; switch the Cloudflare Published Application route to
  `testserver:8080` while debugging.

All four services share a custom network named `ollama` (the user
preferred this over a generic `internal` name).

## Models pre-pulled

`qwen3.5:2b` and `gemma4:e4b`. The user confirmed these names manually
and asked me to trust them — do not second-guess or substitute. If they
ever fail to pull, surface the error and ask for confirmation rather
than swap to a different tag.

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

The README intro states this explicitly. There is no database, no session
storage, nothing in `/var/lib`. The `models` volume is the single piece
of stateful disk; it can be wiped (`docker compose down --volumes`) and
re-populated by `ollama-pull` without external coordination. This is a
non-negotiable design property — if a future change introduces
per-session storage on the backend, it should be flagged and discussed
rather than silently added.

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
