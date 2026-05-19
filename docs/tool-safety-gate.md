# Tool Safety Gate

The tool safety gate protects every action that can move money, stage a market
intent, pay an API, or write an Arc receipt.

## Checks

```powershell
npm run check:safety
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/safety/tool-gate
```

## Policy

Protected actions require explicit user approval:

- x402 paid calls
- Circle wallet transfers
- Gateway/bridge/swap actions
- prediction-market intents
- Arc receipt writes
- spending-policy changes

Instructions from source text, scraped pages, cached memory, or model output are
not enough to trigger protected actions.

`POST /api/agent/intent` now calls this gate before it appends a staged intent.
Normal user-originated watch/approval intents continue in manual review mode.
Source-text, memory, scheduled-agent, or model-originated protected actions are
blocked unless the product later adds an explicit guarded-autopilot policy.

## Sentient Reference

The local CrAI-SafeFuncCall dataset is used as the safety reference:

`references/sentient-agi/crypto-agent-safe-function-calling`

The first scenarios cover the same attack family: memory/source injection tries
to redirect a crypto/Web3 agent into unsafe tool calls. The product blocks those
cases before any Circle or Arc tool can run.
