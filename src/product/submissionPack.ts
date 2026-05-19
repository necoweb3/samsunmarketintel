import type { ProductReadinessReport } from "@/src/product/productReadiness";
import type { DemoReviewPack } from "@/src/product/reviewPack";

export type SubmissionPack = {
  generatedAt: string;
  projectName: string;
  oneLiner: string;
  problemStatement: string;
  projectDescription: string;
  traction: string;
  sourceCode: string;
  liveUrl: string;
  videoDemoPlan: string[];
  circleArcFeedback: string;
  generalFeedback: string;
  technicalHighlights: string[];
  demoReadiness: {
    status: ProductReadinessReport["status"];
    blockers: string[];
    reviewPackReadiness: DemoReviewPack["readiness"];
  };
  proofPoints: string[];
};

type SubmissionPackInput = {
  reviewPack: DemoReviewPack;
  readiness: ProductReadinessReport;
  env?: Record<string, string | undefined>;
};

export function buildSubmissionPack({
  reviewPack,
  readiness,
  env = process.env,
}: SubmissionPackInput): SubmissionPack {
  const liveUrl = readLiveUrl(env);
  const latestRun = reviewPack.latestAgentRun;

  return {
    generatedAt: new Date().toISOString(),
    projectName: env.PROJECT_NAME?.trim() || "Samsun Market Intel",
    oneLiner:
      "A guarded prediction-market intelligence agent for finding +EV opportunities, detecting suspicious flow, and designing stablecoin-settled market verticals.",
    problemStatement:
      "Prediction markets contain useful signal, but finding mispriced contracts requires fast synthesis of market data, news, source credibility, and manipulation risk. Builders also need better tools for launching under-served verticals such as Turkey macro, FX/rates, and market integrity markets with clear oracle and settlement design.",
    projectDescription: buildProjectDescription(reviewPack),
    traction: buildTraction(readiness, reviewPack),
    sourceCode: env.NEXT_PUBLIC_REPOSITORY_URL?.trim() || "Pending public GitHub URL",
    liveUrl,
    videoDemoPlan: buildVideoDemoPlan(reviewPack),
    circleArcFeedback: buildCircleArcFeedback(reviewPack),
    generalFeedback:
      "The RFB structure made the product direction concrete. The strongest next improvement would be more end-to-end examples that connect x402 paid data, agent wallets, Arc receipts, and dashboard UX in one reference app.",
    technicalHighlights: buildTechnicalHighlights(reviewPack),
    demoReadiness: {
      status: readiness.status,
      blockers: readiness.blockers,
      reviewPackReadiness: reviewPack.readiness,
    },
    proofPoints: buildProofPoints(reviewPack),
  };
}

export function renderSubmissionPackMarkdown(pack: SubmissionPack) {
  return [
    `# ${pack.projectName} Submission Pack`,
    "",
    `Generated: ${pack.generatedAt}`,
    "",
    "## One-liner",
    "",
    pack.oneLiner,
    "",
    "## Problem Statement",
    "",
    pack.problemStatement,
    "",
    "## Project Description",
    "",
    pack.projectDescription,
    "",
    "## Traction",
    "",
    pack.traction,
    "",
    "## Technical Highlights",
    "",
    ...pack.technicalHighlights.map((item) => `- ${item}`),
    "",
    "## Proof Points",
    "",
    ...pack.proofPoints.map((item) => `- ${item}`),
    "",
    "## Video Demo Plan",
    "",
    ...pack.videoDemoPlan.map((item, index) => `${index + 1}. ${item}`),
    "",
    "## Circle / Arc Feedback",
    "",
    pack.circleArcFeedback,
    "",
    "## General Feedback",
    "",
    pack.generalFeedback,
    "",
    "## Links",
    "",
    `- Source code: ${pack.sourceCode}`,
    `- Live app: ${pack.liveUrl}`,
    "",
  ].join("\n");
}

function buildProjectDescription(reviewPack: DemoReviewPack) {
  const latestRun = reviewPack.latestAgentRun;

  return [
    "Samsun Market Intel is a manual guarded AI agent dashboard for prediction-market research and market creation.",
    "It combines Circle x402 paid market/research services, a source credibility registry, suspicious-flow analysis, Kelly-style sizing, policy gates, and Arc Testnet proof receipts.",
    latestRun
      ? `The latest agent run analyzed: "${latestRun.market}" and returned ${latestRun.action}/${latestRun.riskGate}.`
      : "The agent can run against watchlist markets or user-provided market/news prompts.",
    "The product is intentionally not an autonomous betting bot yet: every trade intent is staged for human review, wallet execution is disabled, and protected actions pass through a safety gate.",
    "A Market Studio panel supports RFB 03-style vertical design by turning Turkey macro, FX/rates, and market-integrity ideas into structured market specs with oracle sources, settlement rails, liquidity plans, and source coverage checks.",
  ].join(" ");
}

