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
          content: buildModelPrompt({
            input,
            run,
            research,
            marketResearch,
            paidResearch,
            topAlert,
            sentientContext,
            analysisLayer,
            baselineAnalysis,
          }),
        },
      ],
      max_tokens: config.maxOutputTokens,
      temperature: 0.2,
    });
    const content = response.choices[0]?.message?.content ?? "";
    const parsed = rebalanceTimidRecommendation(modelAnalysisSchema.parse(parseJsonObject(content)));

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
        promptTokens: response.usage?.prompt_tokens ?? null,
        completionTokens: response.usage?.completion_tokens ?? null,
        totalTokens: response.usage?.total_tokens ?? null,
      },
    };
  } catch (error) {
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
      strictRules: [
        "Manual mode only.",
        "Do not execute trades.",
        "Do not call wallets.",
        "Do not pay APIs.",
        "Do not write Arc receipts.",
        "Explicitly judge whether the market appears mispriced relative to the model probability.",
        "If there is positive expected value, state the likely side and explain the edge.",
        "Use Kelly-style sizing and the deterministic sizing result; if sizing is zero, explain why.",
        "Mention hedge or early-close conditions when relevant.",
        "Mention portfolio/correlation risk when the market overlaps with other macro, political, sports, or crypto exposures.",
        "Weight source credibility; separate official data, credible news, social sentiment, and weak/noisy signals.",
        "Do not confuse Polymarket cent prices with displayed percentages. If market.marketPriceLabel is present, call it a venue price/quote, e.g. 'YES price is 99¢' or 'price-implied estimate', not 'the market probability is 99%'.",
        "Only quote a percentage chance when a source explicitly provides a percentage chance. Otherwise use cents for Polymarket prices.",
        "Always separate the selected outcome from the selected side. A side is YES, NO, or NONE; the targetOutcome is the candidate, team, date, or exact outcome the side applies to.",
        "For multi-outcome events, choose the best expected-value contract, not merely the most likely winner. Example: 'Buy YES on Kim' and 'Buy NO on Donald' are different trade plans.",
        "If the most likely outcome is not the best expected-value trade, state that clearly in tradePlan.rationale or tradePlan.alternative.",
        "For multi-outcome markets, tradePlan.targetOutcome must name the exact outcome, candidate, team, or date when a trade or lean exists.",
        "If no trade is actionable, tradePlan.side should be NONE and tradePlan.status should be watch, avoid, or research_more; still name the most relevant targetOutcome if one is being monitored.",
        "tradePlan.edge is fairProbability minus the venue quote for the selected outcome when both are available. If unavailable, use null.",
        "tradePlan.fairProbability is your evidence-weighted probability for the selected targetOutcome, not the venue quote.",
        "For sports, esports, or any competition market, explicitly look for head-to-head record, recent form, results against similar-strength opponents, roster/injury/schedule/news, and historical integrity or match-fixing concerns. If unavailable, list these as missing evidence.",
        "For competition markets, treat suspicious one-sided flow, top-holder concentration, or smart-wallet clustering as integrity risk rather than pure alpha.",
        "For legal or political-person markets, distinguish allegation, detention/arrest, indictment, conviction, sentence, appeal, and release. Use presumption-of-innocence language and require official court/prosecutor or highly credible reporting before recommending any market design or trade.",
        "For company or public-figure political-proximity analysis, use observable evidence only: official roles, public contracts, filings, ownership, sanctions, court records, or repeated credible reporting. Never present unsupported proximity as fact.",
        "If source quality is weak, prefer WAIT or RESEARCH_MORE.",
        "If manipulation/integrity risk is high, prefer DO_NOT_BET or review.",
        "Do not use WAIT as a default safe answer. WAIT is only appropriate when the cleaner side cannot be identified, the edge is below execution threshold, or core evidence is missing.",
        "When one side has a meaningful evidence-weighted edge but execution risk is still review-level, recommend BET_YES or BET_NO with riskGate='review' and zero or capped sizing. Manual approval remains mandatory.",
        "If your own thesis says the cleaner manual lean is YES or NO, the recommendation should normally be BET_YES or BET_NO, not WAIT, unless riskGate must be blocked.",
        "If the model probability differs from the venue quote by at least 4 percentage points and source quality is not weak, identify the advantaged side instead of hiding behind WAIT.",
        "Do not default confidence to exactly 0.55. Calibrate confidence from evidence quality: around 0.50 for unusable evidence, 0.58-0.68 for modest but directional lean, 0.70+ for strong official/market-flow agreement.",
        "If recommendation is WAIT, still give a concise 'cleaner manual lean' in policyNotes whenever the evidence favors one side more than the other. Only say there is no cleaner side when evidence is genuinely balanced or unusable.",
        "If market.marketProbability is not null, market pricing is known; do not list missing market price as missing evidence.",
        "If market.venue is Draft, analyze market usefulness and launch design; do not treat missing market price as a failure.",
        "If market.outcomeSummary is present, this is a multi-outcome event. Analyze the whole field and relative venue quotes; do not collapse the answer to a single candidate unless the user explicitly asked about that candidate.",
        "For nominee/election field markets, compare frontrunners, tail candidates, market price distribution, and resolution wording. Identify which candidate/outcome is potentially mispriced, not only whether one low-priced candidate is plausible.",
        "For constitutional eligibility questions, do not equate legal barriers with literal zero probability. Separate nomination/acceptance rules from presidency/ballot-access rules; include legal loophole/tail-risk and annualized capital-lockup math before recommending NO at high prices.",
        "If recommendation is WAIT but one side is still the cleaner manual lean, include that side in policyNotes as: 'If you still trade manually, the cleaner lean is ... because ...'. If there is no cleaner side, say so explicitly.",
        "Use marketSpecificResearch as the primary research context when it is available.",
        "For the x402_upgrade layer, do not send paid results back into OpenDeepSearch and do not imply that OpenDeepSearch re-ran. Paid services, especially BlockRun/Tavily/Exa/Parallel/social/Perplexity, are the fresh evidence layer.",
        "For the x402_upgrade layer, explain what changed versus the baseline analysis: new data, stronger/ weaker confidence, newly visible paid signals, and remaining gaps.",
        "If paidX402Research exists, treat matching paid service evidence as highest priority, but explicitly ignore broad or unrelated service payloads that do not match the target market, teams, people, date, or venue.",
        "If paidX402Research includes top-holder or holder-flow services, summarize the top-side concentration and whether large wallets support YES, NO, or only indicate manipulation risk.",
        "Treat cachedResearch and cachedTradeFlow as secondary context; if unrelated to the target market, say confidence is lower instead of inventing relevance.",
        "Key drivers should include concrete recent events, sources, or demand signals when marketSpecificResearch provides them.",
        "Source credibility notes are written by the agent's source-quality reviewer. Phrase them as user-facing evidence-quality notes, not as provider criticism. Do not write things like 'OpenDeepSearch was insufficient' or 'ROMA flags weak data'; instead say 'web research is partial' or 'safety review keeps this review-first'.",
        "Do not mention internal vendor/framework names in the final user-facing analysis except Circle x402, because x402 usage is a product feature.",
      ],
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
      paidX402Research: paidResearch
        ? {
            status: paidResearch.status,
            query: paidResearch.query,
            maxTotalUsdc: paidResearch.maxTotalUsdc,
            estimatedMaxSpendUsdc: paidResearch.estimatedMaxSpendUsdc,
            actualPaidUsdc: paidResearch.actualPaidUsdc,
            services: paidResearch.services.map((service) => ({
              id: service.id,
              name: service.name,
              provider: service.provider,
              phase: service.phase,
              status: service.status,
              maxAmountUsdc: service.maxAmountUsdc,
              purpose: service.purpose,
              summary: service.summary.slice(0, 1400),
              error: service.error,
            })),
          }
        : null,
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
