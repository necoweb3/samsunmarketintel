export type SentientRoadmapItem = {
  id: string;
  component: "OpenDeepSearch" | "ROMA" | "CryptoAnalystBench" | "Safe Function Calling";
  stage: "ready-now" | "next" | "later";
  role: string;
  trigger: string;
  productUse: string;
};

export type SentientRoadmap = {
  generatedAt: string;
  currentFocus: string;
  items: SentientRoadmapItem[];
};

export function buildSentientRoadmap(): SentientRoadmap {
  return {
    generatedAt: new Date().toISOString(),
    currentFocus:
      "Keep the research stack active as the analysis and safety context while Circle/Arc remain the payment and proof core.",
    items: [
      {
        id: "opendeepsearch",
        component: "OpenDeepSearch",
        stage: "ready-now",
        role: "Deep research and source expansion",
        trigger: "Use the Circle x402 research bridge now; promote to standalone search after search/reranker keys are added.",
        productUse:
          "Mark missing evidence, prepare deeper source requests, and enrich probability analysis.",
      },
      {
        id: "roma",
        component: "ROMA",
        stage: "ready-now",
        role: "Recursive multi-agent planning",
        trigger: "Use on every run as role separation: researcher, source verifier, risk reviewer, and policy reviewer.",
        productUse:
          "Force a structured review before any manual intent is staged.",
      },
      {
        id: "crypto-analyst-bench",
        component: "CryptoAnalystBench",
        stage: "later",
        role: "Evaluation rubric for crypto/Web3 reasoning quality",
        trigger: "Use when we need to compare Gemini, Kimi, Opus, or GPT model quality on the same prompts.",
        productUse:
          "Score timeliness, source use, risk awareness, consistency, and overconfidence.",
      },
      {
        id: "safe-function-calling",
        component: "Safe Function Calling",
        stage: "ready-now",
        role: "Tool-call and wallet-action safety tests",
        trigger: "Use before allowing any tool that can stage an intent, pay x402, or write an Arc receipt.",
        productUse:
          "Test that malicious or confusing source text cannot make the agent call payment/execution tools.",
      },
    ],
  };
}
