import type { FlowAlert } from "@/src/product/integrityAnalysis";
import type { ResearchSnapshot, ResearchSource } from "@/src/product/researchAnalysis";

export type AgentThesis = {
  action: "BET_YES" | "BET_NO" | "WAIT" | "DO_NOT_BET" | "RESEARCH_MORE";
  mode: "Manual";
  riskGate: "open" | "review" | "blocked";
  headline: string;
  summary: string;
  confidence: number;
  evidenceScore: number;
  marketCoverage: {
    markets: number;
    paidSnapshot: boolean;
  };
  integrity: {
    status: "clean" | "review" | "blocked" | "missing";
    topMarket: string | null;
    reason: string;
  };
  research: {
    status: "strong" | "usable" | "thin" | "missing";
    query: string | null;
    sources: number;
    officialSources: number;
    highCredibilitySources: number;
    averageScore: number | null;
  };
  reasons: string[];
  missingInputs: string[];
  nextStep: string;
};

export function buildAgentThesis({
  marketCount,
  alert,
  research,
}: {
  marketCount: number;
  alert: FlowAlert | null;
  research: ResearchSnapshot | null;
}): AgentThesis {
  const researchQuality = scoreResearch(research);
  const integrityRisk = scoreIntegrity(alert);
  const coverageScore = marketCount > 0 ? 0.14 : 0;
  const evidenceScore = clamp01(researchQuality.score + integrityRisk.evidenceBonus + coverageScore);
  const directionalLean = inferDirectionalLean(research);
  const action = decideAction(integrityRisk.status, researchQuality.status, directionalLean);
  const riskGate = decideRiskGate(integrityRisk.status, researchQuality.status);
  const confidence = clamp01(0.34 + evidenceScore * 0.42 + integrityRisk.confidenceBonus);
  const reasons = buildReasons({ marketCount, alert, research, researchQuality });
  const missingInputs = buildMissingInputs({ marketCount, alert, research, researchQuality });

  return {
    action,
    mode: "Manual",
    riskGate,
    headline: buildHeadline(action, riskGate),
    summary: buildSummary(action, researchQuality.status, integrityRisk.status),
    confidence,
    evidenceScore,
    marketCoverage: {
      markets: marketCount,
      paidSnapshot: marketCount > 0,
    },
    integrity: {
      status: integrityRisk.status,
      topMarket: alert?.market ?? null,
      reason: alert?.reason ?? "No cached trade-flow scan is available.",
    },
    research: {
      status: researchQuality.status,
      query: research?.query ?? null,
      sources: research?.sourceCount ?? 0,
      officialSources: research?.officialSources ?? 0,
      highCredibilitySources: countHighCredibilitySources(research),
      averageScore: research?.averageScore ?? null,
    },
    reasons,
    missingInputs,
    nextStep: buildNextStep(action, missingInputs),
  };
}

function scoreResearch(research: ResearchSnapshot | null) {
  if (!research) {
    return { score: 0, status: "missing" as const };
  }

  const highCredibilitySources = countHighCredibilitySources(research);
  const officialBoost = Math.min(0.24, research.officialSources * 0.12);
  const highCredBoost = Math.min(0.18, highCredibilitySources * 0.06);
  const sourceDepth = Math.min(0.22, research.sourceCount * 0.0275);
  const relevance = Math.min(0.2, Math.max(0, research.averageScore ?? 0));
  const score = clamp01(officialBoost + highCredBoost + sourceDepth + relevance);

  if (research.officialSources > 0 && research.sourceCount >= 4) {
    return { score, status: "strong" as const };
  }

  if (highCredibilitySources > 0 && research.sourceCount >= 4) {
    return { score, status: "usable" as const };
  }

  if (research.sourceCount >= 3) {
    return { score, status: "thin" as const };
  }

  return { score, status: "missing" as const };
}

function scoreIntegrity(alert: FlowAlert | null) {
  if (!alert) {
    return {
      status: "missing" as const,
      evidenceBonus: 0,
      confidenceBonus: 0,
    };
  }

  if (alert.risk === "High" || alert.score >= 72) {
    return {
      status: "blocked" as const,
      evidenceBonus: 0.2,
      confidenceBonus: 0.12,
    };
  }

  if (alert.risk === "Medium" || alert.score >= 48) {
    return {
      status: "review" as const,
      evidenceBonus: 0.16,
      confidenceBonus: 0.08,
    };
  }

  return {
    status: "clean" as const,
    evidenceBonus: 0.12,
    confidenceBonus: 0.04,
  };
}

function decideAction(
  integrityStatus: AgentThesis["integrity"]["status"],
  researchStatus: AgentThesis["research"]["status"],
  directionalLean: "YES" | "NO" | null,
): AgentThesis["action"] {
  if (integrityStatus === "blocked") return "DO_NOT_BET";
  if (researchStatus === "missing" || researchStatus === "thin") return "RESEARCH_MORE";
  if (directionalLean === "YES") return "BET_YES";
  if (directionalLean === "NO") return "BET_NO";
  return "WAIT";
}

