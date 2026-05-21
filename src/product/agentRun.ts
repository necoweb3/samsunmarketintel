import { evaluateAgentPolicy, type AgentPolicyEvaluation } from "@/src/product/agentPolicy";
import type { LiveAgentModelAnalysis } from "@/src/product/agentModelAnalysis";
import type { CryptoAnalystBenchEvaluation } from "@/src/product/cryptoAnalystBench";
import type { LiveX402ResearchSummary } from "@/src/product/liveX402Research";
import { estimatePositionSize, type PositionSizingResult } from "@/src/product/positionSizing";
import type { SentientRunContext } from "@/src/product/sentientActivation";
import type { TradeIntent } from "@/src/product/tradeIntent";

export type AgentRunInput = {
  marketId: string;
  market: string;
  venue: "Polymarket" | "Draft";
  category: string;
  marketProbability: number | null;
  agentProbability: number;
  confidence: number;
  risk: "Low" | "Medium" | "High";
  sources: string[];
  marketPriceLabel?: string;
  originalUrl?: string;
  marketSlug?: string;
  conditionId?: string;
  tokenIds?: string[];
  outcomeSummary?: string;
};

export type AgentMarketResearch = {
  status: string;
  query: string;
  answer: string | null;
  durationMs: number | null;
  provider: string;
  reranker: string;
  model: string;
  sourceLinks: string[];
  error?: string;
};

export type AgentRunRecord = {
  id: string;
  marketId: string;
  market: string;
  venue: AgentRunInput["venue"];
  category: string;
  action: "BET_YES" | "BET_NO" | "WAIT" | "DO_NOT_BET";
  riskGate: "open" | "review" | "blocked";
  summary: string;
  edge: number | null;
  confidence: number;
  sizing: PositionSizingResult;
  policy: {
    status: AgentPolicyEvaluation["status"];
    walletExecution: false;
    remainingDailyUsdc: number;
  };
  analysis: {
    marketProbability: number | null;
    agentProbability: number;
    inputRisk: AgentRunInput["risk"];
    bankrollUsdc: number | null;
  };
  sentientContext?: SentientRunContext;
  marketResearch?: AgentMarketResearch;
  paidResearch?: LiveX402ResearchSummary;
  baselineAnalysis?: LiveAgentModelAnalysis;
  modelAnalysis?: LiveAgentModelAnalysis;
  cryptoBench?: CryptoAnalystBenchEvaluation;
  sources: string[];
  marketPriceLabel?: string;
  originalUrl?: string;
  marketSlug?: string;
  conditionId?: string;
  tokenIds?: string[];
  outcomeSummary?: string;
  createdAt: string;
};

export function buildAgentRun(
  input: AgentRunInput,
  existingIntents: TradeIntent[],
  options: { bankrollUsdc?: number | null } = {},
) {
  const sizing = estimatePositionSize({
    marketProbability: input.marketProbability,
    agentProbability: input.agentProbability,
    confidence: input.confidence,
    risk: input.risk,
    bankrollUsdc: options.bankrollUsdc ?? 0,
  });
  const policy = evaluateAgentPolicy(existingIntents);
  const riskGate = readRiskGate(input.risk, sizing);
  const action = readAction(input.risk, sizing);
  const edge =
    input.marketProbability === null ? null : input.agentProbability - input.marketProbability;

  return {
    id: buildRunId(input.marketId),
    marketId: input.marketId,
    market: input.market,
    venue: input.venue,
    category: input.category,
    action,
    riskGate,
    summary: buildSummary(action, riskGate, sizing),
    edge,
    confidence: input.confidence,
    sizing,
    policy: {
      status: policy.status,
      walletExecution: policy.policy.walletExecution,
      remainingDailyUsdc: policy.ledger.remainingDailyUsdc,
    },
    analysis: {
      marketProbability: input.marketProbability,
      agentProbability: input.agentProbability,
      inputRisk: input.risk,
      bankrollUsdc: options.bankrollUsdc ?? null,
    },
    sources: input.sources,
    marketPriceLabel: input.marketPriceLabel,
    originalUrl: input.originalUrl,
    marketSlug: input.marketSlug,
    conditionId: input.conditionId,
    tokenIds: input.tokenIds,
    outcomeSummary: input.outcomeSummary,
    createdAt: new Date().toISOString(),
  } satisfies AgentRunRecord;
}

export function applyModelAnalysisToAgentRun(
  run: AgentRunRecord,
  modelAnalysis: LiveAgentModelAnalysis,
): AgentRunRecord {
  if (modelAnalysis.status !== "ok") return run;

  return {
    ...run,
    action: mapModelRecommendation(modelAnalysis.recommendation, run.action),
    riskGate: modelAnalysis.riskGate,
    summary: modelAnalysis.summary,
    edge: modelAnalysis.tradePlan?.edge ?? run.edge,
    confidence: modelAnalysis.confidence,
  };
}

function readRiskGate(risk: AgentRunInput["risk"], sizing: PositionSizingResult) {
  if (risk === "High") return "blocked";
  if (risk === "Medium" || sizing.side === "NONE") return "review";
  return "open";
}

function readAction(
  risk: AgentRunInput["risk"],
  sizing: PositionSizingResult,
): AgentRunRecord["action"] {
  if (risk === "High") return "DO_NOT_BET";
  if (sizing.side === "YES") return "BET_YES";
  if (sizing.side === "NO") return "BET_NO";
  return "WAIT";
}

function buildSummary(
  action: AgentRunRecord["action"],
  riskGate: AgentRunRecord["riskGate"],
  sizing: PositionSizingResult,
) {
  if (action === "DO_NOT_BET") {
    return "Risk gate blocks execution; agent can only watch.";
  }

  if (riskGate === "review") {
    return "Manual review is required before any intent can be staged.";
  }

  if (sizing.side === "NONE") {
    return "No positive sized edge was found.";
  }

  return `Agent found a ${sizing.side} edge; execution remains manual.`;
}

function buildRunId(marketId: string) {
  const normalized = marketId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `run-${normalized || "market"}-${Date.now()}`;
}

function mapModelRecommendation(
  recommendation: LiveAgentModelAnalysis["recommendation"],
  fallback: AgentRunRecord["action"],
): AgentRunRecord["action"] {
  if (recommendation === "BET_YES") return "BET_YES";
  if (recommendation === "BET_NO") return "BET_NO";
  if (recommendation === "DO_NOT_BET") return "DO_NOT_BET";
  if (recommendation === "WAIT" || recommendation === "RESEARCH_MORE") return "WAIT";
  return fallback;
}
