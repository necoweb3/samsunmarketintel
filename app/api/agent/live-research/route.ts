import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requestLiveAgentModelAnalysis } from "@/src/product/agentModelAnalysis";
import type { LiveAgentModelAnalysis } from "@/src/product/agentModelAnalysis";
import { buildAgentRun, type AgentRunRecord } from "@/src/product/agentRun";
import { appendAgentRun, readAgentRunLedger } from "@/src/product/agentRunLedger";
import { evaluateCryptoAnalystBench } from "@/src/product/cryptoAnalystBench";
import { readIntentLedger } from "@/src/product/intentLedger";
import { buildIntegritySnapshot } from "@/src/product/integrityAnalysis";
import { runLiveX402Research } from "@/src/product/liveX402Research";
import { buildResearchSnapshot } from "@/src/product/researchAnalysis";
import { buildSentientRunContext } from "@/src/product/sentientActivation";
import { readSourceRegistry } from "@/src/product/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const liveResearchSchema = z.object({
  marketId: z.string().min(1),
  market: z.string().min(1),
  venue: z.enum(["Polymarket", "Draft"]),
  category: z.string().min(1),
  marketProbability: z.number().min(0).max(1).nullable(),
  agentProbability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  risk: z.enum(["Low", "Medium", "High"]),
  sources: z.array(z.string().min(1)).default([]),
  marketPriceLabel: z.string().max(80).optional(),
  originalUrl: z.string().url().optional(),
  marketSlug: z.string().min(1).optional(),
  conditionId: z.string().min(1).optional(),
  tokenIds: z.array(z.string().min(1)).optional(),
  outcomeSummary: z.string().max(2500).optional(),
  maxTotalUsdc: z.number().min(0.001).max(10).default(6),
});

const TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";
const RESEARCH_CACHE = ".cache/x402/latest-research-search.json";

export async function POST(request: Request) {
  const parsed = liveResearchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        run: null,
        message: "Invalid live paid research request.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const query = buildPaidResearchQuery(input);
  const [paidResearch, tradePayload, researchPayload, sourceRegistry, intents, existingRuns] =
    await Promise.all([
      runLiveX402Research({
        marketId: input.marketId,
        query,
        maxTotalUsdc: input.maxTotalUsdc,
      }),
      readJson(TRADES_CACHE),
      readJson(RESEARCH_CACHE),
      readSourceRegistry(),
      readIntentLedger(),
      readAgentRunLedger(),
    ]);
  const deterministicRun = buildAgentRun(input, intents.intents);
  const previousRun = findPreviousRun(input, existingRuns.runs);
  const integrity = tradePayload ? buildIntegritySnapshot(tradePayload) : null;
  const research = researchPayload ? buildResearchSnapshot(researchPayload, { sourceRegistry }) : null;
  const sentientContext = buildSentientRunContext({
    input,
    research,
    topAlert: integrity?.alerts[0] ?? null,
  });
  const refreshedModelAnalysis = await requestLiveAgentModelAnalysis({
    input,
    run: deterministicRun,
    research,
    marketResearch: null,
    paidResearch,
    topAlert: integrity?.alerts[0] ?? null,
    sentientContext,
    analysisLayer: "x402_upgrade",
    baselineAnalysis: previousRun?.modelAnalysis ?? null,
  });
  const modelAnalysis = preservePreviousAnalysisOnRefreshGap(
    refreshedModelAnalysis,
    previousRun?.modelAnalysis,
    paidResearch.status,
  );
  const cryptoBench = evaluateCryptoAnalystBench({
    input,
    modelAnalysis,
    research,
    marketResearch: null,
    paidResearch,
  });
  const run = {
    ...deterministicRun,
    sentientContext,
    marketResearch: previousRun?.marketResearch,
    paidResearch,
    baselineAnalysis: previousRun?.modelAnalysis,
    modelAnalysis,
    cryptoBench,
  };
  const ledger = await appendAgentRun(run);

  return NextResponse.json(
    {
      status: "ok",
      run,
      ledger,
      paidResearch,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function findPreviousRun(
  input: z.infer<typeof liveResearchSchema>,
  runs: AgentRunRecord[],
) {
  const matches = runs.filter((run) =>
    run.marketId === input.marketId ||
    (input.originalUrl && run.originalUrl === input.originalUrl) ||
    (input.marketSlug && run.marketSlug === input.marketSlug) ||
    run.market.toLowerCase() === input.market.toLowerCase(),
  );

  return matches.find((run) => run.modelAnalysis?.status === "ok") ?? matches[0];
}

function preservePreviousAnalysisOnRefreshGap(
  refreshed: LiveAgentModelAnalysis,
  previous: LiveAgentModelAnalysis | undefined,
  paidStatus: string,
): LiveAgentModelAnalysis {
  if (refreshed.status === "ok") return refreshed;
  if (!previous || previous.status !== "ok") return refreshed;

  const note =
    `Circle x402 paid research completed with status '${paidStatus}', but the live model refresh did not return a usable replacement memo. The previous thesis is preserved and the paid evidence is shown in the x402 evidence sections.`;

  return {
    ...previous,
    sourceCredibilityNotes: [
      note,
      ...previous.sourceCredibilityNotes.filter((item) => item !== note),
    ].slice(0, 6),
    policyNotes: [
      "Review the x402 evidence section before staging an intent; the preserved thesis was not overwritten by a failed refresh.",
      ...previous.policyNotes,
    ].slice(0, 6),
  };
}

function buildPaidResearchQuery(input: z.infer<typeof liveResearchSchema>) {
  const probability =
    input.marketProbability === null
      ? "unknown"
      : (input.marketPriceLabel ?? `${Math.round(input.marketProbability * 100)}¢`);

  const currentDate = new Date().toISOString().slice(0, 10);

  return [
    `Current date: ${currentDate}. Prioritize fresh evidence from the last 30-45 days. Use older sources only for explicit historical baselines, head-to-head history, or long-term comparison context.`,
    `Prediction market research: ${input.market}`,
    `Venue: ${input.venue}; category: ${input.category}; current venue price signal: ${probability}. Treat this as a market quote, not an official probability label.`,
    input.outcomeSummary ? `Multi-outcome/event market outcomes and venue quotes: ${input.outcomeSummary}` : "",
    input.marketSlug ? `Market slug: ${input.marketSlug}.` : "",
    input.conditionId ? `Condition ID: ${input.conditionId}.` : "",
    input.tokenIds?.length ? `Token IDs: ${input.tokenIds.slice(0, 4).join(", ")}.` : "",
    input.originalUrl ? `Original market URL: ${input.originalUrl}.` : "",
    "Find whether YES or NO has positive expected value. Include recent news, official sources, social/sentiment signals if available, comparable markets, market manipulation risk, source credibility, and missing evidence.",
    "If this is a sports/esports/competition market, include head-to-head history, recent form, similar-strength opponents, roster/injury/schedule news, and match-fixing/integrity history.",
    "If this is a legal/political-person market, separate allegation, detention, indictment, conviction, sentencing, appeal, and official source status.",
    "Return evidence useful for Kelly-style sizing, hedge/early-close conditions, and manual trade intent review.",
  ].filter(Boolean).join(" ").slice(0, 900);
}

async function readJson(path: string) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    return null;
  }
}
