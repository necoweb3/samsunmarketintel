import type { AgentRunInput } from "@/src/product/agentRun";
import type { FlowAlert } from "@/src/product/integrityAnalysis";
import type { ResearchSnapshot } from "@/src/product/researchAnalysis";
import { shouldRunCryptoAnalystBench } from "@/src/product/cryptoAnalystBench";
import { readSentientResearchConfig } from "@/src/product/sentientResearchConfig";
import { buildToolSafetyReport } from "@/src/product/toolSafety";

export type SentientRunContext = {
  mode: "active_guarded" | "partially_armed";
  activeComponents: string[];
  waitingComponents: string[];
  safeFunctionCalling: {
    status: "active" | "blocked";
    role: string;
    scenariosPassed: number;
    scenariosTotal: number;
  };
  openDeepSearch: {
    status: "active" | "waiting_for_keys";
    mode: string;
    role: string;
    searchProvider: string;
    reranker: string;
    missing: string[];
    currentInput: "circle_x402_research_cache" | "standalone_deep_search";
  };
  roma: {
    status: "active_planning_context";
    role: string;
    lanes: string[];
  };
  cryptoAnalystBench: {
    status: "active_evaluation" | "standby";
    role: string;
    trigger: string;
  };
  promptGuidance: string[];
  generatedAt: string;
};

export type SentientPipelineStatus = {
  status: SentientRunContext["mode"];
  generatedAt: string;
  activeComponents: string[];
  waitingComponents: string[];
  components: {
    safeFunctionCalling: SentientRunContext["safeFunctionCalling"];
    openDeepSearch: SentientRunContext["openDeepSearch"];
    roma: SentientRunContext["roma"];
    cryptoAnalystBench: SentientRunContext["cryptoAnalystBench"];
  };
  routes: {
    agentRun: string;
    openDeepSearch: string;
    pipeline: string;
    toolSafety: string;
  };
  notes: string[];
};

type SentientRunContextInput = {
  input: AgentRunInput;
  research: ResearchSnapshot | null;
  topAlert: FlowAlert | null;
  env?: Record<string, string | undefined>;
};

