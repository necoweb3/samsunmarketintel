import OpenAI from "openai";
import { z } from "zod";

import type { AgentRunInput, AgentRunRecord } from "@/src/product/agentRun";
import type { FlowAlert } from "@/src/product/integrityAnalysis";
import type { LiveX402ResearchSummary } from "@/src/product/liveX402Research";
import type { OpenDeepSearchRunResult } from "@/src/product/openDeepSearchRuntime";
import { readPrimaryModelConfig } from "@/src/product/primaryModel";
import type { ResearchSnapshot } from "@/src/product/researchAnalysis";
import type { SentientRunContext } from "@/src/product/sentientActivation";

export type LiveAgentTradePlan = {
  status: "trade" | "watch" | "avoid" | "research_more";
  targetOutcome: string | null;
  side: "YES" | "NO" | "NONE";
  marketQuote: string | null;
  fairProbability: number | null;
  edge: number | null;
  confidence: number | null;
  rationale: string;
  alternative: string | null;
  hedgeOrExit: string | null;
};

export type LiveAgentModelAnalysis = {
  status: "ok" | "skipped" | "error";
  provider: string;
  model: string;
  recommendation: "BET_YES" | "BET_NO" | "WAIT" | "DO_NOT_BET" | "RESEARCH_MORE";
  riskGate: "open" | "review" | "blocked";
  confidence: number;
  thesis: string;
  summary: string;
  keyDrivers: string[];
  missingEvidence: string[];
  sourceCredibilityNotes: string[];
  policyNotes: string[];
  tradePlan: LiveAgentTradePlan | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  } | null;
  error?: string;
};

const modelAnalysisSchema = z.object({
  recommendation: z.enum(["BET_YES", "BET_NO", "WAIT", "DO_NOT_BET", "RESEARCH_MORE"]),
  riskGate: z.enum(["open", "review", "blocked"]),
  confidence: z.number().min(0).max(1),
  thesis: z.string().min(20).max(1800),
  summary: z.string().min(20).max(900),
  keyDrivers: z.array(z.string().min(2).max(420)).min(1).max(6),
  missingEvidence: z.array(z.string().min(2).max(420)).max(6),
  sourceCredibilityNotes: z.array(z.string().min(2).max(420)).max(6),
  policyNotes: z.array(z.string().min(2).max(420)).max(6),
  tradePlan: z
    .object({
      status: z.enum(["trade", "watch", "avoid", "research_more"]),
      targetOutcome: z.string().min(1).max(160).nullable(),
      side: z.enum(["YES", "NO", "NONE"]),
      marketQuote: z.string().min(1).max(80).nullable(),
      fairProbability: z.number().nullable(),
      edge: z.number().nullable(),
      confidence: z.number().nullable(),
      rationale: z.string().min(10).max(700),
      alternative: z.string().min(1).max(360).nullable(),
      hedgeOrExit: z.string().min(1).max(360).nullable(),
    })
    .nullable()
    .optional(),
});

type ParsedModelAnalysis = z.infer<typeof modelAnalysisSchema>;

export async function requestLiveAgentModelAnalysis({
  input,
  run,
  research,
  marketResearch,
  paidResearch,
  topAlert,
  sentientContext,
  analysisLayer = paidResearch ? "x402_upgrade" : "base",
  baselineAnalysis = null,
}: {
  input: AgentRunInput;
  run: AgentRunRecord;
  research: ResearchSnapshot | null;
  marketResearch: OpenDeepSearchRunResult | null;
  paidResearch?: LiveX402ResearchSummary | null;
  topAlert: FlowAlert | null;
  sentientContext: SentientRunContext;
  analysisLayer?: "base" | "x402_upgrade";
  baselineAnalysis?: LiveAgentModelAnalysis | null;
}): Promise<LiveAgentModelAnalysis> {
  const config = readPrimaryModelConfig();

  if (config.status !== "ready") {
    return emptyModelAnalysis({
      status: "skipped",
      provider: config.provider,
      model: config.model,
      error: `Primary model is missing ${config.missing.join(", ")}.`,
    });
  }

  if (!config.openAICompatible || !config.baseUrl) {
    return emptyModelAnalysis({
      status: "skipped",
      provider: config.provider,
      model: config.model,
      error: `${config.provider} is not configured as an OpenAI-compatible model route.`,
    });
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    return emptyModelAnalysis({
      status: "skipped",
      provider: config.provider,
      model: config.model,
      error: `Primary model is missing ${config.apiKeyEnv}.`,
    });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: config.baseUrl,
    defaultHeaders:
      config.provider === "OpenRouter"
        ? {
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3050",
            "X-Title": "Samsun Market Intel",
          }
        : undefined,
  });

  try {
    const prompt = buildModelPrompt({
      input,
      run,
      research,
      marketResearch,
      paidResearch,
      topAlert,
      sentientContext,
      analysisLayer,
      baselineAnalysis,
    });
    const estimatedPromptTokens = estimatePromptTokens(prompt);
    console.info(
      JSON.stringify({
        component: "agentModelAnalysis",
        layer: analysisLayer,
        promptChars: prompt.length,
        estimatedPromptTokens,
        paidServices: paidResearch?.services.length ?? 0,
      }),
    );

    const response = await client.chat.completions.create({
      model: config.providerModel,
      messages: [
        {
          role: "system",
          content: [
            "You are a senior prediction-market analyst for Samsun Market Intel.",
            "You specialize in identifying mispriced Polymarket markets by combining news evidence, trade-flow signals, source credibility analysis, and local Turkish event intelligence.",
            "Your core principles:",
            "- Reason from evidence, not assumptions. Calibrate confidence from source quality. Never default to 0.55.",
            "- Identify edge by comparing your fair probability to the venue price. State the edge clearly when it exists; do not hide behind WAIT when one side is clearly advantaged by at least 4 percentage points.",
            "- Always distinguish venue price or cents quote from probability. Never conflate the two. Use cent language for Polymarket prices unless an external source explicitly gives a percentage.",
            "- Manual approval is mandatory before any trade. You produce decision memos, not trade executions. Never claim a bet, payment, wallet action, or onchain transaction was executed.",
            "- When evidence is thin, say so directly instead of manufacturing confidence.",
            "- Source credibility notes are written for the end user, not as internal system criticism. Say 'web research is partial' rather than 'OpenDeepSearch was insufficient'.",
            "Return only valid JSON matching the exact schema provided. No preamble, no markdown, no text outside the JSON object.",
          ].join("\n"),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: config.maxOutputTokens,
      temperature: 0.2,
    });
    const content = response.choices[0]?.message?.content ?? "";
    console.info(
      JSON.stringify({
        component: "agentModelAnalysis",
        layer: analysisLayer,
        usage: response.usage ?? null,
        completionChars: content.length,
      }),
    );
    const parsed = adaptDraftMarketAnalysis(enhancePaidUpgradeAnalysis(
      rebalanceTimidRecommendation(modelAnalysisSchema.parse(normalizeModelAnalysisCandidate(parseJsonObject(content)))),
      {
        input,
        paidResearch: paidResearch ?? null,
        analysisLayer,
      },
    ), input, analysisLayer);

    return {
      status: "ok",
      provider: config.provider,
      model: config.model,
      recommendation: parsed.recommendation,
      riskGate: parsed.riskGate,
      confidence: parsed.confidence,
      thesis: parsed.thesis,
      summary: parsed.summary,
      keyDrivers: parsed.keyDrivers,
      missingEvidence: parsed.missingEvidence,
      sourceCredibilityNotes: parsed.sourceCredibilityNotes,
      policyNotes: parsed.policyNotes,
      tradePlan: parsed.tradePlan ?? null,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? estimatedPromptTokens,
        completionTokens: response.usage?.completion_tokens ?? null,
        totalTokens: response.usage?.total_tokens ?? null,
      },
    };
  } catch (error) {
    const fallback = buildPaidUpgradeFallbackAnalysis({
      input,
      run,
      paidResearch: paidResearch ?? null,
      baselineAnalysis,
      provider: config.provider,
      model: config.model,
      error: error instanceof Error ? error.message : "Primary model analysis failed.",
    });
    if (fallback) return fallback;

    console.warn(
      JSON.stringify({
        component: "agentModelAnalysis",
        layer: analysisLayer,
        error: error instanceof Error ? error.message : "Primary model analysis failed.",
      }),
    );
    return emptyModelAnalysis({
      status: "error",
      provider: config.provider,
      model: config.model,
      error: error instanceof Error ? error.message : "Primary model analysis failed.",
    });
  }
}

