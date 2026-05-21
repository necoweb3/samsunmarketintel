import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requestLiveAgentModelAnalysis } from "@/src/product/agentModelAnalysis";
import { readAgentBankrollUsdc } from "@/src/product/agentBankroll";
import { appendAgentRun, readAgentRunLedger } from "@/src/product/agentRunLedger";
import { applyModelAnalysisToAgentRun, buildAgentRun, type AgentMarketResearch } from "@/src/product/agentRun";
import { evaluateCryptoAnalystBench } from "@/src/product/cryptoAnalystBench";
import { readIntentLedger } from "@/src/product/intentLedger";
import { buildIntegritySnapshot } from "@/src/product/integrityAnalysis";
import { buildResearchSnapshot } from "@/src/product/researchAnalysis";
import { buildSentientRunContext } from "@/src/product/sentientActivation";
import { runOpenDeepSearch } from "@/src/product/openDeepSearchRuntime";
import { readSourceRegistry } from "@/src/product/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const runSchema = z.object({
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
});

const TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";
const RESEARCH_CACHE = ".cache/x402/latest-research-search.json";

export async function GET() {
  const ledger = await readAgentRunLedger();

  return NextResponse.json(
    {
      status: "ok",
      ...ledger,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const parsed = runSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        run: null,
        message: "Invalid agent run request.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const [intents, bankrollUsdc] = await Promise.all([
    readIntentLedger(),
    readAgentBankrollUsdc(),
  ]);
  const deterministicRun = buildAgentRun(parsed.data, intents.intents, { bankrollUsdc });
  const [tradePayload, researchPayload, sourceRegistry, marketResearch] = await Promise.all([
    readJson(TRADES_CACHE),
    readJson(RESEARCH_CACHE),
    readSourceRegistry(),
    runOpenDeepSearch({
      query: buildMarketResearchQuery(parsed.data),
      maxSources: 4,
    }),
  ]);
  const integrity = tradePayload ? buildIntegritySnapshot(tradePayload) : null;
  const research = researchPayload ? buildResearchSnapshot(researchPayload, { sourceRegistry }) : null;
  const marketResearchSummary = summarizeMarketResearch(marketResearch);
  const sentientContext = buildSentientRunContext({
    input: parsed.data,
    research,
    topAlert: integrity?.alerts[0] ?? null,
  });
  const modelAnalysis = await requestLiveAgentModelAnalysis({
    input: parsed.data,
    run: deterministicRun,
    research,
    marketResearch,
    topAlert: integrity?.alerts[0] ?? null,
    sentientContext,
  });
  const cryptoBench = evaluateCryptoAnalystBench({
    input: parsed.data,
    modelAnalysis,
    research,
    marketResearch,
  });
  const modelAdjustedRun = applyModelAnalysisToAgentRun(deterministicRun, modelAnalysis);
  const run = {
    ...modelAdjustedRun,
    sentientContext,
    marketResearch: marketResearchSummary,
    modelAnalysis,
    cryptoBench,
  };
  const ledger = await appendAgentRun(run);

  return NextResponse.json(
    {
      status: "ok",
      run,
      ledger,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function buildMarketResearchQuery(input: z.infer<typeof runSchema>) {
  const marketProbability =
    input.marketProbability === null
      ? "unknown"
      : (input.marketPriceLabel ?? `${Math.round(input.marketProbability * 100)}¢`);
  const topicQuery = buildTopicQuery(input);
  const currentDate = new Date().toISOString().slice(0, 10);
  const query = [
    `Current date: ${currentDate}. Prioritize fresh evidence from the last 30-45 days. Use older sources only for explicit historical baselines, head-to-head history, or long-term comparison context.`,
    topicQuery,
    input.venue === "Draft"
      ? `Prediction market design and usefulness analysis for: ${input.market}`
      : `Prediction market trading analysis for: ${input.market}`,
    `Venue: ${input.venue}. Category: ${input.category}. Current venue price signal: ${marketProbability}. Treat this as a market price/quote, not an official probability label.`,
    input.outcomeSummary ? `Multi-outcome/event market outcomes and venue quotes: ${input.outcomeSummary}` : "",
    input.venue === "Draft"
      ? "Find recent relevant evidence, credible sources, demand signals, resolution/oracle ideas, manipulation concerns, and missing evidence for whether this market should exist."
      : "Find recent relevant evidence, market-specific data, credible sources, manipulation concerns, and missing evidence for a manual bet or wait decision.",
    "For sports/esports/competition markets: include head-to-head, recent form, similar opponents, roster/injury/schedule, and integrity history. For legal/political-person markets: separate allegation, detention, indictment, conviction, sentence, appeal, and official source status.",
  ].filter(Boolean).join(" ");

  return query.slice(0, 900);
}

function buildTopicQuery(input: z.infer<typeof runSchema>) {
  const normalized = `${input.market} ${input.category}`.toLowerCase();

  if (
    normalized.includes("turkey") &&
    (normalized.includes("cpi") ||
      normalized.includes("inflation") ||
      normalized.includes("enflasyon"))
  ) {
    return "Turkey CPI inflation expectations economist consensus TURKSTAT TCMB latest forecast market expectations";
  }

  if (normalized.includes("israel") && normalized.includes("syria")) {
    return `${input.market} Israel Syria security agreement diplomatic negotiations latest official statements credible regional analysis`;
  }

  if (
    normalized.includes("esport") ||
    normalized.includes("sports") ||
    normalized.includes("football") ||
    normalized.includes("match") ||
    normalized.includes("vs ")
  ) {
    return `${input.market} head to head record recent form similar opponents injuries roster integrity match fixing betting odds movement`;
  }

  if (
    normalized.includes("tutuk") ||
    normalized.includes("mahkeme") ||
    normalized.includes("hapse") ||
    normalized.includes("legal") ||
    normalized.includes("court") ||
    normalized.includes("lawsuit")
  ) {
    return `${input.market} official court prosecutor indictment detention trial sentence government ties latest verified news`;
  }

  if (normalized.includes("midterm") || normalized.includes("congress")) {
    return "US 2026 midterms balance of power generic ballot Senate House latest polling forecast";
  }

  return `${input.market} latest news official sources forecast market odds`;
}

function summarizeMarketResearch(result: Awaited<ReturnType<typeof runOpenDeepSearch>>): AgentMarketResearch {
  return {
    status: result.status,
    query: result.query,
    answer: result.answer,
    durationMs: result.durationMs,
    provider: result.config.search.label,
    reranker: result.config.reranker.label,
    model: result.config.model.name,
    sourceLinks: result.sources?.map((source) => source.url) ?? extractLinks(result.answer ?? ""),
    error: result.error,
  };
}

function extractLinks(value: string) {
  return Array.from(
    new Set(value.match(/https?:\/\/[^\s)\]}>"']+/g) ?? []),
  ).slice(0, 8);
}

async function readJson(path: string) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    return null;
  }
}
