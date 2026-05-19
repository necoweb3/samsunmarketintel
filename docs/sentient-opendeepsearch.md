# Sentient OpenDeepSearch Plan

OpenDeepSearch is the research and semantic-search layer. It does not replace
Circle x402 market data, Circle Agent Wallet, Gateway, or Arc receipts.

## Runtime Pieces

| Piece | Standalone OpenDeepSearch setup | Why |
| --- | --- | --- |
| Search provider | Serper | Reliable Google-style result discovery with low setup friction |
| Semantic reranker | Jina AI | Strong hosted reranking without local GPU requirements |
| LLM provider | LiteLLM model route | Lets us switch between OpenRouter, OpenAI, Anthropic, Fireworks, or Gemini |
| Deep mode | Pro | Better for multi-source market research and source cross-checking |

Self-hosted alternatives stay available:

- SearXNG instead of Serper
- Infinity + Qwen2 reranker instead of Jina

## Required Environment For Standalone Mode

For standalone OpenDeepSearch:

```powershell
SERPER_API_KEY=
JINA_API_KEY=
OPENROUTER_API_KEY=
OPENDEEPSEARCH_SEARCH_PROVIDER=serper
OPENDEEPSEARCH_RERANKER=jina
OPENDEEPSEARCH_MODE=pro
LITELLM_SEARCH_MODEL_ID=openrouter/google/gemini-3.1-pro-preview-customtools
```

Equivalent LiteLLM providers are also supported. For example, use
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `FIREWORKS_API_KEY`, `GEMINI_API_KEY`, or
`HUGGINGFACE_API_KEY` if the selected `LITELLM_SEARCH_MODEL_ID` points there.

## Checks

```powershell
npm run check:opendeepsearch
npm run check:opendeepsearch:runtime
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/sentient/opendeepsearch
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/sentient/deep-search
```

The check is sanitized: it reports which provider is configured and which
environment entries are missing, but it never prints secret values.

## Product Role

OpenDeepSearch should enrich the probability model with:

- source discovery beyond paid market-data endpoints
- semantic reranking of noisy news and social context
- source credibility cross-checks
- deeper research mode for Turkey macro and market-integrity cases

Any trade or payment action still goes through the existing manual policy gate.

Current integration status:

- Agent runs already receive a Sentient context.
- The dashboard has an OpenDeepSearch query panel backed by
  `/api/sentient/deep-search`.
- If OpenDeepSearch keys are missing, the agent uses the Circle x402 research
  cache as the current research input and explicitly marks missing evidence.
- When Serper/Jina or equivalent keys are present, the same context marks
  standalone OpenDeepSearch as active and can be promoted into a deeper live
  research step.

Before buying direct search/rerank APIs, compare standalone OpenDeepSearch
against the Circle x402 research path in `docs/provider-strategy.md`.