function buildModelPrompt({
  input,
  run,
  research,
  marketResearch,
  paidResearch,
  topAlert,
  sentientContext,
  analysisLayer,
  baselineAnalysis,
}: {
  input: AgentRunInput;
  run: AgentRunRecord;
  research: ResearchSnapshot | null;
  marketResearch: OpenDeepSearchRunResult | null;
  paidResearch?: LiveX402ResearchSummary | null;
  topAlert: FlowAlert | null;
  sentientContext: SentientRunContext;
  analysisLayer: "base" | "x402_upgrade";
  baselineAnalysis: LiveAgentModelAnalysis | null;
}) {
  const relevantCachedResearch = research && isResearchRelevant(input.market, research) ? research : null;
  const relevantTradeFlow = topAlert && sharesMarketTokens(input.market, topAlert.market) ? topAlert : null;

  return JSON.stringify(
    {
      task:
        "Analyze this prediction-market opportunity. Return JSON with recommendation, riskGate, confidence, thesis, summary, keyDrivers, missingEvidence, sourceCredibilityNotes, policyNotes, and tradePlan.",
      analysisLayer:
        analysisLayer === "x402_upgrade"
          ? {
              name: "x402_upgrade",
              instruction:
                "This is the paid x402 upgrade layer. Do not assume a fresh OpenDeepSearch pass ran here. Use paidX402Research as the new evidence, compare it against the baseline analysis when present, then run the ROMA source/risk/policy review and optional crypto quality check.",
            }
          : {
              name: "base",
              instruction:
                "This is the base layer. Use OpenDeepSearch/registered-source context first, then ROMA source/risk/policy review and optional crypto quality check.",
            },
      strictRules: buildStrictRulesByCategory(),
      market: input,
      marketPricing: {
        venuePriceLabel: input.marketPriceLabel ?? null,
        numericPriceSignal: input.marketProbability,
        interpretation:
          "This is a prediction-market quote used for EV math. It is not an official probability label. Use cents/price language unless an external source explicitly gives a percentage chance.",
      },
      deterministicRun: {
        action: run.action,
        riskGate: run.riskGate,
        edge: run.edge,
        confidence: run.confidence,
        sizing: run.sizing,
        policy: run.policy,
      },
      marketSpecificResearch: marketResearch
        ? {
            status: marketResearch.status,
            query: marketResearch.query,
            answer: marketResearch.answer,
            durationMs: marketResearch.durationMs,
            provider: marketResearch.config.search.label,
            reranker: marketResearch.config.reranker.label,
            sources: marketResearch.sources?.map((source) => ({
              title: source.title,
              url: source.url,
              snippet: source.snippet,
              source: source.source,
            })),
            missing: marketResearch.missing,
            error: marketResearch.error,
          }
        : null,
      baselineAnalysis: baselineAnalysis
        ? {
            recommendation: baselineAnalysis.recommendation,
            riskGate: baselineAnalysis.riskGate,
            confidence: baselineAnalysis.confidence,
            summary: baselineAnalysis.summary,
            thesis: baselineAnalysis.thesis,
            tradePlan: baselineAnalysis.tradePlan,
          }
        : null,
      paidX402Research: paidResearch ? compactPaidResearchForModel(paidResearch) : null,
      cachedResearch: relevantCachedResearch
        ? {
            query: relevantCachedResearch.query,
            sourceCount: relevantCachedResearch.sourceCount,
            officialSources: relevantCachedResearch.officialSources,
            averageScore: relevantCachedResearch.averageScore,
            topSources: relevantCachedResearch.topSources.slice(0, 6).map((source) => ({
              title: source.title,
              domain: source.domain,
              credibility: source.credibility,
              score: source.score,
              snippet: source.content.slice(0, 700),
            })),
          }
        : research
          ? {
              status: "available_but_not_used",
              reason:
                "Cached research did not appear related to the target market, so it was excluded from evidence.",
            }
          : null,
      tradeFlow: relevantTradeFlow
        ? {
            market: relevantTradeFlow.market,
            risk: relevantTradeFlow.risk,
            score: relevantTradeFlow.score,
            trades: relevantTradeFlow.trades,
            notionalUsd: relevantTradeFlow.notionalUsd,
            topWalletShare: relevantTradeFlow.topWalletShare,
            oneSidedShare: relevantTradeFlow.oneSidedShare,
            reason: relevantTradeFlow.reason,
          }
        : null,
      researchStack: {
        mode: sentientContext.mode,
        activeComponents: sentientContext.activeComponents,
        waitingComponents: sentientContext.waitingComponents,
        safeFunctionCalling: sentientContext.safeFunctionCalling,
        openDeepSearch: sentientContext.openDeepSearch,
        roma: sentientContext.roma,
        cryptoAnalystBench: sentientContext.cryptoAnalystBench,
        promptGuidance: sentientContext.promptGuidance,
      },
      expectedJsonShape: {
        recommendation: "WAIT",
        riskGate: "review",
        confidence: 0.64,
        thesis: "One paragraph analytical thesis.",
        summary: "One concise decision summary.",
        keyDrivers: ["driver"],
        missingEvidence: ["missing source or data"],
        sourceCredibilityNotes: ["source note"],
        policyNotes: ["manual approval note"],
        tradePlan: {
          status: "watch",
          targetOutcome: "Exact candidate/team/outcome, or null",
          side: "NONE",
          marketQuote: "YES 47c, NO 54c, or null",
          fairProbability: 0.51,
          edge: 0.04,
          confidence: 0.64,
          rationale: "Why this contract is the best EV target or why no trade is actionable.",
          alternative: "Best alternative outcome/side or null.",
          hedgeOrExit: "Condition that would hedge, close, or invalidate the view.",
        },
      },
    },
    null,
    2,
  );
}

