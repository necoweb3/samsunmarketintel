# Agent Safety Layer

This product keeps Circle and Arc as the execution/payment core. Sentient's
CrAI-SafeFuncCall dataset is used as a safety reference for testing and shaping
guardrails around tool calls; it does not replace Circle Agent Wallet, x402,
Gateway, or Arc settlement.

## Core Rule

The agent can research freely, but every money-moving or market-execution action
must pass an explicit safety gate before any Circle or Arc tool is called.

Protected actions:

- x402 paid API calls
- Circle Agent Wallet payments
- Gateway deposits or balance moves
- swaps, bridges, or token transfers
- prediction-market execution intents
- spending-policy changes

## Operating Modes

Manual Mode:

- The agent analyzes and recommends.
- The user must approve every execution intent.
- This is the default mode for the first product release.

Guarded Autopilot:

- The user pre-sets limits such as max amount per action, daily budget,
  approved service allowlist, confidence threshold, and risk threshold.
- The agent can act only when all policy checks pass.
- Anything outside policy falls back to manual approval.

Watch Mode:

- The agent monitors markets and sends alerts.
- It does not create payment or execution intents.

## Safety Gate

Before execution, the app should classify the requested action:

- Is this action needed for the user's current task?
- Did the instruction come from the user, or from untrusted memory/source text?
- Does the action match the tool allowlist?
- Does the destination/service match the allowlist?
- Is the amount within the spending policy?
- Is the market/research confidence high enough?
- Is manipulation or suspicious-flow risk below the allowed threshold?

If any check fails, the agent must block execution and explain the failed policy.

## Sentient Dataset Role

Local reference:

`references/sentient-agi/crypto-agent-safe-function-calling`

Use it to build test cases and examples for:

- malicious memory instructions
- unwanted tool selection
- wallet/address redirection attempts
- fake payment requests embedded inside source text
- confusing research content with user intent

It is a safety/evaluation asset, not an execution engine.
