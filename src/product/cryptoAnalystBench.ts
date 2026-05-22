import type { LiveAgentModelAnalysis } from "@/src/product/agentModelAnalysis";
import type { AgentRunInput } from "@/src/product/agentRun";
import type { LiveX402ResearchSummary } from "@/src/product/liveX402Research";
import type { OpenDeepSearchRunResult } from "@/src/product/openDeepSearchRuntime";
import type { ResearchSnapshot } from "@/src/product/researchAnalysis";

export type CryptoAnalystBenchDimension =
  | "relevance"
  | "temporalRelevance"
  | "depth"
  | "dataConsistency";

export type CryptoAnalystBenchEvaluation = {
  status: "active" | "skipped";
  mode: "cryptoanalystbench-rubric";
  triggeredBy: string[];
  overallScore: number | null;
  dimensions: Record<
    CryptoAnalystBenchDimension,
    {
      score: number;
      note: string;
    }
  > | null;
  errorTaxonomy: Array<{
    id: string;
    label: string;
    present: boolean;
    note: string;
  }>;
  improvementNotes: string[];
  generatedAt: string;
};

type CryptoAnalystBenchInput = {
  input: AgentRunInput;
  modelAnalysis: LiveAgentModelAnalysis;
  research: ResearchSnapshot | null;
  marketResearch: OpenDeepSearchRunResult | null;
  paidResearch?: LiveX402ResearchSummary | null;
};

const cryptoTermPatterns = [
  { label: "crypto", pattern: /\bcrypto\b/i },
  { label: "bitcoin", pattern: /\bbitcoin\b|\bbtc\b/i },
  { label: "ethereum", pattern: /\bethereum\b|\beth\b/i },
  { label: "solana", pattern: /\bsolana\b|\bsol\b/i },
  { label: "usdc", pattern: /\busdc\b/i },
  { label: "usdt", pattern: /\busdt\b/i },
  { label: "stablecoin", pattern: /\bstablecoin\b/i },
  { label: "defi", pattern: /\bdefi\b/i },
  { label: "web3", pattern: /\bweb3\b/i },
  { label: "airdrop", pattern: /\bairdrop\b/i },
  { label: "dogecoin", pattern: /\bdogecoin\b/i },
  { label: "litecoin", pattern: /\blitecoin\b/i },
  { label: "memecoin", pattern: /\bmemecoin\b/i },
  { label: "blockchain", pattern: /\bblockchain\b/i },
  { label: "nft", pattern: /\bnft\b/i },
  { label: "staking", pattern: /\bstaking\b/i },
  { label: "layer 1", pattern: /\blayer[\s-]?1\b|\bl1\b/i },
  { label: "layer 2", pattern: /\blayer[\s-]?2\b|\bl2\b/i },
  { label: "coingecko", pattern: /\bcoingecko\b/i },
  { label: "onchain", pattern: /\bonchain\b|\bon-chain\b/i },
];