function compactPaidResearchForModel(paidResearch: LiveX402ResearchSummary) {
  const okServices = paidResearch.services.filter((service) => service.status === "ok");
  const gapServices = paidResearch.services.filter((service) => service.status !== "ok");
  const slowestServices = [...paidResearch.services]
    .filter((service) => typeof service.durationMs === "number")
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
    .slice(0, 5)
    .map((service) => ({
      name: service.name,
      provider: service.provider,
      status: service.status,
      durationMs: service.durationMs,
    }));
  const holderFlow = summarizeHolderFlowForModel(paidResearch);
  const socialHighlights = summarizeSocialPostsForModel(paidResearch);

  return {
    status: paidResearch.status,
    query: truncate(paidResearch.query, 900),
    maxTotalUsdc: paidResearch.maxTotalUsdc,
    estimatedMaxSpendUsdc: paidResearch.estimatedMaxSpendUsdc,
    actualPaidUsdc: paidResearch.actualPaidUsdc,
    durationMs: paidResearch.durationMs,
    coverage: {
      ok: okServices.length,
      gaps: gapServices.length,
      total: paidResearch.services.length,
      okServiceNames: okServices.slice(0, 12).map((service) => service.name),
      gapServiceNames: gapServices.slice(0, 8).map((service) => service.name),
    },
    slowestServices,
    holderFlow,
    socialHighlights,
    services: paidResearch.services.map((service) => ({
      id: service.id,
      name: service.name,
      provider: service.provider,
      phase: service.phase,
      status: service.status,
      durationMs: service.durationMs,
      purpose: service.purpose,
      summary:
        service.status === "ok"
          ? truncate(stripJsonNoise(service.summary), 520)
          : truncate(service.error ?? service.summary, 180),
    })),
    instruction:
      "This is a compact paid-evidence brief. Raw provider payloads were intentionally removed before the model call. Use holderFlow, socialHighlights, service summaries, and coverage; do not invent data from omitted raw responses.",
  };
}

function summarizeHolderFlowForModel(paidResearch: LiveX402ResearchSummary) {
  const service = paidResearch.services.find((item) => item.id === "blockrun-polymarket-top-holders");
  if (!service || service.status !== "ok") {
    return {
      status: service?.status ?? "missing",
      note: service ? truncate(service.summary, 240) : "Top-holder service was not present.",
      sideTotals: [] as Array<{ side: string; count: number; amountUsd: number; shares: number }>,
      topHolders: [] as Array<{ wallet: string; side: string; amountUsd: number; shares: number }>,
    };
  }

  const parsed = parsePaidJson(service.rawText ?? service.summary);
  const payload = unwrapPaidPayload(parsed);
  const entries = collectObjects(payload)
    .map((value) => normalizeHolderForModel(value))
    .filter(Boolean)
    .slice(0, 120) as Array<{ wallet: string; side: string; amountUsd: number; shares: number }>;
  const totals = new Map<string, { side: string; count: number; amountUsd: number; shares: number }>();

  for (const entry of entries) {
    const current = totals.get(entry.side) ?? { side: entry.side, count: 0, amountUsd: 0, shares: 0 };
    current.count += 1;
    current.amountUsd += entry.amountUsd;
    current.shares += entry.shares;
    totals.set(entry.side, current);
  }

  return {
    status: entries.length > 0 ? "ok" : "empty",
    note:
      entries.length > 0
        ? "Returned top-holder rows are summarized by side. Strong directional exposure is not automatically manipulation."
        : truncate(service.summary, 240),
    sideTotals: [...totals.values()]
      .map((item) => ({
        ...item,
        amountUsd: Number(item.amountUsd.toFixed(2)),
        shares: Number(item.shares.toFixed(2)),
      }))
      .sort((a, b) => b.amountUsd - a.amountUsd),
    topHolders: entries
      .sort((a, b) => b.amountUsd - a.amountUsd)
      .slice(0, 8)
      .map((entry) => ({
        wallet: shortHash(entry.wallet),
        side: entry.side,
        amountUsd: Number(entry.amountUsd.toFixed(2)),
        shares: Number(entry.shares.toFixed(2)),
      })),
  };
}

function summarizeSocialPostsForModel(paidResearch: LiveX402ResearchSummary) {
  const posts = paidResearch.services
    .filter((service) => service.id.includes("twitter") && service.status === "ok")
    .flatMap((service) => extractSocialPostsForModel(service.rawText ?? service.summary))
    .filter((post) => post.engagement > 0)
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 6);

  return posts.map((post) => ({
    author: post.author,
    handle: post.handle,
    age: post.age,
    engagement: post.engagement,
    text: truncate(post.text, 420),
  }));
}

