import { readPrimaryModelConfig } from "@/src/product/primaryModel";
import { readSentientResearchConfig } from "@/src/product/sentientResearchConfig";

export type ProviderStrategyItem = {
  id: string;
  layer: "market-data" | "source-discovery" | "semantic-rerank" | "reasoning-model" | "proof";
  currentChoice: string;
  alternatives: string[];
  purchaseTiming: "already-usable" | "buy-later" | "avoid-until-needed" | "local";
  reason: string;
};

export type ProviderStrategy = {
  generatedAt: string;
  principle: string;
  recommendedNextPurchase: string[];
  avoidDuplicateSpend: string[];
  stack: ProviderStrategyItem[];
};

export function buildProviderStrategy(): ProviderStrategy {
  const sentient = readSentientResearchConfig();
  const primaryModel = readPrimaryModelConfig();
  const modelName = primaryModel.model;

  return {
    generatedAt: new Date().toISOString(),
    principle:
      "Keep Circle and Arc as the product core, and keep research providers swappable until live quality tests prove which paid APIs are necessary.",
    recommendedNextPurchase: [
      "One strong LiteLLM-compatible model key for all reasoning tasks",
      "One semantic reranker key only if source ranking quality is weak without it",
      "Direct search API only if Circle x402 research calls are not enough",
    ],
    avoidDuplicateSpend: [
      "Do not buy Serper before comparing it with Circle x402 Tavily/Perplexity results.",
      "Do not buy multiple LLM providers at once; route the whole app through one selected LiteLLM model first.",
      "Do not self-host Infinity unless local GPU capacity or privacy requirements justify it.",
    ],
    stack: [
      {
        id: "circle-x402-market-data",
        layer: "market-data",
        currentChoice: "Circle x402 Polymarket services",
        alternatives: ["Direct exchange APIs", "Custom indexer"],
        purchaseTiming: "already-usable",
        reason:
          "This is hackathon-native and keeps market data paid through Circle Agent Wallet and Gateway.",
      },
      {
        id: "circle-x402-research",
        layer: "source-discovery",
        currentChoice: "Circle x402 Tavily / Perplexity Sonar",
        alternatives: ["Serper", "SearXNG", "Direct Tavily API"],
        purchaseTiming: "already-usable",
        reason:
          "Use pay-per-request research first so we do not commit to a separate search subscription too early.",
      },
      {
        id: "opendeepsearch-standalone-search",
        layer: "source-discovery",
        currentChoice: "Serper only when standalone OpenDeepSearch is needed",
        alternatives: ["SearXNG self-host/public instance"],
        purchaseTiming: "buy-later",
        reason:
          "OpenDeepSearch natively expects Serper or SearXNG, but our app can first reuse x402 research output as source input.",
      },
      {
        id: "semantic-rerank",
        layer: "semantic-rerank",
        currentChoice: sentient.reranker.label,
        alternatives: ["Infinity + Qwen2", "OpenAI embeddings adapter", "Cohere rerank adapter"],
        purchaseTiming: "buy-later",
        reason:
          "Jina is the easiest hosted semantic reranker for OpenDeepSearch; Infinity is better only if we want self-hosting.",
      },
      {
        id: "primary-llm",
        layer: "reasoning-model",
        currentChoice: modelName,
        alternatives: ["OpenAI", "Anthropic", "Gemini", "Fireworks", "OpenRouter"],
        purchaseTiming: "buy-later",
        reason:
          `${primaryModel.provider} is the current primary route. One model key should power search synthesis, agent thesis, scoring, and safety review without duplicating model spend.`,
      },
      {
        id: "arc-proof",
        layer: "proof",
        currentChoice: "Arc Testnet decision receipts",
        alternatives: ["Local-only logs", "Centralized database"],
        purchaseTiming: "local",
        reason:
          "Arc remains the verifiable proof layer and does not depend on which research/model provider wins.",
      },
    ],
  };
}
