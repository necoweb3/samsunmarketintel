import {
  buildAnalysisReceiptArgs,
  stableJson,
  type AnalysisReceiptArgs,
  type AnalysisReceiptInput,
} from "@/src/arc/analysisReceipt";
import type { FlowAlert, X402PaymentSummary } from "@/src/product/integrityAnalysis";

export type AgentIntegrityDecision = {
  marketId: string;
  market: string;
  action: "WAIT" | "DO_NOT_BET";
  riskGate: "open" | "review" | "blocked";
  reason: string;
  confidence: number;
  marketProbability: number;
  agentProbability: number;
  receiptInput: AnalysisReceiptInput;
  receiptArgs: AnalysisReceiptArgs;
  stablePayload: string;
};

export function buildIntegrityDecision({
  alert,
  payment,
  updatedAt,
}: {
  alert: FlowAlert;
  payment: X402PaymentSummary | null;
  updatedAt: string | null;
}): AgentIntegrityDecision {
  const marketProbability = alert.impliedProbability ?? 0.5;
  const isBlocked = alert.risk === "High" || alert.score >= 72;
  const action = isBlocked ? "DO_NOT_BET" : "WAIT";
  const riskGate = isBlocked ? "blocked" : alert.risk === "Medium" ? "review" : "open";
  const confidence = clampProbability(0.46 + alert.score / 180);
  const runId = [
    "integrity",
    alert.marketId,
    updatedAt ?? "uncached",
    `score-${alert.score}`,
  ].join(":");

  const receiptInput: AnalysisReceiptInput = {
    marketId: `polymarket:${alert.marketId}`,
    marketProbability,
    agentProbability: marketProbability,
    confidence,
    decision: action,
    riskLevel: isBlocked ? "BLOCKED" : alert.risk === "Medium" ? "MEDIUM" : "LOW",
    runId,
    sources: [
      "circle:x402:polymarket-trades",
      "circle:gateway:polygon",
      payment?.seller ? `seller:${payment.seller}` : "seller:unknown",
    ],
    notes: [
      `Market: ${alert.market}`,
      `Risk score: ${alert.score}`,
      `Reason: ${alert.reason}`,
      `Trades: ${alert.trades}`,
      `Notional: ${alert.notionalUsd}`,
    ].join(" | "),
  };

  return {
    marketId: alert.marketId,
    market: alert.market,
    action,
    riskGate,
    reason: buildDecisionReason(action, alert),
    confidence,
    marketProbability,
    agentProbability: marketProbability,
    receiptInput,
    receiptArgs: buildAnalysisReceiptArgs(receiptInput),
    stablePayload: stableJson(receiptInput),
  };
}

function buildDecisionReason(action: "WAIT" | "DO_NOT_BET", alert: FlowAlert) {
  if (action === "DO_NOT_BET") {
    return `Blocked by integrity gate: ${alert.reason}.`;
  }

  if (alert.risk === "Medium") {
    return `Manual review required: ${alert.reason}.`;
  }

  return `No execution yet: integrity risk is low, but this receipt only covers flow risk.`;
}

function clampProbability(value: number) {
  return Math.min(0.95, Math.max(0.05, value));
}
