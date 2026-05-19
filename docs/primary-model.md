# Primary Model Route

The product uses one primary model route first. This avoids buying and wiring
multiple LLM APIs before we know what the product actually needs.

## Environment

```powershell
PRIMARY_MODEL_ID=openrouter/google/gemini-3.1-pro-preview-customtools
PRIMARY_MODEL_PROVIDER=openrouter
PRIMARY_MODEL_BASE_URL=
PRIMARY_MODEL_MAX_OUTPUT_TOKENS=8192
OPENROUTER_API_KEY=
```

Equivalent providers are supported through the same route:

- OpenRouter
- OpenAI
- Google Gemini through an OpenAI-compatible endpoint
- Fireworks
- Anthropic
- Hugging Face

## Checks

```powershell
npm run check:primary-model
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/ai/primary-model
```

After the selected key is added, run the live smoke test:

```powershell
npm run primary-model:smoke
```

The smoke test prints the provider/model and a short response. It never prints
the API key.

`PRIMARY_MODEL_MAX_OUTPUT_TOKENS` is intentionally high so the model does not
compress or truncate useful reasoning. API providers still require a finite
limit, so use `8192` as the default and raise it for long-form demo analyses if
needed.

## Product Uses

The same primary model route should power:

- agent thesis synthesis
- research-source summary
- probability-model explanation
- policy and safety review
- demo narrative generation

Serper, Jina, or other search/rerank APIs should be added only after Circle x402
research quality is tested with the primary model.