export function shouldRunCryptoAnalystBench(input: AgentRunInput) {
  const haystack = [
    input.market,
    input.category,
    input.marketSlug ?? "",
    input.outcomeSummary ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const nonCryptoCategory = /\b(legal|political|politic|geopolitic|macro|sports|football|competition|court|local news|custom intelligence)\b/i.test(
    input.category,
  );
  const matches = cryptoTermPatterns
    .filter((term) => term.pattern.test(haystack))
    .map((term) => term.label);

  if (nonCryptoCategory && matches.length === 0) return [];
  return Array.from(new Set(matches));
}

export function evaluateCryptoAnalystBench({
  input,
  modelAnalysis,
  research,
  marketResearch,
  paidResearch,
}: CryptoAnalystBenchInput): CryptoAnalystBenchEvaluation {
  const triggeredBy = shouldRunCryptoAnalystBench(input);
  const generatedAt = new Date().toISOString();

  if (!triggeredBy.length) {
    return {
      status: "skipped",
      mode: "cryptoanalystbench-rubric",
      triggeredBy: [],
      overallScore: null,
      dimensions: null,
      errorTaxonomy: buildErrorTaxonomy({
        stale: false,
        inconsistent: false,
        sourceReconciliation: false,
        shallow: false,
        missingRisk: false,
        overconfident: false,
        partial: false,
      }),
      improvementNotes: ["Skipped because this run is not crypto or Web3-specific."],
      generatedAt,
    };
  }

  const answerText = buildAnswerText(modelAnalysis);
  const contextText = buildContextText({ research, marketResearch, paidResearch });
  const relevantTokens = significantTokens(input.market);
  const sourceCount =
    (marketResearch?.sources?.length ?? 0) +
    (marketResearch?.answer ? countLinks(marketResearch.answer) : 0) +
    (paidResearch?.services.filter((service) => service.status === "ok").length ?? 0) +
    (research?.sourceCount ?? 0);
  const hasRecentMarker = hasTemporalMarker(answerText) || hasTemporalMarker(contextText);
  const hasRisk = /risk|missing|uncertain|uncertainty|liquidity|manipulation|concentration|hedge|wait|avoid|blocked|review/i.test(answerText);
  const hasSizing = /kelly|sizing|stake|position|edge|ev|expected value/i.test(answerText);
  const contradiction = hasRecommendationContradiction(modelAnalysis, answerText);
  const priceConfusion = Boolean(
    input.marketPriceLabel &&
      /\b\d{1,3}%\s+(yes|no|implied|market|probability|priced)/i.test(answerText),
  );
  const tokenCoverage = relevantTokens.length
    ? relevantTokens.filter((token) => answerText.toLowerCase().includes(token)).length /
      relevantTokens.length
    : 1;

  const relevance = clampScore(4 + tokenCoverage * 4 + (modelAnalysis.summary ? 1 : 0));
  const temporalRelevance = clampScore(
    3 + (hasRecentMarker ? 3 : 0) + Math.min(3, sourceCount / 2) + (marketResearch?.status === "ok" ? 1 : 0),
  );
  const depth = clampScore(
    3 +
      Math.min(2, modelAnalysis.keyDrivers.length * 0.5) +
      Math.min(2, modelAnalysis.missingEvidence.length * 0.45) +
      (hasSizing ? 1 : 0) +
      (hasRisk ? 1 : 0) +
      (paidResearch ? 1 : 0),
  );
  const dataConsistency = clampScore(9 - (contradiction ? 3 : 0) - (priceConfusion ? 2 : 0));
  const dimensions = {
    relevance: {
      score: relevance,
      note:
        relevance >= 8
          ? "The answer stays close to the crypto/Web3 market question."
          : "The answer should tie more claims back to the exact market and asset/topic.",
    },
    temporalRelevance: {
      score: temporalRelevance,
      note:
        temporalRelevance >= 8
          ? "The analysis uses recent context or live research signals."
          : "Add stronger time bounds, fresh market data, and current source references.",
    },
    depth: {
      score: depth,
      note:
        depth >= 8
          ? "The answer covers drivers, missing evidence, risk, and sizing context."
          : "Add deeper mechanism, liquidity, flow, and risk reasoning before action.",
    },
    dataConsistency: {
      score: dataConsistency,
      note:
        dataConsistency >= 8
          ? "No major internal contradiction was detected."
          : "Review contradictions, price/probability wording, and source reconciliation.",
    },
  } satisfies CryptoAnalystBenchEvaluation["dimensions"];
  const flags = {
    stale: !hasRecentMarker || temporalRelevance < 6,
    inconsistent: contradiction || priceConfusion,
    sourceReconciliation: sourceCount > 1 && modelAnalysis.sourceCredibilityNotes.length === 0,
    shallow: depth < 6,
    missingRisk: !hasRisk,
    overconfident:
      modelAnalysis.confidence >= 0.82 &&
      (sourceCount < 3 || !modelAnalysis.missingEvidence.length || !hasRisk),
    partial: relevance < 6,
  };
  const overallScore = roundScore(
    (relevance + temporalRelevance + depth + dataConsistency) / 4 - countPresent(flags) * 0.25,
  );
  const improvementNotes = buildImprovementNotes({
    flags,
    sourceCount,
    hasSizing,
    hasRisk,
    priceConfusion,
  });

  return {
    status: "active",
    mode: "cryptoanalystbench-rubric",
    triggeredBy: Array.from(new Set(triggeredBy)).slice(0, 6),
    overallScore,
    dimensions,
    errorTaxonomy: buildErrorTaxonomy(flags),
    improvementNotes,
    generatedAt,
  };
}

function buildAnswerText(modelAnalysis: LiveAgentModelAnalysis) {
  return [
    modelAnalysis.recommendation,
    modelAnalysis.riskGate,
    modelAnalysis.thesis,
    modelAnalysis.summary,
    ...modelAnalysis.keyDrivers,
    ...modelAnalysis.missingEvidence,
    ...modelAnalysis.sourceCredibilityNotes,
    ...modelAnalysis.policyNotes,
  ].join(" ");
}

function buildContextText({
  research,
  marketResearch,
  paidResearch,
}: Pick<CryptoAnalystBenchInput, "research" | "marketResearch" | "paidResearch">) {
  return [
    research?.query ?? "",
    ...(research?.topSources.slice(0, 5).map((source) => `${source.title} ${source.content}`) ?? []),
    marketResearch?.query ?? "",
    marketResearch?.answer ?? "",
    ...(marketResearch?.sources?.map((source) => `${source.title} ${source.snippet}`) ?? []),
    ...(paidResearch?.services.map((service) => `${service.name} ${service.summary}`) ?? []),
  ].join(" ");
}

function hasTemporalMarker(value: string) {
  return /\b(today|latest|recent|current|as of|this week|this month|202[5-9]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(
    value,
  );
}

function hasRecommendationContradiction(
  modelAnalysis: LiveAgentModelAnalysis,
  answerText: string,
) {
  const normalized = answerText.toLowerCase();
  if (modelAnalysis.recommendation === "BET_YES" && /\b(no has positive|avoid yes|bet no)\b/.test(normalized)) {
    return true;
  }
  if (modelAnalysis.recommendation === "BET_NO" && /\b(yes has positive|avoid no|bet yes)\b/.test(normalized)) {
    return true;
  }
  if (
    (modelAnalysis.recommendation === "WAIT" || modelAnalysis.recommendation === "DO_NOT_BET") &&
    /\b(strong buy|must bet|clear bet|guaranteed)\b/.test(normalized)
  ) {
    return true;
  }
  return false;
}

function countLinks(value: string) {
  return value.match(/https?:\/\/\S+/g)?.length ?? 0;
}

function significantTokens(value: string) {
  const stopWords = new Set([
    "will",
    "this",
    "that",
    "with",
    "from",
    "market",
    "prediction",
    "polymarket",
    "before",
    "after",
    "above",
    "below",
    "trade",
    "price",
  ]);

  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !stopWords.has(token))
    .slice(0, 10);
}

function buildImprovementNotes({
  flags,
  sourceCount,
  hasSizing,
  hasRisk,
  priceConfusion,
}: {
  flags: Record<string, boolean>;
  sourceCount: number;
  hasSizing: boolean;
  hasRisk: boolean;
  priceConfusion: boolean;
}) {
  const notes: string[] = [];

  if (sourceCount < 3) notes.push("Use more current and independent crypto/Web3 sources before sizing.");
  if (!hasSizing) notes.push("Make the edge and sizing logic explicit.");
  if (!hasRisk) notes.push("Add liquidity, manipulation, protocol, or market-structure risk.");
  if (priceConfusion) notes.push("Use cents/quote language for Polymarket prices instead of treating quotes as official probabilities.");
  if (flags.sourceReconciliation) notes.push("Reconcile conflicts between web research, paid data, and market data.");
  if (!notes.length) notes.push("No major benchmark-style weakness detected.");

  return notes.slice(0, 5);
}

function buildErrorTaxonomy(flags: {
  stale: boolean;
  inconsistent: boolean;
  sourceReconciliation: boolean;
  shallow: boolean;
  missingRisk: boolean;
  overconfident: boolean;
  partial: boolean;
}) {
  return [
    {
      id: "staleness",
      label: "Staleness / missing time bounds",
      present: flags.stale,
      note: flags.stale ? "Freshness or time bounds need strengthening." : "Freshness signal is acceptable.",
    },
    {
      id: "inconsistent-claims",
      label: "Inconsistent claims",
      present: flags.inconsistent,
      note: flags.inconsistent ? "Potential contradiction or price/probability wording issue." : "No obvious contradiction detected.",
    },
    {
      id: "source-reconciliation",
      label: "Source reconciliation failure",
      present: flags.sourceReconciliation,
      note: flags.sourceReconciliation ? "Multiple sources are present but reconciliation is thin." : "Source reconciliation is acceptable.",
    },
    {
      id: "shallow-synthesis",
      label: "Shallow synthesis",
      present: flags.shallow,
      note: flags.shallow ? "Reasoning depth is thin for a crypto/Web3 decision." : "Synthesis depth is acceptable.",
    },
    {
      id: "missing-risk",
      label: "Missing risk or mechanism context",
      present: flags.missingRisk,
      note: flags.missingRisk ? "Risk/mechanism context is missing or weak." : "Risk context is present.",
    },
    {
      id: "overconfident-prediction",
      label: "Overconfident prediction",
      present: flags.overconfident,
      note: flags.overconfident ? "Confidence appears high relative to evidence and risk caveats." : "Confidence is not obviously overstated.",
    },
    {
      id: "partial-misframed",
      label: "Partial or misframed answer",
      present: flags.partial,
      note: flags.partial ? "Answer may not fully match the exact market framing." : "Market framing is acceptable.",
    },
  ];
}

function countPresent(flags: Record<string, boolean>) {
  return Object.values(flags).filter(Boolean).length;
}

function clampScore(value: number) {
  return Math.max(1, Math.min(10, roundScore(value)));
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}
