import type { AgentPolicyEvaluation } from "@/src/product/agentPolicy";
import type { AgentRunRecord } from "@/src/product/agentRun";
import type { AgentThesis } from "@/src/product/agentThesis";
import type { IntentLedger } from "@/src/product/intentLedger";
import type { FlowAlert } from "@/src/product/integrityAnalysis";
import type { MarketStudioSpec } from "@/src/product/marketStudio";
import type { ResearchSnapshot } from "@/src/product/researchAnalysis";
import {
  buildSentientPipelineStatus,
  summarizeSentientRunContext,
} from "@/src/product/sentientActivation";
import type { SourceRegistryRecord } from "@/src/product/sourceRegistry";

export type RecordedIntentProof = {
  expectedReceiptId?: string;
  transactionHash?: string;
  explorerUrl?: string;
  recordingMode?: string;
  candidate?: {
    receiptInput?: {
      decision?: string;
      riskLevel?: string;
    };
  };
};

export type DemoReviewPack = {
  generatedAt: string;
  productMode: "Manual guarded agent";
  readiness: "demo-ready" | "needs-data" | "needs-proof";
  currentDecision: {
    action: AgentThesis["action"];
    riskGate: AgentThesis["riskGate"];
    confidence: number;
    evidenceScore: number;
    nextStep: string;
  };
  policy: {
    status: AgentPolicyEvaluation["status"];
    walletExecution: false;
    remainingDailyUsdc: number;
    blockedIntents: number;
  };
  lastIntent: {
    id: string | null;
    state: string;
    side: string;
    stakeUsdc: number;
  };
  latestAgentRun: {
    id: string;
    market: string;
    venue: AgentRunRecord["venue"];
    action: AgentRunRecord["action"];
    riskGate: AgentRunRecord["riskGate"];
    confidence: number;
    stakeUsdc: number;
    summary: string;
    modelStatus: string;
    modelRecommendation: string | null;
    modelConfidence: number | null;
    modelSummary: string | null;
    tokenCount: number | null;
    keyDrivers: string[];
    missingEvidence: string[];
    sentient: {
      mode: string;
      active: number;
      waiting: number;
      openDeepSearch: string;
      safety: string;
      roma: string;
      activeComponents: string[];
      waitingComponents: string[];
    } | null;
  } | null;
  arcProof: {
    status: "recorded" | "pending";
    receiptId: string | null;
    transactionHash: string | null;
    explorerUrl: string | null;
    recordingMode: string | null;
  };
  inputs: {
    paidMarkets: number;
    tradeFlowAlerts: number;
    researchSources: number;
    sourceRegistryRecords: number;
    marketStudioSpecs: number;
  };
  sentient: {
    status: string;
    activeComponents: string[];
    waitingComponents: string[];
    openDeepSearch: string;
    safety: string;
    roma: string;
  };
  narrative: string[];
};

