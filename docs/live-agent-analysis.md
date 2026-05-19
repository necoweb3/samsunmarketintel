# Live Agent Analysis

`POST /api/agent/run` now combines two layers:

1. deterministic local sizing and policy checks
2. primary-model analysis through OpenRouter / Gemini

The endpoint still does not:

- place a bet
- call a wallet
- pay an x402 service
- write an Arc receipt

It only appends a local run record to `.cache/agent/runs.json`.

## Inputs Used

The live model receives:

- selected market metadata
- deterministic edge and position sizing
- manual policy state
- cached Circle x402 research summary
- cached Circle x402 trade-flow integrity summary

## Output

The model must return structured JSON:

- recommendation
- risk gate
- confidence
- thesis
- summary
- key drivers
- missing evidence
- source credibility notes
- policy notes

The UI shows the latest model memo in the Agent Decision panel.

Model output is not treated as user approval. If model text suggests staging an
intent, paying an x402 endpoint, moving wallet funds, or writing an Arc receipt,
that suggestion must still pass `/api/safety/tool-gate`.

## Test

Run from the dashboard by clicking the agent button on a market, or call:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/agent/run -Method POST -ContentType 'application/json' -Body '<json>'
```

The latest successful local test used Gemini and returned `WAIT` / `review`
with 3,409 total tokens.
