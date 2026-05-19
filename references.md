# Circlefin Repo Notes

Local reference clones can live in `references/circlefin/`. That folder is ignored by git so sample apps do not accidentally get committed into our hackathon repo.

High-signal repos for this workspace:

- `circlefin/arc-nanopayments`: x402 + Circle Nanopayments on Arc, with a buyer agent and seller dashboard.
- `circlefin/arc-escrow`: AI-validated escrow workflow using Circle Developer Controlled Wallets, Smart Contract Platform, Supabase, and OpenAI.
- `circlefin/arc-multichain-wallet`: Gateway unified balance and cross-chain USDC UX.
- `circlefin/circle-cctp-crosschain-transfer`: low-level CCTP approve/burn/attest/mint flow across testnets.
- `circlefin/arc-prediction-markets`: prediction market sample idea space.

Installed root SDKs cover the common paths: x402/Nanopayments, App Kit, Bridge Kit, Gateway/Circle wallet APIs, OpenAI/LangChain agent runtime, viem/wagmi, and TypeScript tooling.

## Sentient AGI References

Local reference clones can live in `references/sentient-agi/`. Use these as product/agent design input; do not make them the settlement or payment core unless we intentionally adopt their stack.

Useful Sentient repos:

- `sentient-agi/CryptoAnalystBench`: evaluation rubric for crypto/Web3 research quality. Useful for scoring a prediction-market agent's reasoning on timeliness, depth, consistency, risk context, and overconfidence.
- `sentient-agi/OpenDeepSearch`: deep search/retrieval agent ideas for multi-hop market research. Useful if we build our own research layer instead of relying only on x402 paid APIs.
- `sentient-agi/ROMA`: recursive multi-agent architecture. Useful as a design reference for researcher/risk/executor/verifier agent decomposition.
- `sentient-agi/crypto-agent-safe-function-calling`: wallet/tool-call safety dataset for testing memory-injection and malicious tool-selection attacks before any payment or execution action.

Positioning for Agora:

- Arc/Circle should remain visibly central: USDC settlement, Arc transactions, Circle Wallets/Gateway/CCTP/App Kit/x402.
- Sentient can be an auxiliary intelligence layer: research, scoring, evaluation, multi-agent orchestration, and safety policy ideas.
- The safe function-calling dataset is a guardrail/evaluation reference only; Circle remains the wallet, payment, x402, Gateway, and settlement stack.
- Keep third-party code/license attribution clear in the public repo if any Sentient code is copied rather than used as reference.