export function buildDemoReviewPack({
  thesis,
  policy,
  ledger,
  marketCount,
  alerts,
  research,
  sourceRegistry,
  marketStudio,
  recordedProof,
  latestAgentRun,
}: {
  thesis: AgentThesis;
  policy: AgentPolicyEvaluation;
  ledger: IntentLedger;
  marketCount: number;
  alerts: FlowAlert[];
  research: ResearchSnapshot | null;
  sourceRegistry: SourceRegistryRecord[];
  marketStudio: MarketStudioSpec[];
  recordedProof: RecordedIntentProof | null;
  latestAgentRun: AgentRunRecord | null;
}): DemoReviewPack {
  const lastIntent = ledger.intents[0] ?? null;
  const hasArcProof = Boolean(recordedProof?.expectedReceiptId && recordedProof.transactionHash);
  const hasPaidInputs = marketCount > 0 && alerts.length > 0 && Boolean(research);
  const readiness = hasArcProof ? "demo-ready" : hasPaidInputs ? "needs-proof" : "needs-data";
  const sentient = buildSentientPipelineStatus();

  return {
    generatedAt: new Date().toISOString(),
    productMode: "Manual guarded agent",
    readiness,
    currentDecision: {
      action: thesis.action,
      riskGate: thesis.riskGate,
      confidence: thesis.confidence,
      evidenceScore: thesis.evidenceScore,
      nextStep: thesis.nextStep,
    },
    policy: {
      status: policy.status,
      walletExecution: policy.policy.walletExecution,
      remainingDailyUsdc: policy.ledger.remainingDailyUsdc,
      blockedIntents: policy.ledger.blockedIntents,
    },
    lastIntent: {
      id: lastIntent?.id ?? null,
      state: lastIntent?.executionState ?? "none",
      side: lastIntent?.side ?? "NONE",
      stakeUsdc: lastIntent?.stakeUsdc ?? 0,
    },
    latestAgentRun: latestAgentRun ? summarizeAgentRun(latestAgentRun) : null,
    arcProof: {
      status: hasArcProof ? "recorded" : "pending",
      receiptId: recordedProof?.expectedReceiptId ?? null,
      transactionHash: recordedProof?.transactionHash ?? null,
      explorerUrl: recordedProof?.explorerUrl ?? null,
      recordingMode: recordedProof?.recordingMode ?? null,
    },
    inputs: {
      paidMarkets: marketCount,
      tradeFlowAlerts: alerts.length,
      researchSources: research?.sourceCount ?? 0,
      sourceRegistryRecords: sourceRegistry.length,
      marketStudioSpecs: marketStudio.length,
    },
    sentient: {
      status: sentient.status,
      activeComponents: sentient.activeComponents,
      waitingComponents: sentient.waitingComponents,
      openDeepSearch: sentient.components.openDeepSearch.status,
      safety: sentient.components.safeFunctionCalling.status,
      roma: sentient.components.roma.status,
    },
    narrative: buildNarrative({
      thesis,
      policy,
      marketCount,
      alerts,
      research,
      hasArcProof,
      latestAgentRun,
      sentientStatus: sentient.status,
      sentientActiveCount: sentient.activeComponents.length,
    }),
  };
}

function summarizeAgentRun(run: AgentRunRecord): NonNullable<DemoReviewPack["latestAgentRun"]> {
  const sentient = summarizeSentientRunContext(run.sentientContext);

  return {
    id: run.id,
    market: run.market,
    venue: run.venue,
    action: run.action,
    riskGate: run.riskGate,
    confidence: run.confidence,
    stakeUsdc: run.sizing.stakeUsdc,
    summary: run.summary,
    modelStatus: run.modelAnalysis?.status ?? "missing",
    modelRecommendation: run.modelAnalysis?.recommendation ?? null,
    modelConfidence: run.modelAnalysis?.confidence ?? null,
    modelSummary: run.modelAnalysis?.summary ?? null,
    tokenCount: run.modelAnalysis?.usage?.totalTokens ?? null,
    keyDrivers: run.modelAnalysis?.keyDrivers.slice(0, 4) ?? [],
    missingEvidence: run.modelAnalysis?.missingEvidence.slice(0, 4) ?? [],
    sentient: run.sentientContext
      ? {
          ...sentient,
          activeComponents: run.sentientContext.activeComponents,
          waitingComponents: run.sentientContext.waitingComponents,
        }
      : null,
  };
}

function buildNarrative({
  thesis,
  policy,
  marketCount,
  alerts,
  research,
  hasArcProof,
  latestAgentRun,
  sentientStatus,
  sentientActiveCount,
}: {
  thesis: AgentThesis;
  policy: AgentPolicyEvaluation;
  marketCount: number;
  alerts: FlowAlert[];
  research: ResearchSnapshot | null;
  hasArcProof: boolean;
  latestAgentRun: AgentRunRecord | null;
  sentientStatus: string;
  sentientActiveCount: number;
}) {
  return [
    `Circle x402 cached ${marketCount} market records and ${alerts.length} integrity alert groups.`,
    `Research layer found ${research?.sourceCount ?? 0} sources; official confirmation is tracked separately.`,
    latestAgentRun
      ? `Latest agent run is ${latestAgentRun.action} on ${latestAgentRun.venue} with ${Math.round(
          latestAgentRun.confidence * 100,
        )}% confidence.`
      : "No live agent run has been recorded yet.",
    latestAgentRun?.sentientContext
      ? `Research context is ${latestAgentRun.sentientContext.mode}; active components: ${latestAgentRun.sentientContext.activeComponents.length}.`
      : `Research pipeline is ${sentientStatus}; active components: ${sentientActiveCount}.`,
    `Agent thesis is ${thesis.action} with ${Math.round(thesis.confidence * 100)}% confidence.`,
    `Policy is ${policy.status}; wallet execution is disabled and manual approval is required.`,
    hasArcProof
      ? "Latest staged intent has an Arc Testnet proof."
      : "Latest staged intent is ready for Arc proof recording.",
  ];
}