function decideRiskGate(
  integrityStatus: AgentThesis["integrity"]["status"],
  researchStatus: AgentThesis["research"]["status"],
): AgentThesis["riskGate"] {
  if (integrityStatus === "blocked") return "blocked";
  if (integrityStatus === "review" || researchStatus === "thin" || researchStatus === "missing") {
    return "review";
  }
  return "open";
}

function buildHeadline(action: AgentThesis["action"], riskGate: AgentThesis["riskGate"]) {
  if (action === "BET_YES") return "Manual YES lean found";
  if (action === "BET_NO") return "Manual NO lean found";
  if (action === "DO_NOT_BET") return "Execution blocked by integrity risk";
  if (action === "RESEARCH_MORE") return "More source validation needed";
  if (riskGate === "review") return "Manual review before any intent";
  return "Watchlist-ready, no autonomous execution";
}

function buildSummary(
  action: AgentThesis["action"],
  researchStatus: AgentThesis["research"]["status"],
  integrityStatus: AgentThesis["integrity"]["status"],
) {
  if (action === "DO_NOT_BET") {
    return "The agent has enough flow evidence to reject execution until the suspicious activity is resolved.";
  }

  if (action === "BET_YES" || action === "BET_NO") {
    return "The evidence set points to a directional manual lean, but execution still requires human approval.";
  }

  if (researchStatus === "thin" || researchStatus === "missing") {
    return "The agent can keep watching, but the research set is not strong enough to size a position.";
  }

  if (integrityStatus === "review") {
    return "Research is usable, but market-flow risk keeps the decision in manual review.";
  }

  return "The current state supports watchlist monitoring and a manual approval workflow.";
}

function buildReasons({
  marketCount,
  alert,
  research,
  researchQuality,
}: {
  marketCount: number;
  alert: FlowAlert | null;
  research: ResearchSnapshot | null;
  researchQuality: ReturnType<typeof scoreResearch>;
}) {
  const reasons: string[] = [];

  if (marketCount > 0) {
    reasons.push(`${marketCount} paid market records are cached from Circle x402.`);
  }

  if (alert) {
    reasons.push(`Top flow alert is ${alert.risk.toLowerCase()} risk: ${alert.reason}.`);
  }

  if (research) {
    reasons.push(
      `${research.sourceCount} paid research sources found; ${research.officialSources} are official.`,
    );
  }

  if (researchQuality.status === "thin") {
    reasons.push("Research coverage exists, but trusted/official source weight is still low.");
  }

  return reasons.length > 0 ? reasons : ["No cached paid market or research inputs are available yet."];
}

function buildMissingInputs({
  marketCount,
  alert,
  research,
  researchQuality,
}: {
  marketCount: number;
  alert: FlowAlert | null;
  research: ResearchSnapshot | null;
  researchQuality: ReturnType<typeof scoreResearch>;
}) {
  const missing: string[] = [];

  if (marketCount === 0) missing.push("Paid market snapshot");
  if (!alert) missing.push("Paid trade-flow scan");
  if (!research) missing.push("Paid research snapshot");
  if (research && researchQuality.status === "thin") {
    missing.push("Official or high-credibility source confirmation");
  }

  return missing;
}

function buildNextStep(action: AgentThesis["action"], missingInputs: string[]) {
  if (action === "DO_NOT_BET") {
    return "Keep execution disabled and record a review receipt on Arc if this market matters.";
  }

  if (action === "BET_YES" || action === "BET_NO") {
    return "Review sizing, source quality, and policy gates before staging a manual intent.";
  }

  if (missingInputs.length > 0) {
    return `Collect: ${missingInputs.join(", ")}.`;
  }

  return "Keep in manual mode and prepare an approval intent only after position sizing is reviewed.";
}

function inferDirectionalLean(research: ResearchSnapshot | null): "YES" | "NO" | null {
  if (!research) return null;
  const text = [research.query, ...research.topSources.slice(0, 8).map((source) => source.content)].join(" ");
  if (/\b(?:yes|bet yes|buy yes)\b.{0,80}\b(?:positive ev|expected value|advantaged|mispriced|edge)\b/i.test(text)) {
    return "YES";
  }
  if (/\b(?:no|bet no|buy no)\b.{0,80}\b(?:positive ev|expected value|advantaged|mispriced|edge)\b/i.test(text)) {
    return "NO";
  }
  return null;
}

function countHighCredibilitySources(research: ResearchSnapshot | null) {
  if (!research) return 0;
  return research.topSources.filter(isHighCredibilitySource).length;
}

function isHighCredibilitySource(source: ResearchSource) {
  return source.credibility === "Official" || source.credibility === "High";
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