function buildTraction(readiness: ProductReadinessReport, reviewPack: DemoReviewPack) {
  return [
    "Current traction is technical validation rather than public users.",
    `The local demo has cached ${reviewPack.inputs.paidMarkets} paid market records, ${reviewPack.inputs.tradeFlowAlerts} suspicious-flow alert groups, and ${reviewPack.inputs.researchSources} paid research sources.`,
    `It has ${reviewPack.inputs.sourceRegistryRecords} source registry records, ${reviewPack.inputs.marketStudioSpecs} market studio specs, and the latest staged intent has Arc proof status: ${reviewPack.arcProof.status}.`,
    `Readiness status is ${readiness.status}; remaining blockers are ${readiness.blockers.length > 0 ? readiness.blockers.join(", ") : "none"}.`,
  ].join(" ");
}

function buildVideoDemoPlan(reviewPack: DemoReviewPack) {
  return [
    "Open the dashboard and show Arc/x402/Safety status.",
    "Run a market or pasted-news agent analysis and show Gemini memo, drivers, missing evidence, sizing, and policy guard.",
    "Stage a manual watch/intent and show wallet execution remains disabled.",
    "Show Demo Review Pack with Circle x402 inputs, latest agent run, policy, and Arc proof.",
    `Open Arc explorer for receipt ${reviewPack.arcProof.receiptId ?? "pending"} if available.`,
    "Show Market Studio and Source Registry for RFB 03 market creation and source coverage.",
  ];
}

function buildCircleArcFeedback(reviewPack: DemoReviewPack) {
  return [
    "Arc fits this product because prediction-market agents need predictable USDC-denominated settlement and fast proof records for decisions, intents, and review artifacts.",
    "Circle x402 was useful as a pay-per-request data layer: market data, trade-flow scans, and research can be consumed without building a separate billing system.",
    `In this demo the review pack records ${reviewPack.inputs.paidMarkets} market records and ${reviewPack.inputs.tradeFlowAlerts} flow alert groups, while the latest intent proof is ${reviewPack.arcProof.status}.`,
    "The main improvement request is more unified examples that show agent wallet funding, Gateway/x402 payment, and Arc receipt recording in one polished reference flow.",
  ].join(" ");
}

function buildTechnicalHighlights(reviewPack: DemoReviewPack) {
  return [
    "Circle x402 paid data cache for Polymarket market, trade-flow, and research inputs.",
    "Manual guarded agent run endpoint with deterministic sizing, policy checks, and Gemini/OpenRouter analysis.",
    `Research pipeline is ${reviewPack.sentient.status}; active components include ${reviewPack.sentient.activeComponents.slice(0, 3).join(", ")}.`,
    "Tool safety gate that blocks source-text or memory-injected payment, wallet, Arc, and intent actions.",
    "Arc Testnet receipt contract and latest staged-intent proof tracking.",
    "Source Registry for domain/source credibility and Market Studio source coverage.",
    reviewPack.latestAgentRun
      ? `Latest model run used ${reviewPack.latestAgentRun.tokenCount ?? "unknown"} tokens.`
      : "Agent run ledger is ready for live demos.",
  ];
}

function buildProofPoints(reviewPack: DemoReviewPack) {
  return [
    `Review pack readiness: ${reviewPack.readiness}.`,
    `Policy: ${reviewPack.policy.status}; wallet execution: ${reviewPack.policy.walletExecution ? "enabled" : "disabled"}.`,
    `Arc proof: ${reviewPack.arcProof.receiptId ? `#${reviewPack.arcProof.receiptId}` : reviewPack.arcProof.status}.`,
    `Inputs: ${reviewPack.inputs.paidMarkets} paid markets, ${reviewPack.inputs.tradeFlowAlerts} flow alerts, ${reviewPack.inputs.researchSources} research sources.`,
    reviewPack.latestAgentRun
      ? `Latest run: ${reviewPack.latestAgentRun.action}/${reviewPack.latestAgentRun.riskGate} on ${reviewPack.latestAgentRun.venue}.`
      : "No live agent run recorded yet.",
    `Research stack: ${reviewPack.sentient.safety} safety, ${reviewPack.sentient.openDeepSearch} OpenDeepSearch, ${reviewPack.sentient.roma} ROMA.`,
  ];
}

function readLiveUrl(env: Record<string, string | undefined>) {
  if (env.NEXT_PUBLIC_APP_URL?.trim()) return env.NEXT_PUBLIC_APP_URL.trim();
  if (env.VERCEL_URL?.trim()) return `https://${env.VERCEL_URL.trim()}`;
  return "Pending deployment URL";
}
