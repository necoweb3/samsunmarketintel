import {
  estimatePositionSize,
  type PositionSizingInput,
  type PositionSizingResult,
} from "@/src/product/positionSizing";

export type IntentRequest = PositionSizingInput & {
  marketId: string;
  market: string;
  requestedAction: "APPROVE_INTENT" | "WATCH" | "AVOID";
  requestedSide?: "AUTO" | "YES" | "NO";
  targetOutcome?: string | null;
};

export type TradeIntent = {
  id: string;
  marketId: string;
  market: string;
  targetOutcome: string | null;
  requestedAction: IntentRequest["requestedAction"];
  requestedSide: NonNullable<IntentRequest["requestedSide"]>;
  executionState: "requires_human_confirmation" | "watch_only" | "no_trade" | "blocked";
  side: PositionSizingResult["side"];
  stakeUsdc: number;
  riskGate: "open" | "review" | "blocked";
  summary: string;
  policy: {
    mode: "Manual";
    maxStakeUsdc: number;
    walletExecution: false;
  };
  analysis: {
    marketProbability: number | null;
    agentProbability: number;
    confidence: number;
    inputRisk: IntentRequest["risk"];
  };
  sizing: PositionSizingResult;
  createdAt: string;
};

export function buildTradeIntent(input: IntentRequest): TradeIntent {
  const requestedSide = input.requestedSide ?? "AUTO";
  const sizing = applyRequestedSide(estimatePositionSize(input), requestedSide);
  const riskGate = readRiskGate(input.risk, sizing, input.requestedAction);
  const executionState = readExecutionState(input.requestedAction, riskGate);

  return {
    id: buildIntentId(input.marketId, input.requestedAction),
    marketId: input.marketId,
    market: input.market,
    targetOutcome: input.targetOutcome ?? null,
    requestedAction: input.requestedAction,
    requestedSide,
    executionState,
    side: sizing.side,
    stakeUsdc: executionState === "requires_human_confirmation" ? sizing.stakeUsdc : 0,
    riskGate,
    summary: buildSummary(input.requestedAction, executionState, sizing, input.targetOutcome ?? null),
    policy: {
      mode: "Manual",
      maxStakeUsdc: 3,
      walletExecution: false,
    },
    analysis: {
      marketProbability: input.marketProbability,
      agentProbability: input.agentProbability,
      confidence: input.confidence,
      inputRisk: input.risk,
    },
    sizing,
    createdAt: new Date().toISOString(),
  };
}

function applyRequestedSide(
  sizing: PositionSizingResult,
  requestedSide: NonNullable<IntentRequest["requestedSide"]>,
): PositionSizingResult {
  if (requestedSide === "AUTO" || requestedSide === sizing.side) {
    return sizing;
  }

  return {
    ...sizing,
    side: requestedSide,
    rawKellyFraction: 0,
    confidenceAdjustedFraction: 0,
    cappedFraction: 0,
    stakeUsdc: 0,
    reason: `Human selected ${requestedSide}, but the agent did not find positive expected value for that side. Manual review required.`,
  };
}

function readRiskGate(
  risk: IntentRequest["risk"],
  sizing: PositionSizingResult,
  requestedAction: IntentRequest["requestedAction"],
) {
  if (risk === "High") return requestedAction === "APPROVE_INTENT" ? "blocked" : "review";
  if (risk === "Medium" || sizing.side === "NONE") return "review";
  return "open";
}

function readExecutionState(
  requestedAction: IntentRequest["requestedAction"],
  riskGate: TradeIntent["riskGate"],
) {
  if (riskGate === "blocked") return "blocked";
  if (requestedAction === "AVOID") return "no_trade";
  if (requestedAction === "WATCH") return "watch_only";
  return "requires_human_confirmation";
}

function buildSummary(
  requestedAction: IntentRequest["requestedAction"],
  executionState: TradeIntent["executionState"],
  sizing: PositionSizingResult,
  targetOutcome: string | null,
) {
  if (executionState === "blocked") {
    return "Intent blocked by risk policy. No wallet action was prepared.";
  }

  if (requestedAction === "AVOID") {
    const target = targetOutcome ? ` for ${targetOutcome}` : "";
    return `Avoid intent staged${target}. No bet will be prepared unless a human starts a new action.`;
  }

  if (requestedAction === "WATCH") {
    const target = targetOutcome ? ` for ${targetOutcome}` : "";
    return `Watch intent staged${target}. The agent will monitor signals without preparing execution.`;
  }

  if (sizing.side === "NONE") {
    return "Execution intent requires review because the model found no positive sized edge.";
  }

  const target = targetOutcome ? `${targetOutcome} ` : "";
  return `Manual intent staged for ${target}${sizing.side}; wallet execution remains disabled.`;
}

function buildIntentId(marketId: string, requestedAction: IntentRequest["requestedAction"]) {
  const normalized = marketId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `intent-${normalized || "market"}-${requestedAction.toLowerCase()}-${Date.now()}`;
}
