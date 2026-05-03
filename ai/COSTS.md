# Inference cost estimates

Snapshot of per-request and monthly inference costs across providers, sized
to the `/bio/` workload. Pricing changes — re-validate from each provider's
docs before relying on the absolute numbers; relative ordering is more
durable than the figures.

Captured: 2026-05.

## Workload assumed

- Per request: **250 input tokens** (1024-character cap on the bio body)
  and up to **2000 output tokens** (`MAX_OUTPUT_TOKENS`).
- The 2K output is the worst case. Real bios typically yield 500–1000
  output tokens; halve the output column for a realistic estimate.
- Two scenarios: **100 requests/day** and **1000 requests/day**.
- Month = 30 days.

## Per-million-token rates

| Provider / model | Input $/M | Output $/M |
|---|---|---|
| CF Workers AI — Llama 3.2 1B | 0.027 | 0.201 |
| CF Workers AI — Qwen 3 30B | 0.051 | 0.335 |
| CF Workers AI — Llama 3 70B | 0.293 | 2.253 |
| OpenAI GPT-4o-mini | 0.15 | 0.60 |
| OpenAI GPT-5-mini | 0.25 | 2.00 |
| OpenAI GPT-4o | 2.50 | 10.00 |
| OpenAI GPT-5 | 1.25 | 10.00 |
| Anthropic Claude Haiku 3.5 | 0.80 | 4.00 |
| Anthropic Claude Haiku 4.5 | 1.00 | 5.00 |
| Anthropic Claude Sonnet 4.5 / 4.6 | 3.00 | 15.00 |
| Anthropic Claude Opus 4.5+ | 5.00 | 25.00 |

CF prices are after applying the **10,000 neurons/day free allocation**
(no flat fee). Anthropic and OpenAI have no free tier on the API.

## Monthly cost — worst case (2K output)

| Model | 100/day | 1000/day |
|---|---|---|
| CF Llama 3.2 1B (tiny — likely too small for strict JSON) | $0 | $8.91 |
| **CF Qwen 3 30B** | $0 | **$17.16** |
| CF Llama 3 70B | $10.43 | $134 |
| **OpenAI GPT-4o-mini** | $3.71 | **$37.13** |
| OpenAI GPT-5-mini | $12.19 | $121.88 |
| OpenAI GPT-4o | $61.88 | $618.75 |
| OpenAI GPT-5 | $60.94 | $609.38 |
| Anthropic Haiku 3.5 | $24.60 | $246.00 |
| **Anthropic Haiku 4.5** | $30.75 | **$307.50** |
| Anthropic Sonnet 4.5 / 4.6 | $92.25 | $922.50 |

## Apples-to-apples "cheap tier" comparison

The realistic cheap-tier options for structured JSON extraction at this
scale:

| Model | 100/day | 1000/day | Notes |
|---|---|---|---|
| CF Qwen 3 30B | Free | **$17/mo** | Cheapest viable; some output drift expected |
| OpenAI GPT-4o-mini | $3.71 | $37/mo | Battle-tested for structured output |
| Anthropic Haiku 4.5 | $30.75 | $308/mo | Strongest of the cheap tier; ~10× CF cost |

At 1000/day:

- CF Qwen 30B is **~2× cheaper than OpenAI mini**.
- CF Qwen 30B is **~18× cheaper than Anthropic Haiku 4.5**.
- CF Qwen 30B is **~36× cheaper than Anthropic Sonnet 4.5**.

## Observations

- **CF free tier covers 100/day comfortably** on any sub-70B model. Side
  by side A/B experiments at low volume cost nothing on CF.
- **Output dominates cost** by 5–10× over input across all providers.
  Lowering `MAX_OUTPUT_TOKENS` is the cheapest cost lever — cutting it
  to 1000 roughly halves every number above.
- **Quality vs cost is the real tradeoff**, not headline price. The
  cheap-tier numbers assume the model holds the strict JSON shape on
  every call. If a smaller model bounces 10–20% of requests through
  schema validation, retries (or "upgrade on failure" to a stronger
  model) inflate the effective cost — but the cheap tier still wins
  by a wide margin.
- **Note on CF's catalog ceiling**: their largest general-purpose LLM
  is around 70B. Anything that needs a 100B+ model for quality
  reasons (the current default `gemma4:31b-cloud` and
  `qwen3.5:397b-cloud` from Ollama Cloud sit outside CF's reach) can't
  use CF Workers AI as a drop-in.

## How to use this

1. Decide the cheapest tier that maintains acceptable schema compliance.
   Start with CF Qwen 3 30B if traffic is low or quality drift is OK.
2. Add a Workers AI block to `env_llm.example` and A/B against the
   current default (Ollama Cloud `gemma4:31b-cloud`) for real bios.
3. Track schema-validation 502s as a quality proxy; if they exceed an
   acceptable rate, climb one tier (mini → Haiku → Sonnet, or Qwen →
   Llama 70B).