function extractSocialPostsForModel(value: string | null | undefined) {
  const parsed = parsePaidJson(value);
  const payload = unwrapPaidPayload(parsed);
  const tweets = collectObjects(payload).filter((item) => typeof firstString(item, ["text", "full_text", "content"]) === "string");
  const now = Date.now();

  return tweets.map((tweet) => {
    const author = readObject(tweet.author);
    const text = firstString(tweet, ["text", "full_text", "content"]) ?? "";
    const handle = author
      ? firstString(author, ["userName", "screenName", "screen_name", "handle", "username"])
      : null;
    const authorName = author ? firstString(author, ["name", "displayName", "userName", "screenName"]) : null;
    const likes = firstNumber(tweet, ["likeCount", "likes", "favorite_count", "favorites"]) ?? 0;
    const reposts = firstNumber(tweet, ["retweetCount", "reposts", "retweets", "quoteCount"]) ?? 0;
    const replies = firstNumber(tweet, ["replyCount", "replies"]) ?? 0;
    const createdAt = parseMaybeDate(firstString(tweet, ["createdAt", "created_at", "postedAt", "publishedAt"]));
    const ageMs = createdAt ? now - createdAt.getTime() : null;
    const age = ageMs === null ? null : Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));

    return {
      author: authorName ?? (handle ? `@${handle}` : "Unknown"),
      handle: handle ? `@${handle.replace(/^@/, "")}` : null,
      age: age === null ? null : age === 0 ? "today" : `${age}d`,
      engagement: Math.round(likes + reposts * 2 + replies),
      text,
    };
  });
}

function normalizeHolderForModel(value: Record<string, unknown>) {
  const wallet = firstString(value, ["wallet", "address", "user", "holder", "proxyWallet"]);
  if (!wallet) return null;
  const side = normalizeSide(firstString(value, ["side", "outcome", "outcome_label"]) ?? "Unknown");
  const shares = firstNumber(value, ["position_shares", "shares", "shares_normalized", "position"]) ?? 0;
  const amountUsd =
    firstNumber(value, ["position_value_usd", "amount_usd", "amountUsd", "value", "value_usd", "notional"]) ??
    shares * (firstNumber(value, ["price", "avg_price", "average_price"]) ?? 0);

  if (shares <= 0 && amountUsd <= 0) return null;
  return { wallet, side, shares, amountUsd };
}

function buildStrictRulesByCategory() {
  return {
    safety: [
      "Manual mode only.",
      "Do not execute trades, call wallets, pay APIs, or write Arc receipts.",
      "Manual approval is mandatory even when recommendation is BET_YES or BET_NO.",
    ],
    pricingAndEv: [
      "Use cents/quote language for Polymarket prices unless a source explicitly gives a percentage.",
      "For YES, edge = fairProbability - venueQuote. For NO, edge = venueQuote - fairProbability. Use a numeric edge when both values are available.",
      "Use Kelly-style sizing and explain why stake is zero when it is zero.",
    ],
    decisionCalibration: [
      "WAIT is only appropriate when no cleaner side is identifiable, edge is below threshold, or core evidence is missing.",
      "When a review-level trade has meaningful edge, use BET_YES or BET_NO with riskGate='review' instead of hiding behind WAIT.",
      "If venue is Draft or the market price is missing, do not return BET_YES or BET_NO. Return RESEARCH_MORE or WAIT and frame the answer as market-design intelligence, not a trade recommendation.",
      "Do not default confidence to exactly 0.55.",
    ],
    x402Upgrade: [
      "Do not send paid results back into OpenDeepSearch or imply OpenDeepSearch re-ran.",
      "Use paid services as the fresh evidence layer and explain what changed versus baseline.",
      "If paid holder-flow shows one side materially larger, decide whether it is directional conviction or manipulation; do not call normal directional exposure manipulation by default.",
      "Use socialHighlights when relevant and remove missing-evidence items that paid research covered.",
    ],
  };
}

function estimatePromptTokens(value: string) {
  return Math.ceil(value.length / 4);
}

function truncate(value: string | null | undefined, maxLength: number) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function stripJsonNoise(value: string) {
  return value
    .replace(/"profilePicture":"[^"]+"/g, '"profilePicture":"[image]"')
    .replace(/"coverPicture":"[^"]+"/g, '"coverPicture":"[image]"')
    .replace(/"profile_image_url_https":"[^"]+"/g, '"profile_image_url_https":"[image]"')
    .replace(/"clobTokenIds":"\[[^"]+\]"/g, '"clobTokenIds":"[token ids]"');
}

