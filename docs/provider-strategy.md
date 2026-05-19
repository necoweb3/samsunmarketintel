# Provider Strategy

The product should not buy overlapping APIs before we know which layer needs
them. The first release keeps providers swappable.

## Principle

Circle and Arc stay fixed:

- Circle x402 pays for market data and paid research services.
- Circle Agent Wallet and Gateway handle USDC payment.
- Arc records the final proof/receipt.

Research and model providers stay replaceable:

- search/source discovery
- semantic reranking
- reasoning model
- safety review

## Purchase Order

1. Buy or configure one strong LiteLLM-compatible model provider.
2. Use Circle x402 research services first for source discovery.
3. Add Jina only if semantic source ranking is needed after live tests.
4. Add Serper only if standalone OpenDeepSearch beats x402 research quality.
5. Consider Infinity/Qwen only if we want self-hosted reranking and have enough
   local GPU capacity.

## Current Recommendation

Do not buy every API at once.

Start with:

- Circle x402 market/research calls already available through the agent wallet
- one primary LiteLLM model key
- Jina later, if source ranking quality needs a semantic reranker
- Serper later, if OpenDeepSearch standalone mode proves better than x402
  research for Turkey macro and market-integrity cases

This keeps the product serious while avoiding duplicate spend.

## Local Check

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3050/api/research/provider-strategy
```
