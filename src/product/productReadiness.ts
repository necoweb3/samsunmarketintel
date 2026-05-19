import { readFile, stat } from "node:fs/promises";

import { readPrimaryModelConfig } from "@/src/product/primaryModel";
import { readSentientResearchConfig } from "@/src/product/sentientResearchConfig";
import { readCustomSourceRegistry } from "@/src/product/sourceRegistry";
import { buildToolSafetyReport } from "@/src/product/toolSafety";

export type ProductReadinessStatus =
  | "ready_for_live_api_tests"
  | "infra_ready_api_keys_pending"
  | "needs_core_setup";

export type ReadinessCheckStatus = "ready" | "pending" | "blocked";

export type ProductReadinessCheck = {
  id: string;
  label: string;
  category: "core" | "data" | "agent" | "research" | "proof" | "demo";
  status: ReadinessCheckStatus;
  detail: string;
  nextAction: string | null;
};

export type ProductReadinessReport = {
  generatedAt: string;
  status: ProductReadinessStatus;
  summary: string;
  checks: ProductReadinessCheck[];
  blockers: string[];
  apiBinding: {
    ready: boolean;
    nextRequired: string[];
    optionalLater: string[];
    recommendation: string;
  };
};

const MARKET_CACHE = ".cache/x402/latest-polymarket-markets.json";
const TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";
const RESEARCH_CACHE = ".cache/x402/latest-research-search.json";
const AGENT_RUNS_CACHE = ".cache/agent/runs.json";
const INTENTS_CACHE = ".cache/agent/intents.json";
const INTENT_PROOF_CACHE = ".cache/arc/latest-intent-receipt.json";

type Env = Record<string, string | undefined>;

