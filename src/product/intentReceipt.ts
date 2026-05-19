import {
  ANALYSIS_RECEIPT_FUNCTION,
  buildAnalysisReceiptArgs,
  stableJson,
  type AnalysisReceiptArgs,
  type AnalysisReceiptInput,
} from "@/src/arc/analysisReceipt";
import type { TradeIntent } from "@/src/product/tradeIntent";

export type IntentReceiptCandidate = {
  intentId: string;
  market: string;
  functionSignature: typeof ANALYSIS_RECEIPT_FUNCTION;
  receiptInput: AnalysisReceiptInput;
  receiptArgs: AnalysisReceiptArgs;
  stablePayload: string;
  circleCliCommand: string;
};

export function buildIntentReceiptCandidate({
  intent,
  contract,
  wallet,
}: {
  intent: TradeIntent;
  contract?: string | null;
  wallet?: string | null;
}): IntentReceiptCandidate {
  const receiptInput = buildIntentReceiptInput(intent);
  const receiptArgs = buildAnalysisReceiptArgs(receiptInput);
  const circleCliCommand = buildCircleCommand({
    receiptArgs,
    contract: contract ?? "$env:ANALYSIS_RECEIPT_CONTRACT",
    wallet: wallet ?? "$env:ARC_TESTNET_AGENT_WALLET_ADDRESS",
  });

  return {
    intentId: intent.id,
    market: intent.market,
    functionSignature: ANALYSIS_RECEIPT_FUNCTION,
    receiptInput,
    receiptArgs,
    stablePayload: stableJson(receiptInput),
    circleCliCommand,
  };
}

export function buildIntentReceiptInput(intent: TradeIntent): AnalysisReceiptInput {
  const marketProbability = sanitizeProbability(intent.analysis?.marketProbability ?? 0.5);
  const agentProbability = sanitizeProbability(intent.analysis?.agentProbability ?? marketProbability);
  const confidence = sanitizeProbability(intent.analysis?.confidence ?? 0.5);

  return {
    marketId: `intent:${intent.marketId}`,
    marketProbability,
    agentProbability,
    confidence,
    decision: mapDecision(intent),
    riskLevel: mapRiskLevel(intent),
    runId: intent.id,
    sources: [
      "agent:intent-ledger",
      "agent:manual-policy",
      "circle:x402:market-context",
      `risk-gate:${intent.riskGate}`,
    ],
    notes: [
      `Market: ${intent.market}`,
      intent.targetOutcome ? `Target outcome: ${intent.targetOutcome}` : null,
      `Intent state: ${intent.executionState}`,
      `Requested action: ${intent.requestedAction}`,
      `Side: ${intent.side}`,
      `Stake USDC: ${intent.stakeUsdc.toFixed(4)}`,
      `Sizing reason: ${intent.sizing.reason}`,
    ].filter(Boolean).join(" | "),
  };
}

function mapDecision(intent: TradeIntent): AnalysisReceiptInput["decision"] {
  if (intent.executionState === "blocked") return "DO_NOT_BET";
  if (intent.requestedAction === "AVOID") return "DO_NOT_BET";
  if (intent.requestedAction === "WATCH") return "WAIT";
  if (intent.side === "YES") return "BET_YES";
  if (intent.side === "NO") return "BET_NO";
  return "WAIT";
}

function mapRiskLevel(intent: TradeIntent): AnalysisReceiptInput["riskLevel"] {
  if (intent.riskGate === "blocked") return "BLOCKED";
  if (intent.riskGate === "review") return "MEDIUM";
  return "LOW";
}

function sanitizeProbability(value: number) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function buildCircleCommand({
  receiptArgs,
  contract,
  wallet,
}: {
  receiptArgs: AnalysisReceiptArgs;
  contract: string;
  wallet: string;
}) {
  return [
    "& 'C:\\Users\\pc\\AppData\\Roaming\\npm\\circle.cmd'",
    "wallet execute",
    `"${ANALYSIS_RECEIPT_FUNCTION}"`,
    ...receiptArgs.map(String),
    "--contract",
    contract,
    "--address",
    wallet,
    "--chain",
    "ARC-TESTNET",
    "--rpc-url",
    "$env:ARC_TESTNET_RPC_URL",
    "--output",
    "json",
  ].join(" ");
}
