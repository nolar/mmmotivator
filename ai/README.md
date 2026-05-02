# AI Backend

Self-hosted Ollama running on a private server, exposed to the app through a
Cloudflare Tunnel with service-token authentication. The host has no inbound
ports open and no public DNS record — only an outbound connection to
Cloudflare.

Inference for the pre-configured models runs on **Ollama Cloud**; the local
Ollama acts as an authenticated proxy that holds the cloud credentials and
is reachable only through the tunnel. Local-model inference is also
supported if you add non-`:cloud` models later.

The local backend is stateless: nothing is persisted between requests. The
only on-disk state is the cache of any locally-stored models (Docker
volume) and the ed25519 keypair used for Ollama Cloud authentication.

## Architecture

```
App (server side) ──HTTPS──▶ Cloudflare edge (Access) ──tunnel──▶ cloudflared ──HTTP──▶ ollama:11434
```

## Services

- `cloudflared` — outbound-only connection to Cloudflare; routes incoming
  tunnel requests to the right internal service.
- `ollama` — Ollama instance configured with the cloud credentials,
  acting as an authenticated proxy to Ollama Cloud. Any locally-stored
  models live in the `models` volume.
- `ollama-pull` — one-shot job that registers the configured models at
  startup. Re-runs are no-ops once the models are known.
- `testserver` — plain HTTP server returning `Hello`, for debugging the
  tunnel without involving Ollama.

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
   - URL: `ollama:11434` (or `testserver:8080` while debugging)

4. **Create a service token.** Zero Trust → Access controls → Service
   credentials → Create. Name it after the consumer (for example `app`).
   Save the `Client ID` and `Client Secret` immediately — the secret is
   shown only once.

5. **Protect the application with the token.** Zero Trust → Access
   controls → Applications → Add an application → Self-hosted. Set the
   application domain to the same hostname used for the tunnel route.
   Attach a policy (created inline here, or pre-created at Zero Trust →
   Access controls → Policies) with:
   - Action: **Service Auth**
   - Include → Service Token → the token created above

   Save. Requests without `CF-Access-Client-Id` and `CF-Access-Client-Secret`
   headers are now rejected at Cloudflare's edge.

6. **Configure the app.** In the app's hosting environment, add the
   following as secret environment variables, available only to the
   server-side runtime (never exposed to the browser):
   - `CF_ACCESS_CLIENT_ID` — the service token's Client ID
   - `CF_ACCESS_CLIENT_SECRET` — the service token's Client Secret

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

Generate the Ollama Cloud keypair:

```bash
./generate-keys.sh
```

The script writes `id_ed25519` and `id_ed25519.pub` into the current
directory (both gitignored). Copy the printed public key and register it at
<https://ollama.com/settings/keys> — without that, the private key is
unrecognised and the cloud proxy will fail to authenticate. The private key
is mounted read-only into the `ollama` container at
`/root/.ollama/id_ed25519`.

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

Verify end-to-end from any machine with the service-token credentials. While
the tunnel route is pointed at `testserver:8080`, a successful call returns
`Hello`; once it's pointed at `ollama:11434`, the same path returns Ollama's
root response.

```bash
# Authenticated request — should succeed
curl -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
     -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" \
     https://ai.example.com/

# Unauthenticated request — should be rejected at Cloudflare's edge
curl -i https://ai.example.com/
# expect HTTP 403 from Cloudflare
```

The negative test confirms Access is actually enforcing — without it, you
might be looking at a bypass policy or a misconfigured application.

Smoke-test each cloud model interactively (run on the server) to confirm
Ollama Cloud auth is wired up correctly:

```bash
docker compose exec -it ollama ollama run qwen3.5:397b-cloud
docker compose exec -it ollama ollama run gemma4:31b-cloud
```

Each command opens a chat REPL with the model. Type a prompt, see the
reply. Exit with `/bye` or Ctrl-D. If you get an authentication error
from Ollama (not from Cloudflare), check that the public key generated
by `./generate-keys.sh` is registered at
<https://ollama.com/settings/keys>.

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
docker compose exec ollama ollama rm qwen3.5:397b-cloud
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

- **Inference location.** With `:cloud` model tags, inference runs on
  Ollama Cloud — the local Ollama is just an authenticated proxy. Server
  CPU, RAM and disk usage stay near-zero regardless of request volume.
  `OLLAMA_KEEP_ALIVE` is a no-op for cloud models. Both settings start
  to matter again only if you add local-only models.
- **Model storage.** `models` is a named Docker volume holding any
  *locally* stored models; cloud models leave nothing on disk. Inspect
  with `docker volume inspect mmmai_models`.
- **Changing pre-pulled models.** Edit the `command:` of `ollama-pull` in
  `compose.yaml`, then `docker compose up -d ollama-pull`. The
  service runs once and exits.
- **Debugging the tunnel.** Switch the Cloudflare Published Application
  route URL to `testserver:8080`; a request from the app (or curl with the
  service-token headers) should return `Hello`. Switch back to
  `ollama:11434` once verified.
