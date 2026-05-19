# Sentient Roadmap

Sentient is not replacing Circle or Arc. It is the intelligence and evaluation
layer around the Circle/Arc product core.

## Order

1. Primary model route
2. Live agent thesis generation
3. Safe function-calling tests
4. Sentient run context attached to every live agent run
5. OpenDeepSearch standalone mode, once search/reranker keys are added
6. CryptoAnalystBench for model quality comparison
7. Full ROMA Python orchestration, only if separate worker agents become useful

## Components

| Component | When | Product role |
| --- | --- | --- |
| OpenDeepSearch | Installed and bridged now; standalone after keys | Extra source discovery, scraping, and context building |
| Safe Function Calling | Active now | Prevent malicious source text from triggering unsafe tools |
| ROMA | Active as run context now; full runtime later | Split complex analysis into researcher, risk reviewer, verifier, and policy-review lanes |
| CryptoAnalystBench | Later | Compare models on Web3/market reasoning quality |

The current product does not leave Sentient idle. `POST /api/agent/run` attaches
a Sentient context before model analysis: Safe Function Calling is the safety
discipline, ROMA provides lane separation, and OpenDeepSearch either marks
standalone research active or falls back to the Circle x402 research bridge until
Serper/Jina or equivalent keys exist.