function parsePaidJson(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function unwrapPaidPayload(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return readNested(value, ["data", "response"]) ?? readNested(value, ["response"]) ?? readNested(value, ["data"]) ?? value;
}

function readNested(value: Record<string, unknown>, path: string[]) {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function collectObjects(value: unknown, limit = 700): Array<Record<string, unknown>> {
  const objects: Array<Record<string, unknown>> = [];
  const seen = new Set<unknown>();

  function visit(current: unknown) {
    if (objects.length >= limit || current === null || typeof current !== "object" || seen.has(current)) return;
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (isRecord(current)) {
      objects.push(current);
      Object.values(current).forEach(visit);
    }
  }

  visit(value);
  return objects;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readObject(value: unknown) {
  return isRecord(value) ? value : null;
}

function firstString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const current = value[key];
    if (typeof current === "string" && current.trim()) return current;
    if (typeof current === "number" || typeof current === "boolean") return String(current);
  }
  return null;
}

function firstNumber(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const current = value[key];
    if (typeof current === "number" && Number.isFinite(current)) return current;
    if (typeof current === "string") {
      const parsed = Number(current.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeSide(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("yes")) return "YES";
  if (normalized.includes("no")) return "NO";
  return value || "Unknown";
}

function normalizeModelAnalysisCandidate(value: unknown) {
  if (!isRecord(value)) return value;
  const candidate: Record<string, unknown> = { ...value };

  candidate.recommendation = normalizeRecommendationValue(candidate.recommendation);
  candidate.riskGate = normalizeRiskGateValue(candidate.riskGate);
  candidate.confidence = normalizeProbabilityValue(candidate.confidence, "confidence");
  candidate.thesis = truncate(firstString(candidate, ["thesis"]) ?? "Paid and base evidence were reviewed for this market.", 1800);
  candidate.summary = truncate(firstString(candidate, ["summary"]) ?? "Evidence was reviewed; manual approval remains required.", 900);
  candidate.keyDrivers = normalizeStringArray(candidate.keyDrivers, 6, 420, [
    "Evidence was reviewed across market data, news, and source-quality checks.",
  ]);
  candidate.missingEvidence = normalizeStringArray(candidate.missingEvidence, 6, 420);
  candidate.sourceCredibilityNotes = normalizeStringArray(candidate.sourceCredibilityNotes, 6, 420);
  candidate.policyNotes = normalizeStringArray(candidate.policyNotes, 6, 420, [
    "Manual approval is required before staging or recording any intent.",
  ]);

  const tradePlan = readObject(candidate.tradePlan);
  if (tradePlan) {
    const normalizedTradePlan: Record<string, unknown> = { ...tradePlan };
    normalizedTradePlan.status = normalizeTradePlanStatus(normalizedTradePlan.status);
    normalizedTradePlan.side = normalizeTradePlanSide(normalizedTradePlan.side);
    normalizedTradePlan.targetOutcome =
      normalizedTradePlan.targetOutcome === null
        ? null
        : truncate(String(normalizedTradePlan.targetOutcome ?? "Selected outcome"), 160);
    normalizedTradePlan.marketQuote =
      normalizedTradePlan.marketQuote === null
        ? null
        : truncate(String(normalizedTradePlan.marketQuote ?? "Venue quote unavailable"), 80);
    normalizedTradePlan.fairProbability = normalizeProbabilityValue(normalizedTradePlan.fairProbability, "probability");
    normalizedTradePlan.edge = normalizeProbabilityValue(normalizedTradePlan.edge, "edge");
    normalizedTradePlan.confidence = normalizeProbabilityValue(normalizedTradePlan.confidence, "confidence");
    normalizedTradePlan.rationale = truncate(
      firstString(normalizedTradePlan, ["rationale"]) ?? "The agent keeps execution manual until the user approves an intent.",
      700,
    );
    normalizedTradePlan.alternative =
      normalizedTradePlan.alternative === null
        ? null
        : truncate(String(normalizedTradePlan.alternative ?? ""), 360) || null;
    normalizedTradePlan.hedgeOrExit =
      normalizedTradePlan.hedgeOrExit === null
        ? null
        : truncate(String(normalizedTradePlan.hedgeOrExit ?? ""), 360) || null;
    candidate.tradePlan = normalizedTradePlan;
  }

  return candidate;
}

function normalizeRecommendationValue(value: unknown) {
  const normalized = String(value ?? "WAIT").toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized.includes("BET_YES") || normalized === "YES" || normalized.includes("LEAN_YES")) return "BET_YES";
  if (normalized.includes("BET_NO") || normalized === "NO" || normalized.includes("LEAN_NO")) return "BET_NO";
  if (normalized.includes("DO_NOT") || normalized.includes("AVOID")) return "DO_NOT_BET";
  if (normalized.includes("RESEARCH")) return "RESEARCH_MORE";
  return "WAIT";
}

function normalizeRiskGateValue(value: unknown) {
  const normalized = String(value ?? "review").toLowerCase();
  if (normalized.includes("open")) return "open";
  if (normalized.includes("block")) return "blocked";
  return "review";
}

function normalizeTradePlanStatus(value: unknown) {
  const normalized = String(value ?? "watch").toLowerCase();
  if (normalized.includes("trade") || normalized.includes("bet")) return "trade";
  if (normalized.includes("avoid") || normalized.includes("do_not")) return "avoid";
  if (normalized.includes("research")) return "research_more";
  return "watch";
}

function normalizeTradePlanSide(value: unknown) {
  const normalized = String(value ?? "NONE").toUpperCase();
  if (normalized.includes("YES")) return "YES";
  if (normalized.includes("NO")) return "NO";
  return "NONE";
}

function normalizeProbabilityValue(value: unknown, kind: "confidence" | "probability" | "edge") {
  if (value === null || value === undefined || value === "") return kind === "edge" ? null : value;
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/[^0-9.-]/g, ""))
        : Number.NaN;
  if (!Number.isFinite(numeric)) return kind === "edge" ? null : value;
  if (kind === "edge") {
    if (Math.abs(numeric) > 1 && Math.abs(numeric) <= 100) return Number((numeric / 100).toFixed(4));
    return Number(numeric.toFixed(4));
  }
  if (numeric > 1 && numeric <= 100) return Number((numeric / 100).toFixed(4));
  return Math.min(1, Math.max(0, Number(numeric.toFixed(4))));
}

