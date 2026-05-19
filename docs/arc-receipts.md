# Arc Decision Receipts

The product records compact agent-decision receipts on Arc Testnet. The chain is
not used as a database for full news articles or market payloads. It stores the
verifiable proof layer:

- which market was analyzed
- which source bundle was used
- which offchain run produced the decision
- market probability vs. agent probability
- confidence, decision, and risk level
- the wallet that submitted the receipt

Full analysis text, source excerpts, charts, and UI state remain offchain in the
app/backend. The onchain receipt lets users verify that a displayed decision was
committed by the agent at a specific time.

## Contract

`contracts/AnalysisReceiptLog.sol`

The write function is:

```solidity
recordReceipt(
  bytes32 marketIdHash,
  bytes32 sourceHash,
  bytes32 runHash,
  uint16 marketProbabilityBps,
  uint16 agentProbabilityBps,
  uint16 confidenceBps,
  uint8 decision,
  uint8 riskLevel
)
```

Decision codes:

- `0`: BET_YES
- `1`: BET_NO
- `2`: WAIT
- `3`: DO_NOT_BET
- `4`: HEDGE
- `5`: CLOSE_EARLY

Risk codes:

- `0`: LOW
- `1`: MEDIUM
- `2`: HIGH
- `3`: BLOCKED

Probability and confidence values use basis points:

- `4200` means 42.00%
- `10000` means 100.00%

The contract computes `edgeBps` as:

```text
agentProbabilityBps - marketProbabilityBps
```

## Scripts

Compile:

```powershell
npm run contracts:compile
```

Verify Arc RPC:

```powershell
npm run arc:verify-rpc
```

Prepare a sample receipt payload and Circle CLI command:

```powershell
npm run arc:prepare-receipt
```

Prepare an integrity-gate receipt from the latest paid x402 trade cache:

```powershell
npm run arc:prepare-integrity-receipt
```

Prepare a manual intent receipt from the latest staged intent ledger entry:

```powershell
npm run arc:prepare-intent-receipt
```

The intent receipt flow converts a local approval/watch intent into the same
compact `recordReceipt(...)` format. This is a review step only; it prints the
payload and Circle CLI command but does not submit a transaction.

Record the latest staged intent receipt on Arc Testnet:

```powershell
npm run arc:record-intent-receipt
```

This performs an Arc Testnet write through Circle CLI and saves the result to
`.cache/arc/latest-intent-receipt.json`. Use it only after reviewing the
prepared payload.

If Circle CLI returns `ESTIMATION_ERROR` but `npm run arc:estimate-intent-receipt`
passes, use the explicit local fallback:

```powershell
npm run arc:record-intent-receipt:local
```

That fallback signs with `DEPLOYER_PRIVATE_KEY`, records the same payload, and
marks the cache with `recordingMode: local-deployer-fallback`.

Record that integrity-gate decision on Arc Testnet:

```powershell
npm run arc:record-integrity-receipt
```

Read an onchain receipt:

```powershell
npm run arc:read-receipt -- 0
```

Deploy with a funded Arc Testnet deployer key:

```powershell
npm run arc:deploy-receipt
```

After deployment, save the contract address in local `.env`:

```env
ANALYSIS_RECEIPT_CONTRACT=0x...
```

## Execution Policy

The first product release should use manual approval. The agent can recommend an
action, but no payment or execution intent should be recorded until the user
approves it in the app.
