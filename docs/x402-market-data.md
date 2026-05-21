# x402 Market Data Plan

Circle x402 paid services are the market-data layer for the product. They do
not replace Arc. The intended flow is:

1. The agent inspects the endpoint and schema.
2. The user or policy approves the paid request.
3. Circle Agent Wallet pays through Gateway/x402.
4. The data is used by the probability and risk model.
5. The final decision receipt is written to Arc.

## Selected Services

| Provider | Endpoint | Use | Price |
| --- | --- | --- | --- |
| BlockRun.AI | Polymarket markets | Watchlist discovery | 0.001 USDC |
| BlockRun.AI | Polymarket trades | Suspicious-flow checks | 0.001 USDC |
| AIsa API | Polymarket orderbooks | Liquidity and price impact | 0.01 USDC |
| BlockRun.AI | Matching markets | Comparable Polymarket discovery | 0.005 USDC |
| AIsa API | Tavily search | Paid news/source discovery | 0.0096 USDC |
| AIsa API | Perplexity Sonar | Cited research synthesis | 0.012 USDC |

## Current Funding State

The mainnet Circle Gateway balance for the marketplace wallet is funded on
Polygon for paid market-data calls. Keep a small vanilla USDC balance on Base
for non-Gateway sellers and wallet headroom.

Default policy:

- inspect/search is allowed
- paid API call requires explicit approval
- max first paid call: 0.01 USDC
- record service, endpoint, price, response hash, and final analysis receipt

## Useful CLI Commands

```powershell
circle services search polymarket --limit 10 --output json
circle services inspect https://nano.blockrun.ai/api/v1/pm/polymarket/markets --output json
circle services pay https://nano.blockrun.ai/api/v1/pm/polymarket/markets --address 0xc421716945e8cfed01e06d0e73a3c7db0d733b0a --chain POLYGON --max-amount 0.001 --estimate --output json
```

Workspace wrappers:

```powershell
npm run x402:inspect
npm run x402:estimate
```

Real paid call guard:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/x402-market-data.ps1 -Mode pay -MaxAmount 0.001
npm run x402:pay:markets
```

`npm run x402:pay:markets` writes the latest approved response to
`.cache/x402/latest-polymarket-markets.json`. The dashboard reads only a
sanitized summary from that local cache; the raw paid response stays out of git.

Trade-flow scan:

```powershell
npm run x402:pay:trades
```

This writes `.cache/x402/latest-polymarket-trades.json`. The dashboard converts
that raw trade feed into a suspicious-flow summary: wallet concentration,
one-sided flow, largest-print share, total notional, and a low/medium/high risk
score.

Research search:

```powershell
npm run x402:research:estimate
npm run x402:research:pay
```

The research wrapper calls the AIsa Tavily paid endpoint with a POST body and
writes `.cache/x402/latest-research-search.json`. The dashboard reads this cache
as a research snapshot: query, source count, source credibility, relevance
scores, payment amount, and source links. The script uses a Node wrapper instead
of PowerShell argument passing so JSON request bodies reach the Circle CLI
without quote stripping.

Custom query example:

```powershell
npm run x402:research:pay -- --query "TCMB faiz karari beklentileri resmi veri Mayis 2026"
```

The current agent thesis endpoint (`/api/agent/thesis`) combines cached paid
market data, trade-flow integrity checks, and paid research into a single manual
decision state. It can return `WAIT`, `DO_NOT_BET`, or `RESEARCH_MORE`; it does
not execute trades.

Agent run:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/agent/run
```

`POST /api/agent/run` creates a local analysis record from the selected market:
recommended action, risk gate, confidence, position sizing, active policy, and
sources used. It appends the record to `.cache/agent/runs.json`. This is an
analysis step only; it does not create a bet, call the wallet, pay an API, or
write to Arc.

Manual intent staging:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/agent/intent
```

`POST /api/agent/intent` stages an approval/watch intent and appends it to
`.cache/agent/intents.json`. The execution ledger reads that local cache. This is
not a wallet action and does not create a bet.

The latest staged intent can be converted into an Arc receipt payload with
`npm run arc:prepare-intent-receipt` and recorded after manual review. The
dashboard reads the latest recorded intent proof from
`.cache/arc/latest-intent-receipt.json`.

Agent Policy:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/agent/policy
```

The policy endpoint evaluates staged intents against manual guardrails: wallet
execution disabled, per-intent cap, daily cap, high-risk blocks, and remaining
daily budget.

Demo Review Pack:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/demo/review-pack
```

This endpoint summarizes the full product state for demos: x402 inputs, agent
thesis, policy guardrails, latest intent, Arc proof, Source Registry, and Market
Studio readiness.

Market Studio:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/studio/markets
```

The studio endpoint models RFB-style verticals as structured specs: market
question, oracle method, primary/fallback sources, settlement currency,
liquidity plan, and risk policy.

Source Registry:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/sources/registry
```

The source registry turns credibility rules into product data: mapped domains,
source weights, curation status, and roles. User-provided Turkey news/X sources
should be added there before they affect research scoring.