export async function buildProductReadiness(env: Env = process.env): Promise<ProductReadinessReport> {
  const [marketCache, tradesCache, researchCache, runsCache, intentsCache, proofPayload] =
    await Promise.all([
      readFileStatus(MARKET_CACHE),
      readFileStatus(TRADES_CACHE),
      readFileStatus(RESEARCH_CACHE),
      readFileStatus(AGENT_RUNS_CACHE),
      readFileStatus(INTENTS_CACHE),
      readJson(INTENT_PROOF_CACHE),
    ]);
  const customSources = await readCustomSourceRegistry();
  const sentient = readSentientResearchConfig(env);
  const primaryModel = readPrimaryModelConfig(env);
  const safety = buildToolSafetyReport();
  const hasArcContract = hasValue(env.ANALYSIS_RECEIPT_CONTRACT);
  const hasArcProof = hasRecordedProof(proofPayload);
  const hasLiveUrl = hasValue(env.NEXT_PUBLIC_APP_URL) || hasValue(env.VERCEL_URL);
  const x402Ready = marketCache.exists && tradesCache.exists && researchCache.exists;
  const agentReady = runsCache.exists && intentsCache.exists;
  const proofReady = hasArcContract && hasArcProof;
  const primaryModelReady = primaryModel.status === "ready";
  const safetyReady = safety.status === "pass";

  const checks: ProductReadinessCheck[] = [
    {
      id: "circle-x402-cache",
      label: "Circle x402 cached inputs",
      category: "data",
      status: x402Ready ? "ready" : "pending",
      detail: x402Ready
        ? "Market data, trade-flow data, and research cache are available."
        : "At least one x402 cache is missing.",
      nextAction: x402Ready
        ? null
        : "Run the approved x402 market, trade, and research calls after manual approval.",
    },
    {
      id: "agent-ledgers",
      label: "Agent run and intent ledgers",
      category: "agent",
      status: agentReady ? "ready" : "pending",
      detail: agentReady
        ? "Local analysis runs and staged intents are recorded."
        : "Agent run or staged-intent cache is missing.",
      nextAction: agentReady ? null : "Run the agent once and stage a watch/intent from the dashboard.",
    },
    {
      id: "arc-proof",
      label: "Arc proof layer",
      category: "proof",
      status: proofReady ? "ready" : "pending",
      detail: proofReady
        ? "Receipt contract is configured and the latest staged intent has an Arc proof."
        : "Receipt contract config or latest Arc proof is missing.",
      nextAction: proofReady
        ? null
        : "Prepare and record the latest staged intent receipt on Arc Testnet after manual review.",
    },
    {
      id: "primary-model",
      label: "Primary reasoning model",
      category: "research",
      status: primaryModelReady ? "ready" : "pending",
      detail: primaryModelReady
        ? `${primaryModel.provider} is configured for ${primaryModel.model}.`
        : `${primaryModel.provider} is selected, but ${primaryModel.missing.join(", ")} is missing.`,
      nextAction: primaryModelReady
        ? null
        : "Choose one LiteLLM-compatible model provider and add only that provider key first.",
    },
    {
      id: "tool-safety-gate",
      label: "Tool safety gate",
      category: "core",
      status: safetyReady ? "ready" : "blocked",
      detail: safetyReady
        ? `${safety.summary.passed}/${safety.summary.total} tool-call safety scenarios passed.`
        : "One or more protected tool-call scenarios failed.",
      nextAction: safetyReady
        ? null
        : "Fix tool-call guardrails before enabling live model or payment flows.",
    },
    {
      id: "opendeepsearch",
      label: "OpenDeepSearch optional stack",
      category: "research",
      status: sentient.status === "ready" ? "ready" : "pending",
      detail:
        sentient.status === "ready"
          ? "Standalone OpenDeepSearch is configured."
          : `Standalone OpenDeepSearch is optional for now; missing ${sentient.missing.join(", ")}.`,
      nextAction:
        sentient.status === "ready"
          ? null
          : "Delay Serper/Jina unless x402 research quality is not enough.",
    },
    {
      id: "source-registry",
      label: "Turkey source registry",
      category: "research",
      status: customSources.length > 0 ? "ready" : "pending",
      detail:
        customSources.length > 0
          ? `${customSources.length} starter/custom source(s) are registered.`
          : "Base credibility rules exist; starter or user-provided Turkey sources still need to be added.",
      nextAction:
        customSources.length > 0
          ? null
          : "Seed the starter source pack, then add Turkish news and X/Twitter sources before final probability tests.",
    },
    {
      id: "live-demo-url",
      label: "Live demo URL",
      category: "demo",
      status: hasLiveUrl ? "ready" : "pending",
      detail: hasLiveUrl ? "A public app URL is configured." : "The app is local-only right now.",
      nextAction: hasLiveUrl ? null : "Deploy after API keys and source lists are settled.",
    },
  ];

  const coreReady = x402Ready && agentReady && proofReady && safetyReady;
  const apiReady = coreReady && primaryModelReady;
  const status: ProductReadinessStatus = apiReady
    ? "ready_for_live_api_tests"
    : coreReady
      ? "infra_ready_api_keys_pending"
      : "needs_core_setup";

  return {
    generatedAt: new Date().toISOString(),
    status,
    summary: buildSummary(status),
    checks,
    blockers: checks
      .filter((check) => check.status === "blocked" || (check.status === "pending" && check.id !== "opendeepsearch"))
      .map((check) => check.label),
    apiBinding: {
      ready: apiReady,
      nextRequired: primaryModelReady
        ? []
        : [`Add ${primaryModel.missing.join(" or ")} for the selected primary model.`],
      optionalLater: [
        "JINA_API_KEY for semantic reranking after x402 research comparison",
        "SERPER_API_KEY for standalone OpenDeepSearch if needed",
        "User-curated Turkey X/news accounts after starter source pack",
        "Deployment URL after live API tests pass",
      ],
      recommendation: apiReady
        ? "The product can start live API trials with the selected model and current Circle x402 flow."
        : "Do not buy multiple APIs yet. Add one primary model key first, then compare x402 research quality before buying Serper or Jina.",
    },
  };
}

function buildSummary(status: ProductReadinessStatus) {
  if (status === "ready_for_live_api_tests") {
    return "Core product flow and primary model provider are ready for live API trials.";
  }
  if (status === "infra_ready_api_keys_pending") {
    return "Core product flow is ready; live API trials are waiting on one primary model key.";
  }
  return "Core product setup still needs local data, agent ledger, or Arc proof completion.";
}

async function readFileStatus(path: string) {
  try {
    const file = await stat(path);
    return {
      exists: file.isFile() && file.size > 0,
      size: file.size,
      updatedAt: file.mtime.toISOString(),
    };
  } catch {
    return {
      exists: false,
      size: 0,
      updatedAt: null,
    };
  }
}

async function readJson(path: string) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    return null;
  }
}

function hasRecordedProof(payload: unknown) {
  if (!isObject(payload)) return false;
  return hasValue(readString(payload.transactionHash)) || hasValue(readString(payload.explorerUrl));
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
