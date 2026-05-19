# Product Readiness

Use this check before buying or connecting new APIs.

```powershell
npm run check:readiness
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/product/readiness
```

The readiness check looks at:

- Circle x402 paid market/research caches
- agent run and staged-intent ledgers
- Arc receipt proof state
- tool-call safety gate
- selected primary model provider
- optional OpenDeepSearch stack
- Turkey source registry status
- live demo URL status

## Status Meaning

| Status | Meaning |
| --- | --- |
| `needs_core_setup` | Core local flow still needs data, agent ledger, or Arc proof work. |
| `infra_ready_api_keys_pending` | Core flow is ready; add one primary model key before live API trials. |
| `ready_for_live_api_tests` | Core flow and model provider are ready for real API trials. |

## Current Buying Rule

Do not buy multiple APIs at once.

First add one primary LiteLLM-compatible model key. Then compare Circle x402
research quality against standalone OpenDeepSearch before buying Serper or Jina.
