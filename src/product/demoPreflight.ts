import { buildCurrentDemoReviewPack } from "@/src/product/demoReviewState";
import {
  attachMarketStudioSourceCoverage,
  readMarketStudioSpecs,
  summarizeMarketStudio,
} from "@/src/product/marketStudio";
import { buildProductReadiness } from "@/src/product/productReadiness";
import type { DemoReviewPack } from "@/src/product/reviewPack";
import {
  readCustomSourceRegistry,
  readSourceRegistry,
  summarizeSourceRegistry,
} from "@/src/product/sourceRegistry";
import { buildToolSafetyReport } from "@/src/product/toolSafety";

export type DemoPreflightReport = {
  generatedAt: string;
  status: "ready" | "needs_demo_url" | "blocked";
  summary: string;
  checks: Array<{
    id: string;
    status: "ready" | "pending" | "blocked";
    detail: string;
  }>;
  nextActions: string[];
};

export async function buildDemoPreflight(): Promise<DemoPreflightReport> {
  const [readiness, reviewPack, sourceRegistry, customSources, rawMarketStudio] =
    await Promise.all([
      buildProductReadiness(),
      buildCurrentDemoReviewPack(),
      readSourceRegistry(),
      readCustomSourceRegistry(),
      readMarketStudioSpecs(),
    ]);
  const safety = buildToolSafetyReport();
  const marketStudio = attachMarketStudioSourceCoverage(rawMarketStudio, sourceRegistry);
  const studioSummary = summarizeMarketStudio(marketStudio);
  const sourceSummary = summarizeSourceRegistry(sourceRegistry);
  const checks = [
    {
      id: "core-readiness",
      status: readiness.status === "needs_core_setup" ? "blocked" : "ready",
      detail: readiness.summary,
    },
    {
      id: "live-demo-url",
      status: readiness.blockers.includes("Live demo URL") ? "pending" : "ready",
      detail: readiness.blockers.includes("Live demo URL")
        ? "Public deployment URL is still pending."
        : "Public deployment URL is configured.",
    },
    {
      id: "review-pack",
      status: reviewPack.readiness === "demo-ready" ? "ready" : "pending",
      detail: `Review pack is ${reviewPack.readiness}.`,
    },
    {
      id: "latest-agent-run",
      status: reviewPack.latestAgentRun?.modelStatus === "ok" ? "ready" : "pending",
      detail: reviewPack.latestAgentRun
        ? `Latest run is ${reviewPack.latestAgentRun.action}/${reviewPack.latestAgentRun.riskGate}; model status ${reviewPack.latestAgentRun.modelStatus}.`
        : "No agent run recorded yet.",
    },
    {
      id: "arc-proof",
      status: reviewPack.arcProof.status === "recorded" ? "ready" : "pending",
      detail: reviewPack.arcProof.receiptId
        ? `Arc proof recorded as receipt #${reviewPack.arcProof.receiptId}.`
        : "Arc proof is pending.",
    },
    {
      id: "tool-safety",
      status: safety.status === "pass" ? "ready" : "blocked",
      detail: `${safety.summary.passed}/${safety.summary.total} safety scenarios passed.`,
    },
    {
      id: "source-registry",
      status: sourceSummary.records > 0 ? "ready" : "pending",
      detail: `${sourceSummary.records} total source records; ${customSources.length} user-added records.`,
    },
    {
      id: "market-studio",
      status: studioSummary.sourceReady > 0 ? "ready" : "pending",
      detail: `${studioSummary.specs} market specs; ${studioSummary.sourceReady} source-ready specs.`,
    },
  ] satisfies DemoPreflightReport["checks"];
  const status = readStatus(checks);

  return {
    generatedAt: new Date().toISOString(),
    status,
    summary: buildSummary(status, reviewPack),
    checks,
    nextActions: buildNextActions(checks),
  };
}

function readStatus(checks: DemoPreflightReport["checks"]): DemoPreflightReport["status"] {
  if (checks.some((check) => check.status === "blocked")) return "blocked";
  if (checks.some((check) => check.id === "live-demo-url" && check.status === "pending")) {
    return "needs_demo_url";
  }
  return "ready";
}

function buildSummary(status: DemoPreflightReport["status"], reviewPack: DemoReviewPack) {
  if (status === "blocked") {
    return "Demo has a blocking issue that should be fixed before submission.";
  }

  if (status === "needs_demo_url") {
    return `Product flow is demo-ready locally; deploy URL is the remaining submission blocker. Latest review pack is ${reviewPack.readiness}.`;
  }

  return "Product flow, review pack, safety, source coverage, and public demo URL are ready.";
}

function buildNextActions(checks: DemoPreflightReport["checks"]) {
  const actions: string[] = [];

  if (checks.some((check) => check.id === "live-demo-url" && check.status === "pending")) {
    actions.push("Deploy the app and set NEXT_PUBLIC_APP_URL.");
  }
  if (checks.some((check) => check.id === "latest-agent-run" && check.status === "pending")) {
    actions.push("Run one live agent analysis from the dashboard.");
  }
  if (checks.some((check) => check.id === "source-registry" && check.status === "pending")) {
    actions.push("Add custom Turkey sources from the dashboard if the starter registry is not enough.");
  }
  if (checks.some((check) => check.id === "arc-proof" && check.status === "pending")) {
    actions.push("Record the latest staged intent receipt on Arc Testnet after manual review.");
  }

  return actions.length > 0 ? actions : ["Record final video and submit the public links."];
}