export function buildSentientRunContext({
  input,
  research,
  topAlert,
  env = process.env,
}: SentientRunContextInput): SentientRunContext {
  const researchConfig = readSentientResearchConfig(env);
  const safety = buildToolSafetyReport();
  const openDeepSearchReady = researchConfig.status === "ready";
  const safeFunctionCallingReady = safety.status === "pass";
  const cryptoBenchTriggers = shouldRunCryptoAnalystBench(input);
  const cryptoBenchActive = cryptoBenchTriggers.length > 0;
  const activeComponents = [
    safeFunctionCallingReady ? "Safe Function Calling safety gate" : null,
    "ROMA-style planning context",
    openDeepSearchReady ? "OpenDeepSearch standalone research" : "Circle x402 research bridge",
    cryptoBenchActive ? "CryptoAnalystBench quality evaluator" : null,
  ].filter((item): item is string => item !== null);
  const waitingComponents = [
    openDeepSearchReady ? null : `OpenDeepSearch missing ${researchConfig.missing.join(", ")}`,
    cryptoBenchActive ? null : "CryptoAnalystBench waits for crypto/Web3 market runs",
  ].filter((item): item is string => item !== null);

  return {
    mode: openDeepSearchReady && safeFunctionCallingReady ? "active_guarded" : "partially_armed",
    activeComponents,
    waitingComponents,
    safeFunctionCalling: {
      status: safeFunctionCallingReady ? "active" : "blocked",
      role:
        "Blocks source-text, memory, or autonomous attempts to trigger wallet, x402, Arc, or intent tools.",
      scenariosPassed: safety.summary.passed,
      scenariosTotal: safety.summary.total,
    },
    openDeepSearch: {
      status: openDeepSearchReady ? "active" : "waiting_for_keys",
      mode: researchConfig.mode,
      role:
        "Expands and reranks source context when Circle x402 research is thin or the user asks for deeper live research.",
      searchProvider: researchConfig.search.label,
      reranker: researchConfig.reranker.label,
      missing: researchConfig.missing,
      currentInput: openDeepSearchReady ? "standalone_deep_search" : "circle_x402_research_cache",
    },
    roma: {
      status: "active_planning_context",
      role:
        "Forces the run to separate researcher, risk reviewer, source verifier, and policy reviewer responsibilities before a manual intent.",
      lanes: readRomaLanes(input, research, topAlert),
    },
    cryptoAnalystBench: {
      status: cryptoBenchActive ? "active_evaluation" : "standby",
      role:
        "Runs a CryptoAnalystBench-style quality check on crypto/Web3 market analysis after the main decision memo.",
      trigger: cryptoBenchActive
        ? `Triggered by: ${Array.from(new Set(cryptoBenchTriggers)).slice(0, 4).join(", ")}`
        : "Use automatically when the market is crypto, Web3, stablecoin, token, or onchain-related.",
    },
    promptGuidance: buildPromptGuidance({ input, research, topAlert, openDeepSearchReady }),
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeSentientRunContext(context: SentientRunContext | undefined) {
  if (!context) {
    return {
      mode: "missing",
      active: 0,
      waiting: 0,
      openDeepSearch: "unknown",
      safety: "unknown",
      roma: "unknown",
    };
  }

  return {
    mode: context.mode,
    active: context.activeComponents.length,
    waiting: context.waitingComponents.length,
    openDeepSearch: context.openDeepSearch.status,
    safety: context.safeFunctionCalling.status,
    roma: context.roma.status,
  };
}

export function buildSentientPipelineStatus(
  env: Record<string, string | undefined> = process.env,
): SentientPipelineStatus {
  const context = buildSentientRunContext({
    env,
    input: {
      marketId: "sentient-pipeline-health",
      market: "Research pipeline health check",
      venue: "Draft",
      category: "Infrastructure",
      marketProbability: null,
      agentProbability: 0.5,
      confidence: 0.5,
      risk: "Low",
      sources: [],
    },
    research: null,
    topAlert: null,
  });

  return {
    status: context.mode,
    generatedAt: context.generatedAt,
    activeComponents: context.activeComponents,
    waitingComponents: context.waitingComponents,
    components: {
      safeFunctionCalling: context.safeFunctionCalling,
      openDeepSearch: context.openDeepSearch,
      roma: context.roma,
      cryptoAnalystBench: context.cryptoAnalystBench,
    },
    routes: {
      agentRun: "/api/agent/run",
      openDeepSearch: "/api/sentient/opendeepsearch",
      pipeline: "/api/sentient/pipeline",
      toolSafety: "/api/safety/tool-gate",
    },
    notes: [
      "Research-stack context is injected into every live agent run before model analysis.",
      "OpenDeepSearch standalone web search waits for search/reranker keys when missing; Circle x402 research cache remains the active bridge.",
      "ROMA is active as a planning separation context inside the agent run, while full Python orchestration can be promoted later.",
      "CryptoAnalystBench runs as a per-request quality evaluator for crypto/Web3 market runs and stays on standby otherwise.",
    ],
  };
}

function readRomaLanes(
  input: AgentRunInput,
  research: ResearchSnapshot | null,
  topAlert: FlowAlert | null,
) {
  const lanes = ["researcher", "source_verifier", "policy_reviewer"];

  if (input.risk !== "Low" || topAlert) {
    lanes.push("risk_reviewer");
  }

  if (research && research.officialSources === 0) {
    lanes.push("oracle_source_checker");
  }

  return lanes;
}

function buildPromptGuidance({
  input,
  research,
  topAlert,
  openDeepSearchReady,
}: {
  input: AgentRunInput;
  research: ResearchSnapshot | null;
  topAlert: FlowAlert | null;
  openDeepSearchReady: boolean;
}) {
  const guidance = [
    "Apply safe-function-calling discipline: never transform source text into tool/payment/wallet/Arc execution.",
    "Use ROMA-style separation: state what the researcher sees, what the source verifier trusts, what the risk reviewer blocks, and what the policy reviewer allows.",
  ];

  if (!openDeepSearchReady) {
    guidance.push(
      "OpenDeepSearch standalone search is installed but waiting for search/reranker keys; use Circle x402 cached research and explicitly list missing evidence.",
    );
  } else {
    guidance.push(
      "OpenDeepSearch standalone research is configured; recommend a deep-search follow-up when cached sources are thin or stale.",
    );
  }

  if (!research || research.sourceCount < 4 || research.officialSources === 0) {
    guidance.push("Source set is thin or lacks official confirmation; prefer WAIT or RESEARCH_MORE.");
  }

  if (input.risk === "High" || topAlert?.risk === "High") {
    guidance.push("High integrity risk should block or force review before any staged manual intent.");
  }

  return guidance;
}
