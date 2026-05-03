# ai/CLAUDE.md

For the technical design, rationale, rejected alternatives, gotchas, and
context needed to continue working on this stack, read
[ARCHITECTURE.md](./ARCHITECTURE.md) before making changes.

`README.md` in this directory is the operator-facing manual (Cloudflare
configuration, deployment, maintenance). Read it for the externally
visible behavior; read `ARCHITECTURE.md` for the *why*.

`COSTS.md` has snapshot estimates of inference costs across providers
(Cloudflare Workers AI, OpenAI, Anthropic) sized to the `/bio/`
workload. Refer to it when deciding which provider to point `env_llm`
at, or when proposing a model change. Re-validate prices from each
provider before relying on absolute numbers — the relative ordering is
more durable than the figures.

## Coding conventions

- **Logging format**: always use f-strings with `{value!r}` for
  interpolating exceptions and other values into log messages, not
  the `%`-style lazy interpolation. Prefer
  `logger.error(f"... {exc!r}")` over
  `logger.error("... %r", exc)`. The lazy form's main benefit (skipping
  the format step when the level is filtered) doesn't matter at this
  service's traffic level, and f-strings keep the code consistent with
  the rest of the codebase.