function normalizeStringArray(value: unknown, maxItems: number, maxLength: number, fallback: string[] = []) {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\n|;|(?<=\.)\s+(?=[A-Z])/)
      : fallback;

  return items
    .map((item) => truncate(String(item ?? ""), maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseMaybeDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function shortHash(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function buildPaidUpgradeFallbackAnalysis({
  input,
  run,
  paidResearch,
  baselineAnalysis,
  provider,
  model,
  error,
}: {
  input: AgentRunInput;
  run: AgentRunRecord;
  paidResearch: LiveX402ResearchSummary | null;
  baselineAnalysis: LiveAgentModelAnalysis | null;
  provider: string;
  model: string;
  error: string;
}): LiveAgentModelAnalysis | null {
  if (!paidResearch) return null;
  const okServices = paidResearch.services.filter((service) => service.status === "ok");
  if (okServices.length === 0) return null;

  const compact = compactPaidResearchForModel(paidResearch);
  const base = baselineAnalysis?.status === "ok" ? baselineAnalysis : null;
  const holderLeader = compact.holderFlow.sideTotals[0] ?? null;
  const hasDeepResearch = okServices.some((service) => /deep-research|deep research/i.test(`${service.id} ${service.name}`));
  const hasPaidSearch = okServices.some((service) =>
    /tavily|exa|parallel|perplexity|search|news/i.test(`${service.id} ${service.name}`),
  );
  const socialCount = compact.socialHighlights.length;
  const baseRecommendation = base?.recommendation ?? run.action;
  const baseRiskGate = base?.riskGate ?? run.riskGate;
  const baseTradePlan = base?.tradePlan ?? buildFallbackTradePlan(input, run);
  const evidenceDrivers = buildPaidEvidenceDrivers(compact, okServices.length, paidResearch.services.length);
  const confidenceFloor = Math.max(
    base?.confidence ?? run.confidence ?? input.confidence,
    hasDeepResearch ? 0.68 : 0,
    hasPaidSearch ? 0.64 : 0,
    socialCount > 0 ? 0.63 : 0,
    holderLeader ? 0.63 : 0,
  );
  const sourceNotes = [
    `Circle x402 returned ${okServices.length}/${paidResearch.services.length} usable paid services${hasDeepResearch ? ", including Deep Research" : ""}.`,
    holderLeader
      ? `Returned holder exposure is led by ${holderLeader.side}: ${formatModelUsd(holderLeader.amountUsd)} across ${holderLeader.count} holders. Treat it as directional context, not manipulation by itself.`
      : null,
    socialCount > 0
      ? `Recent X/social search returned ${socialCount} high-engagement post${socialCount === 1 ? "" : "s"} for sentiment context.`
      : null,
    ...(base?.sourceCredibilityNotes ?? []),
  ].filter(Boolean) as string[];
  const thesisParts = [
    base?.thesis ?? run.summary,
    holderLeader
      ? `The paid holder snapshot adds a live flow signal: ${holderLeader.side} has the largest returned exposure (${formatModelUsd(holderLeader.amountUsd)}).`
      : null,
    socialCount > 0
      ? `Paid X/social search adds fresh public-attention context, with the top returned posts inside the freshness window.`
      : null,
    hasDeepResearch
      ? "Perplexity Deep Research was available as a paid cited research layer and was included in the upgrade evidence."
      : null,
  ].filter(Boolean);

  console.warn(
    JSON.stringify({
      component: "agentModelAnalysis",
      layer: "x402_upgrade",
      fallback: "paid_evidence_summary",
      error,
      okPaidServices: okServices.length,
    }),
  );

  const parsed: ParsedModelAnalysis = {
    recommendation: baseRecommendation,
    riskGate: baseRiskGate,
    confidence: Math.min(0.9, confidenceFloor),
    thesis: truncate(thesisParts.join(" "), 1800),
    summary: truncate(
      `${formatRecommendationSummary(baseRecommendation)} Paid x402 evidence returned ${okServices.length}/${paidResearch.services.length} usable services; the upgrade memo keeps execution manual and folds holder/social/search signals into the review.`,
      900,
    ),
    keyDrivers: [...evidenceDrivers, ...(base?.keyDrivers ?? [])].slice(0, 6),
    missingEvidence: removeCoveredMissingEvidence(base?.missingEvidence ?? [], {
      hasPaidSearch,
      hasSocial: socialCount > 0,
      hasHolderFlow: Boolean(holderLeader),
    }).slice(0, 6),
    sourceCredibilityNotes: sourceNotes.slice(0, 6),
    policyNotes: [
      "Manual approval remains required; x402 evidence can change confidence and side selection, but it cannot execute a wallet trade.",
      ...(base?.policyNotes ?? []),
    ].slice(0, 6),
    tradePlan: baseTradePlan
      ? {
          ...baseTradePlan,
          confidence: Math.max(baseTradePlan.confidence ?? 0, Math.min(0.9, confidenceFloor)),
          edge: baseTradePlan.edge ?? inferTradePlanEdge(input, baseTradePlan),
        }
      : null,
  };
  const enhanced = adaptDraftMarketAnalysis(enhancePaidUpgradeAnalysis(rebalanceTimidRecommendation(parsed), {
    input,
    paidResearch,
    analysisLayer: "x402_upgrade",
  }), input, "x402_upgrade");

  return {
    status: "ok",
    provider,
    model,
    recommendation: enhanced.recommendation,
    riskGate: enhanced.riskGate,
    confidence: enhanced.confidence,
    thesis: enhanced.thesis,
    summary: enhanced.summary,
    keyDrivers: enhanced.keyDrivers,
    missingEvidence: enhanced.missingEvidence,
    sourceCredibilityNotes: enhanced.sourceCredibilityNotes,
    policyNotes: enhanced.policyNotes,
    tradePlan: enhanced.tradePlan ?? null,
    usage: null,
    error,
  };
}

function buildFallbackTradePlan(input: AgentRunInput, run: AgentRunRecord): LiveAgentTradePlan | null {
  const quote = input.marketProbability;
  if (quote === null) return null;
  const side = run.sizing.side === "YES" || run.sizing.side === "NO" ? run.sizing.side : "NONE";
  return {
    status: side === "NONE" ? "watch" : "trade",
    targetOutcome: null,
    side,
    marketQuote: input.marketPriceLabel ?? `${Math.round(quote * 100)}c`,
    fairProbability: input.agentProbability,
    edge: side === "YES" ? input.agentProbability - quote : side === "NO" ? quote - input.agentProbability : null,
    confidence: input.confidence,
    rationale: "Fallback trade plan derived from the deterministic run while preserving manual execution.",
    alternative: null,
    hedgeOrExit: null,
  };
}

function adaptDraftMarketAnalysis(
  analysis: ParsedModelAnalysis,
  input: AgentRunInput,
  analysisLayer: "base" | "x402_upgrade",
): ParsedModelAnalysis {
  if (input.venue !== "Draft" && input.marketProbability !== null) return analysis;

  const isPaid = analysisLayer === "x402_upgrade";
  const confidence = Math.max(analysis.confidence, isPaid ? 0.72 : 0.62);
  const summaryPrefix = isPaid
    ? "MARKET IDEA / review: Paid research surfaced current evidence for a possible market, but no live venue price exists."
    : "MARKET IDEA / review: No live venue price exists, so this is a market-design brief rather than a YES/NO bet.";
  const ideaDriver =
    "Convert the event into an objective market question with dated resolution criteria before any trade or proof flow.";
  const noPriceNote =
    "No listed Polymarket quote was provided; the agent cannot calculate tradable EV or recommend BET YES/BET NO.";

  return {
    ...analysis,
    recommendation: "RESEARCH_MORE",
    riskGate: "review",
    confidence,
    summary: truncate(
      `${summaryPrefix} ${analysis.summary.replace(/^(BET_YES|BET_NO|YES|NO|WAIT|RESEARCH_MORE)\s*\/\s*review:\s*/i, "").trim()}`,
      900,
    ),
    keyDrivers: [ideaDriver, ...analysis.keyDrivers.filter((item) => item !== ideaDriver)].slice(0, 6),
    missingEvidence: [
      "A concrete market contract, outcome set, and resolution source.",
      ...analysis.missingEvidence.filter((item) => !/market price|venue price|quote/i.test(item)),
    ].slice(0, 6),
    sourceCredibilityNotes: analysis.sourceCredibilityNotes.slice(0, 6),
    policyNotes: [
      noPriceNote,
      "Use the brief to draft market ideas or stage a watch intent; do not treat this as an executable trade.",
      ...analysis.policyNotes.filter((item) => !/bet yes|bet no/i.test(item)),
    ].slice(0, 6),
    tradePlan: {
      status: "research_more",
      targetOutcome: null,
      side: "NONE",
      marketQuote: input.marketPriceLabel ?? null,
      fairProbability: null,
      edge: null,
      confidence,
      rationale:
        "This is an event-intelligence or market-idea request. Without a listed Polymarket quote, the agent can assess demand, evidence, resolution design, and risks, but not size a directional bet.",
      alternative:
        "Draft a market such as a dated legal/political outcome, leadership status, resignation/removal question, or official-announcement question with a named resolution source.",
      hedgeOrExit: analysis.tradePlan?.hedgeOrExit ?? null,
    },
  };
}

function buildPaidEvidenceDrivers(
  compact: ReturnType<typeof compactPaidResearchForModel>,
  okServices: number,
  totalServices: number,
) {
  const drivers = [`Circle x402 paid layer returned ${okServices}/${totalServices} usable services.`];
  const holderLeader = compact.holderFlow.sideTotals[0] ?? null;
  if (holderLeader) {
    drivers.push(`Top-holder snapshot is led by ${holderLeader.side} exposure (${formatModelUsd(holderLeader.amountUsd)} returned).`);
  }
  if (compact.socialHighlights.length > 0) {
    drivers.push(`Recent X/social search returned ${compact.socialHighlights.length} high-engagement posts for sentiment context.`);
  }
  const deepResearch = compact.services.find((service) => /deep research/i.test(service.name) && service.status === "ok");
  if (deepResearch) drivers.push("Perplexity Deep Research returned a usable paid cited-research layer.");
  return drivers.slice(0, 4);
}

function removeCoveredMissingEvidence(
  items: string[],
  coverage: { hasPaidSearch: boolean; hasSocial: boolean; hasHolderFlow: boolean },
) {
  return items.filter((item) => {
    const normalized = item.toLowerCase();
    if (coverage.hasPaidSearch && /(fresh|live|recent|current).*(news|research|intelligence|data)/i.test(normalized)) return false;
    if (coverage.hasSocial && /(x|twitter|social|sentiment|hype)/i.test(normalized)) return false;
    if (coverage.hasHolderFlow && /(holder|wallet|flow|top-holder|smart money)/i.test(normalized)) return false;
    return true;
  });
}

function formatRecommendationSummary(recommendation: LiveAgentModelAnalysis["recommendation"]) {
  if (recommendation === "BET_YES") return "BET YES / review:";
  if (recommendation === "BET_NO") return "BET NO / review:";
  if (recommendation === "DO_NOT_BET") return "DO NOT BET / blocked:";
  if (recommendation === "RESEARCH_MORE") return "RESEARCH MORE / review:";
  return "WAIT / review:";
}

function enhancePaidUpgradeAnalysis(
  analysis: ParsedModelAnalysis,
  {
    input,
    paidResearch,
    analysisLayer,
  }: {
    input: AgentRunInput;
    paidResearch: LiveX402ResearchSummary | null;
    analysisLayer: "base" | "x402_upgrade";
  },
): ParsedModelAnalysis {
  if (analysisLayer !== "x402_upgrade" || !paidResearch) return analysis;

  const okServices = paidResearch.services.filter((service) => service.status === "ok");
  if (okServices.length === 0) return analysis;

  const compact = compactPaidResearchForModel(paidResearch);
  const hasPaidSearch = okServices.some((service) =>
    /tavily|exa|parallel|perplexity|search|news/i.test(`${service.id} ${service.name}`),
  );
  const hasDeepResearch = okServices.some((service) => /deep-research|deep research/i.test(`${service.id} ${service.name}`));
  const hasSocial = compact.socialHighlights.length > 0;
  const holderLeader = compact.holderFlow.sideTotals[0] ?? null;
  const recommendationSide =
    analysis.recommendation === "BET_YES"
      ? "YES"
      : analysis.recommendation === "BET_NO"
        ? "NO"
        : analysis.tradePlan?.side === "YES" || analysis.tradePlan?.side === "NO"
          ? analysis.tradePlan.side
          : null;
  const holderSupportsRecommendation =
    holderLeader && recommendationSide && holderLeader.side === recommendationSide && holderLeader.amountUsd > 0;
  const cleanerMissingEvidence = analysis.missingEvidence.filter((item) => {
    const normalized = item.toLowerCase();
    if (hasPaidSearch && /(fresh|live|recent|current).*(news|research|intelligence|sentiment|data)/i.test(normalized)) {
      return false;
    }
    if (hasSocial && /(x|twitter|social|sentiment|hype)/i.test(normalized)) return false;
    if (holderSupportsRecommendation && /(holder|wallet|flow|top-holder|smart money)/i.test(normalized)) return false;
    return true;
  });
  const inferredEdge = inferTradePlanEdge(input, analysis.tradePlan ?? null);
  const upgradedTradePlan =
    analysis.tradePlan && inferredEdge !== null && analysis.tradePlan.edge === null
      ? { ...analysis.tradePlan, edge: inferredEdge }
      : analysis.tradePlan ?? null;
  const minimumConfidence =
    analysis.recommendation === "BET_YES" || analysis.recommendation === "BET_NO"
      ? Math.max(
          analysis.confidence,
          hasDeepResearch ? 0.7 : 0,
          holderSupportsRecommendation ? 0.68 : 0,
          hasPaidSearch && hasSocial ? 0.66 : 0,
        )
      : analysis.confidence;
  const paidNotes = [
    holderSupportsRecommendation
      ? `Paid holder-flow leans ${holderLeader.side}: ${formatModelUsd(holderLeader.amountUsd)} across ${holderLeader.count} returned holders. This is treated as directional context, not manipulation by itself.`
      : null,
    hasSocial
      ? `Recent paid X/social evidence returned ${compact.socialHighlights.length} high-engagement post${compact.socialHighlights.length === 1 ? "" : "s"} and was folded into the thesis.`
      : null,
  ].filter(Boolean) as string[];

  return {
    ...analysis,
    confidence: Math.min(0.92, minimumConfidence),
    missingEvidence: cleanerMissingEvidence.slice(0, 6),
    sourceCredibilityNotes: [...paidNotes, ...analysis.sourceCredibilityNotes].slice(0, 6),
    tradePlan: upgradedTradePlan,
  };
}

function inferTradePlanEdge(
  input: AgentRunInput,
  tradePlan: ParsedModelAnalysis["tradePlan"],
) {
  const venueQuote = input.marketProbability;
  const fair = tradePlan?.fairProbability;
  if (!tradePlan || venueQuote === null || fair === null || fair === undefined) return null;
  if (tradePlan.side === "YES") return Number((fair - venueQuote).toFixed(4));
  if (tradePlan.side === "NO") {
    const yesFair = fair > 0.5 ? 1 - fair : fair;
    return Number((venueQuote - yesFair).toFixed(4));
  }
  return null;
}

function formatModelUsd(value: number) {
  if (!Number.isFinite(value)) return "$0";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function rebalanceTimidRecommendation(analysis: ParsedModelAnalysis): ParsedModelAnalysis {
  if (analysis.riskGate === "blocked") return analysis;
  if (analysis.recommendation !== "WAIT" && analysis.recommendation !== "RESEARCH_MORE") return analysis;

  const lean = detectCleanerLean(analysis);
  if (!lean) return analysis;

  const recommendation = lean === "YES" ? "BET_YES" : "BET_NO";
  const confidence =
    analysis.confidence <= 0.56
      ? Math.min(0.68, Math.max(0.59, analysis.confidence + 0.05))
      : analysis.confidence;

  return {
    ...analysis,
    recommendation,
    riskGate: analysis.riskGate === "open" ? "open" : "review",
    confidence,
    summary: rewriteSummaryForLean(analysis.summary, lean),
    tradePlan: alignTradePlanWithLean(analysis.tradePlan ?? null, lean, confidence),
  };
}

function alignTradePlanWithLean(
  tradePlan: ParsedModelAnalysis["tradePlan"],
  lean: "YES" | "NO",
  confidence: number,
): ParsedModelAnalysis["tradePlan"] {
  if (tradePlan && tradePlan.side !== "NONE") {
    return {
      ...tradePlan,
      status: tradePlan.status === "avoid" ? "watch" : tradePlan.status,
      confidence: tradePlan.confidence ?? confidence,
    };
  }

  return {
    status: "watch",
    targetOutcome: tradePlan?.targetOutcome ?? null,
    side: lean,
    marketQuote: tradePlan?.marketQuote ?? null,
    fairProbability: tradePlan?.fairProbability ?? null,
    edge: tradePlan?.edge ?? null,
    confidence: tradePlan?.confidence ?? confidence,
    rationale:
      tradePlan?.rationale ??
      `The cleaner manual lean is ${lean}, but the agent keeps execution review-first until human approval.`,
    alternative: tradePlan?.alternative ?? null,
    hedgeOrExit: tradePlan?.hedgeOrExit ?? null,
  };
}

function detectCleanerLean(analysis: ParsedModelAnalysis): "YES" | "NO" | null {
  const tradePlan = analysis.tradePlan ?? null;
  const plannedSide = tradePlan?.side;
  if (
    tradePlan &&
    (plannedSide === "YES" || plannedSide === "NO") &&
    tradePlan.status !== "avoid" &&
    (tradePlan.edge === null || Math.abs(tradePlan.edge) >= 0.025)
  ) {
    return plannedSide;
  }

  const text = [
    ...analysis.policyNotes,
    analysis.summary,
    analysis.thesis,
    ...analysis.keyDrivers,
  ].join(" ");
  const yesIndex = firstLeanIndex(text, "YES");
  const noIndex = firstLeanIndex(text, "NO");

  if (yesIndex === -1 && noIndex === -1) return null;
  if (yesIndex !== -1 && (noIndex === -1 || yesIndex < noIndex)) return "YES";
  if (noIndex !== -1 && (yesIndex === -1 || noIndex < yesIndex)) return "NO";
  return null;
}

function firstLeanIndex(text: string, side: "YES" | "NO") {
  const patterns = [
    new RegExp(`cleaner\\s+(?:manual\\s+)?lean\\s+(?:is\\s+)?${side}\\b`, "i"),
    new RegExp(`manual\\s+lean\\s+(?:is\\s+)?${side}\\b`, "i"),
    new RegExp(`${side}\\s+(?:is\\s+)?(?:the\\s+)?(?:mathematically\\s+)?advantaged\\s+side`, "i"),
    new RegExp(`${side}\\s+(?:has|holds|offers)\\s+(?:positive\\s+)?expected\\s+value`, "i"),
    new RegExp(`positive\\s+expected\\s+value\\s+(?:on|for)\\s+${side}\\b`, "i"),
  ];

  return patterns.reduce((best, pattern) => {
    const match = text.match(pattern);
    if (!match || match.index === undefined) return best;
    return best === -1 ? match.index : Math.min(best, match.index);
  }, -1);
}

function rewriteSummaryForLean(summary: string, lean: "YES" | "NO") {
  if (/^(BET_YES|BET_NO|YES|NO)\s*\/\s*review/i.test(summary)) return summary;
  return `${lean} / review: ${summary.replace(/^(WAIT|RESEARCH_MORE)\s*\/\s*review:\s*/i, "").trim()}`;
}

function isResearchRelevant(market: string, research: ResearchSnapshot) {
  const haystack = [
    research.query,
    ...research.topSources.slice(0, 6).flatMap((source) => [source.title, source.domain, source.content]),
  ].join(" ");

  return sharesMarketTokens(market, haystack);
}

function sharesMarketTokens(a: string, b: string) {
  const aTokens = significantTokens(a);
  const bTokens = new Set(significantTokens(b));

  return aTokens.some((token) => bTokens.has(token));
}

function significantTokens(value: string) {
  const stopWords = new Set([
    "will",
    "this",
    "that",
    "with",
    "from",
    "market",
    "prediction",
    "polymarket",
    "before",
    "after",
    "above",
    "below",
    "hangi",
    "bunu",
    "için",
    "olan",
    "bahis",
    "tahmin",
  ]);

  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 3 && !stopWords.has(token));
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error("Model did not return parseable JSON.");
  }
}

function emptyModelAnalysis({
  status,
  provider,
  model,
  error,
}: {
  status: "skipped" | "error";
  provider: string;
  model: string;
  error: string;
}): LiveAgentModelAnalysis {
  return {
    status,
    provider,
    model,
    recommendation: "WAIT",
    riskGate: "review",
    confidence: 0,
    thesis: "Live model analysis is not available for this run.",
    summary: "The deterministic agent result is still available.",
    keyDrivers: [],
    missingEvidence: [],
    sourceCredibilityNotes: [],
    policyNotes: ["Manual mode remains active."],
    tradePlan: null,
    usage: null,
    error,
  };
}
