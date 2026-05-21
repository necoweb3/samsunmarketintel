import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import { readPrimaryModelConfig } from "@/src/product/primaryModel";
import { readSourceRegistry, type SourceRegistryRecord } from "@/src/product/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NewsPotential = "High" | "Medium" | "Watch";
type NewsHorizon = "Daily" | "Weekly";

type NewsBite = {
  id: string;
  title: string;
  summary: string;
  sourceName: string;
  url: string;
  publishedAt: string;
  publishedAtIso: string | null;
  thumbnailUrl: string | null;
  category: string;
  horizon: NewsHorizon;
  marketPotential: NewsPotential;
  score: number;
  scoreExplanation: string;
  reasons: string[];
  suggestedQuestion: string;
  resolutionHint: string;
  sourceSupport: string[];
  demandSignals?: string[];
};

type SerperItem = {
  title?: string;
  link?: string;
  snippet?: string;
  source?: string;
  date?: string;
  imageUrl?: string;
};

type FetchedItem = SerperItem & {
  requestedHorizon: NewsHorizon;
  sourceDomain?: string;
  sourceName?: string;
  sourceHandle?: string;
  feedType?: "news" | "web" | "x";
  forceTurkeyContext?: boolean;
};

type QuerySpec = {
  q: string;
  tbs: "qdr:d" | "qdr:w";
  horizon: NewsHorizon;
  sourceDomain?: string;
  sourceName?: string;
  sourceHandle?: string;
  endpoint?: "news" | "search";
  feedType?: "news" | "web" | "x";
  forceTurkeyContext?: boolean;
};

type SourceMatch = {
  names: string[];
  bestWeight: number;
  bestCredibility: string;
};

const BASE_QUERY_SPECS: QuerySpec[] = [
  {
    q: "site:aa.com.tr OR site:dw.com OR site:bbc.com/turkce Turkiye bugun tutuklama sorusturma mahkeme kamuoyu",
    tbs: "qdr:d",
    horizon: "Daily",
    endpoint: "search",
    feedType: "web",
  },
  {
    q: "Turkiye son dakika bugun gozalti tutuklama iddianame savcilik mahkeme resmi aciklama",
    tbs: "qdr:d",
    horizon: "Daily",
    endpoint: "search",
    feedType: "web",
  },
  {
    q: "Rasim Ozan Kütahyalı tutuklandı yasa dışı bahis kara para aklama",
    tbs: "qdr:w",
    horizon: "Weekly",
  },
  {
    q: "Türkiye tutuklandı soruşturma son dakika",
    tbs: "qdr:w",
    horizon: "Weekly",
  },
  {
    q: "Türkiye gündem hapis soruşturma yasa dışı bahis",
    tbs: "qdr:w",
    horizon: "Weekly",
  },
  {
    q: "Türkiye ekonomi bugün enflasyon TCMB faiz dolar TL TÜİK piyasa beklentisi",
    tbs: "qdr:w",
    horizon: "Weekly",
  },
  {
    q: "Türkiye spor bahis şike soruşturma maç sakatlık transfer kulüp bugün",
    tbs: "qdr:w",
    horizon: "Weekly",
  },
  {
    q: "Türkiye seçim anket yasa tasarısı resmi açıklama belediye hükümet bu hafta",
    tbs: "qdr:w",
    horizon: "Weekly",
  },
  {
    q: "Türkiye jeopolitik anlaşma sınır güvenlik enerji yaptırım resmi açıklama",
    tbs: "qdr:w",
    horizon: "Weekly",
  },
];

const ideaReviewSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    marketPotential: z.enum(["High", "Medium", "Watch"]).optional(),
    score: z.number().min(0).max(100).optional(),
    category: z.string().min(2).max(80).optional(),
    reasons: z.array(z.string().min(2).max(220)).max(4).optional(),
    suggestedQuestion: z.string().min(10).max(260).optional(),
    resolutionHint: z.string().min(10).max(260).optional(),
  })).max(24),
});

const FEATURED_MARKET_CASES: NewsBite[] = [
  {
    id: "featured-rasim-ozan-kutahyali-legal-outcome",
    title: "Rasim Ozan Kütahyalı legal-outcome watch",
    summary:
      "Multiple Turkey sources reported that the public commentator was detained on May 14 and arrested on May 18 in an illegal-betting, fraud, bribery, and money-laundering investigation. This is a market-design case study, not a guilt claim.",
    sourceName: "Medyascope / Dünya",
    url: "https://medyascope.tv/2026/05/18/rasim-ozan-kutahyali-tutuklandi/",
    publishedAt: "18 May 2026",
    publishedAtIso: "2026-05-18T07:55:00.000Z",
    thumbnailUrl: null,
    category: "Legal / Political Risk",
    horizon: "Weekly",
    marketPotential: "High",
    score: 88,
    scoreExplanation:
      "Market potential score, not probability. This case has freshness, public attention, legal milestone language, and multiple source layers, but needs official records before launch.",
    reasons: [
      "Fresh public-figure legal milestone: detention was reported on May 14 and arrest on May 18.",
      "Multiple credible local sources independently cover the procedural status.",
      "The topic has obvious public-attention demand, but X and Google interest should be verified with paid social/search before launch.",
      "A launchable market must ask about a formal legal milestone, not guilt, rumors, or political proximity.",
    ],
    suggestedQuestion:
      "Will a formal indictment against Rasim Ozan Kütahyalı in the illegal-betting investigation be accepted by a Turkish court before July 31, 2026?",
    resolutionHint:
      "Resolve from official court/prosecutor records first. Credible reporting from registered sources can only be fallback. Accusations alone must not resolve the market.",
    sourceSupport: ["Medyascope", "Dünya Gazetesi", "BBC/DW-style validation layer"],
    demandSignals: [
      "Use AIsa X search to rank recent posts and engagement around the exact name.",
      "Use web/Google search results as a public-interest proxy; true Google Trends volume needs a dedicated trends provider.",
    ],
  },
];

const FALLBACK_ITEMS: NewsBite[] = [
  {
    id: "fallback-legal-public-figure",
    title: "Public-figure legal outcome watch",
    summary:
      "Template for stories involving detention, indictment, conviction, sentence, appeal, or release milestones.",
    sourceName: "Curated fallback",
    url: "https://www.aa.com.tr/",
    publishedAt: "Needs live source",
    publishedAtIso: null,
    thumbnailUrl: null,
    category: "Legal / Political Risk",
    horizon: "Weekly",
    marketPotential: "Medium",
    score: 70,
    scoreExplanation:
      "Market potential score, not probability: resolution clarity + public demand + source quality.",
    reasons: [
      "Legal outcomes can be marketable only when the milestone is formal and sourceable.",
      "Needs official court/prosecutor source before any launch proposal.",
      "Social outrage alone is not enough for a market.",
    ],
    suggestedQuestion:
      "Will the named public figure receive a formal indictment, conviction, or sentence before a specified deadline?",
    resolutionHint:
      "Resolve from official court/prosecutor records first; credible reporting only as fallback.",
    sourceSupport: [],
  },
  {
    id: "fallback-macro-cpi",
    title: "Turkey CPI or CBRT surprise window",
    summary:
      "Monthly CPI and rate-decision windows are clean short-duration markets when consensus and official release time are defined.",
    sourceName: "Curated fallback",
    url: "https://www.tcmb.gov.tr/",
    publishedAt: "Needs live source",
    publishedAtIso: null,
    thumbnailUrl: null,
    category: "Turkey Macro",
    horizon: "Daily",
    marketPotential: "Medium",
    score: 72,
    scoreExplanation:
      "Market potential score, not probability: resolution clarity + public demand + source quality.",
    reasons: [
      "Official macro releases create objective resolution points.",
      "Consensus-vs-actual framing can create repeatable short-duration markets.",
      "Needs a timestamped consensus snapshot.",
    ],
    suggestedQuestion:
      "Will Turkey's next official annual CPI print exceed the pre-declared economist consensus by at least 50 bps?",
    resolutionHint: "Resolve from TUIK/TCMB official releases and a timestamped consensus snapshot.",
    sourceSupport: [],
  },
  {
    id: "fallback-competition-integrity",
    title: "Competition integrity flow watch",
    summary:
      "Sports, esports, and other head-to-head events can be monitored for form, injuries, lineup news, and abnormal betting flow.",
    sourceName: "Curated fallback",
    url: "https://polymarket.com/",
    publishedAt: "Needs live source",
    publishedAtIso: null,
    thumbnailUrl: null,
    category: "Competition Integrity",
    horizon: "Daily",
    marketPotential: "Watch",
    score: 61,
    scoreExplanation:
      "Market potential score, not probability: resolution clarity + public demand + source quality.",
    reasons: [
      "Competition markets need head-to-head, recent form, similar-opponent, injury, and lineup checks.",
      "Abnormal top-holder concentration can be a warning, not an automatic bet.",
      "Watch-only mode is safer until paid flow data confirms the signal.",
    ],
    suggestedQuestion:
      "Will this competition event be flagged for abnormal pre-event prediction-market flow before the scheduled start time?",
    resolutionHint: "Resolve from official event metadata plus paid trade-flow and top-holder snapshots.",
    sourceSupport: [],
  },
];

export async function GET() {
  const apiKey = process.env.SERPER_API_KEY;
  const updatedAt = new Date().toISOString();
  const registry = await readSourceRegistry();

  if (!apiKey) {
    return NextResponse.json(
      buildResponse(
        [...FEATURED_MARKET_CASES, ...FALLBACK_ITEMS],
        updatedAt,
        "fallback + featured-case",
        registry,
        "SERPER_API_KEY is not configured.",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const querySpecs = buildQuerySpecs(registry);
  const fetched = await Promise.all(querySpecs.map((query) => fetchSerperNews(query, apiKey)));
  const rawItems = fetched.flat();
  const now = new Date();
  const classifiedItems = dedupeNewsItems(rawItems)
    .map((item, index) => classifyNewsItem(item, registry, now, index))
    .filter((item): item is NewsBite => item !== null)
    .sort((a, b) => b.score - a.score);
  const reviewedItems = await reviewMarketIdeasWithModel(
    dedupeClassifiedItems([...FEATURED_MARKET_CASES, ...classifiedItems]).slice(0, 30),
  );
  const items = await enrichNewsThumbnails(
    reviewedItems.items,
  );

  return NextResponse.json(
    buildResponse(
      items.length > 0 ? items : [...FEATURED_MARKET_CASES, ...FALLBACK_ITEMS],
      updatedAt,
      items.length > 0
        ? `serper-news + featured-case${reviewedItems.modelReviewed ? " + model-review" : ""}`
        : "fallback + featured-case",
      registry,
      items.length > 0 ? undefined : "Live provider returned no fresh Turkey-focused market candidates.",
    ),
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function reviewMarketIdeasWithModel(items: NewsBite[]) {
  const config = readPrimaryModelConfig();
  if (items.length === 0 || config.status !== "ready" || !config.openAICompatible || !config.baseUrl) {
    return { items, modelReviewed: false };
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) return { items, modelReviewed: false };

  const client = new OpenAI({
    apiKey,
    baseURL: config.baseUrl,
    defaultHeaders:
      config.provider === "OpenRouter"
        ? {
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3050",
            "X-Title": "Samsun Market Intel",
          }
        : undefined,
  });

  try {
    const response = await client.chat.completions.create(
      {
        model: config.providerModel,
        temperature: 0.1,
        max_tokens: Math.min(config.maxOutputTokens, 2600),
        messages: [
          {
            role: "system",
            content:
              "You review Turkey news candidates for prediction-market potential. Use only the provided title, summary, source, source support, and heuristic reasons. Do not invent facts. Upgrade only items with clear resolution targets, freshness, public demand, and credible source support. Return compact JSON only.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                "Review these items. Keep or revise marketPotential, score, category, reasons, suggestedQuestion, and resolutionHint. High means strong market-creation potential; Watch means interesting but needs confirmation; Medium is context only.",
              items: items.slice(0, 24).map((item) => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                sourceName: item.sourceName,
                category: item.category,
                marketPotential: item.marketPotential,
                score: item.score,
                reasons: item.reasons,
                suggestedQuestion: item.suggestedQuestion,
                resolutionHint: item.resolutionHint,
                sourceSupport: item.sourceSupport,
              })),
            }),
          },
        ],
        response_format: { type: "json_object" },
      },
      { timeout: 35_000 },
    );

    const parsed = ideaReviewSchema.safeParse(parseJson(response.choices[0]?.message?.content ?? ""));
    if (!parsed.success) return { items, modelReviewed: false };

    const reviews = new Map(parsed.data.items.map((item) => [item.id, item]));
    return {
      modelReviewed: true,
      items: items.map((item) => {
        const review = reviews.get(item.id);
        if (!review) return item;
        const score = typeof review.score === "number" ? clampScore(review.score) : item.score;
        return {
          ...item,
          category: review.category ?? item.category,
          marketPotential: review.marketPotential ?? readPotentialFromScore(score, item.marketPotential),
          score,
          reasons: review.reasons?.length ? review.reasons : item.reasons,
          suggestedQuestion: review.suggestedQuestion ?? item.suggestedQuestion,
          resolutionHint: review.resolutionHint ?? item.resolutionHint,
          scoreExplanation:
            "Market potential score, not probability. It combines freshness, resolution clarity, source quality, demand, risk, and model review.",
        };
      }),
    };
  } catch {
    return { items, modelReviewed: false };
  }
}

function parseJson(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) as unknown : null;
  }
}

function clampScore(value: number) {
  return Math.max(20, Math.min(96, Math.round(value)));
}

function readPotentialFromScore(score: number, fallback: NewsPotential): NewsPotential {
  if (score >= 82) return "High";
  if (score >= 68) return "Medium";
  return fallback === "High" ? "Watch" : fallback;
}

function buildQuerySpecs(registry: SourceRegistryRecord[]): QuerySpec[] {
  const sourceDomains = Array.from(new Set(registry
    .filter((record) => record.status !== "Watch")
    .flatMap((record) => record.domains)
    .map(normalizeDomain)
    .filter((domain) => domain.includes("."))
    .filter(
      (domain) =>
        ![
          "x.com",
          "twitter.com",
          "agents.circle.com",
          "nano.blockrun.ai",
          "api.aisa.one",
        ].includes(domain),
    )))
    .slice(0, 18);

  const sourceQueries = sourceDomains.map((domain): QuerySpec => ({
    q: `site:${domain} (Turkiye OR Turkey) (tutuklama OR sorusturma OR mahkeme OR TCMB OR enflasyon OR secim OR spor OR bahis OR "resmi aciklama")`,
    tbs: "qdr:w",
    horizon: "Weekly",
    sourceDomain: domain,
  }));

  return [...BASE_QUERY_SPECS, ...sourceQueries, ...buildXSourceQueries(registry)];
}

function buildXSourceQueries(registry: SourceRegistryRecord[]): QuerySpec[] {
  const records = registry
    .filter((record) => record.status !== "Watch")
    .filter(
      (record) =>
        record.type === "X account" ||
        record.type === "Social signal" ||
        record.type === "Community report" ||
        record.domains.some((domain) => normalizeDomain(domain) === "x.com"),
    )
    .map((record) => ({
      record,
      handle: readXHandle(record),
    }))
    .filter((item): item is { record: SourceRegistryRecord; handle: string } => Boolean(item.handle))
    .sort((a, b) => {
      if (a.handle === "asayisberkemal0") return -1;
      if (b.handle === "asayisberkemal0") return 1;
      return b.record.weight - a.record.weight;
    })
    .slice(0, 18);

  return records.flatMap(({ record, handle }) => [
    buildXQuery(record, handle, `site:x.com/${handle}`, "Daily"),
    buildXQuery(
      record,
      handle,
      `site:x.com/${handle} (Turkiye OR Turkey OR Istanbul OR Ankara OR gozaltina OR tutuklandi OR mahkeme OR sorusturma OR asayis OR ekonomi OR secim)`,
      "Daily",
    ),
    buildXQuery(
      record,
      handle,
      `site:x.com/${handle} (Turkiye OR Turkey OR Istanbul OR Ankara OR gozaltina OR tutuklandi OR mahkeme OR sorusturma OR asayis OR ekonomi OR secim)`,
      "Weekly",
    ),
  ]);
}

function buildXQuery(
  record: SourceRegistryRecord,
  handle: string,
  q: string,
  horizon: NewsHorizon,
): QuerySpec {
  return {
    q,
    tbs: horizon === "Daily" ? "qdr:d" : "qdr:w",
    horizon,
    endpoint: "search",
    feedType: "x",
    sourceName: record.name,
    sourceHandle: handle,
    forceTurkeyContext: true,
  };
}

async function fetchSerperNews(query: QuerySpec, apiKey: string): Promise<FetchedItem[]> {
  try {
    const endpoint = query.endpoint ?? "news";
    const response = await fetch(`https://google.serper.dev/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: query.q,
        gl: "tr",
        hl: "tr",
        tbs: query.tbs,
        num: query.feedType === "x" ? 6 : 8,
      }),
      cache: "no-store",
    });

    if (!response.ok) return [];

    const data = (await response.json()) as {
      news?: SerperItem[];
      organic?: SerperItem[];
    };

    return [...(data.news ?? []), ...(data.organic ?? [])].map((item) => ({
      ...item,
      requestedHorizon: query.horizon,
      sourceDomain: query.sourceDomain,
      sourceName: query.sourceName,
      sourceHandle: query.sourceHandle,
      feedType: query.feedType ?? (endpoint === "search" ? "web" : "news"),
      forceTurkeyContext: query.forceTurkeyContext,
    }));
  } catch {
    return [];
  }
}

function buildResponse(
  items: NewsBite[],
  updatedAt: string,
  provider: string,
  registry: SourceRegistryRecord[],
  message?: string,
) {
  const high = items.filter((item) => item.marketPotential === "High").length;
  const watch = items.filter((item) => item.marketPotential === "Watch").length;
  const medium = items.filter((item) => item.marketPotential === "Medium").length;
  const registeredSources = registry.filter((record) => record.status === "Active").length;

  return {
    status: "ok",
    provider,
    updatedAt,
    message,
    digest:
      high > 0
        ? `${high} high-potential fresh Turkey candidates; ${watch} watchlist items need source confirmation.`
        : watch > 0
          ? `${watch} watchlist items found; ${medium} unmarked candidates are useful context only.`
          : `${items.length} fresh candidates found; no high/watch signals yet. Registered sources will strengthen follow-up analysis.`,
    registeredSources,
    items,
  };
}

function dedupeNewsItems(items: FetchedItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeForScoring(item.link || item.title || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Boolean(item.title && item.link);
  });
}

function dedupeClassifiedItems(items: NewsBite[]) {
  const accepted: NewsBite[] = [];

  for (const item of items) {
    const duplicate = accepted.some((candidate) => {
      if (candidate.category !== item.category) return false;
      return titleSimilarity(candidate.title, item.title) >= 0.52;
    });

    if (!duplicate) accepted.push(item);
  }

  return accepted;
}

function classifyNewsItem(
  item: FetchedItem,
  registry: SourceRegistryRecord[],
  now: Date,
  index: number,
): NewsBite | null {
  const title = item.title?.trim() || "Untitled news item";
  const summary = normalizeSummary(item.snippet);
  const domain = readDomain(item.link ?? "");
  const sourceMatch =
    item.sourceName || item.sourceHandle
      ? matchSourceRegistryBySource(item.sourceName ?? "", item.sourceHandle ?? "", registry)
      : matchSourceRegistry(domain, registry);
  const rawText = `${title} ${summary} ${item.source ?? ""} ${item.sourceName ?? ""} ${item.sourceHandle ?? ""}`;
  const text = normalizeForScoring(`${rawText} ${domain}`);
  const dateInfo = parseSerperDate(item.date, now);
  const isFresh = dateInfo.ageDays === null || dateInfo.ageDays <= 14;

  if (!isFresh) return null;
  if (!hasTurkeyContext(text, domain, sourceMatch, rawText, item.forceTurkeyContext === true)) return null;

  const category = classifyCategory(text);
  const signals = detectSignals(text, category, sourceMatch, dateInfo.ageDays, item.feedType);
  const reasons = buildReasons(signals, category, sourceMatch, dateInfo.ageDays);
  const score = scoreNews(signals, category, sourceMatch, dateInfo.ageDays);
  if (score < 52) return null;

  const marketPotential: NewsPotential =
    score >= 82 ? "High" : signals.registeredXSource ? "Watch" : score >= 68 ? "Medium" : "Watch";

  return {
    id: `news-${slugify(title) || "item"}-${index + 1}`,
    title,
    summary,
    sourceName: item.sourceName?.trim() || item.source?.trim() || domain || "Live news",
    url: item.link ?? "#",
    publishedAt: item.date?.trim() || "Recent",
    publishedAtIso: dateInfo.date?.toISOString() ?? null,
    thumbnailUrl: sanitizeThumbnail(item.imageUrl),
    category,
    horizon: readHorizon(dateInfo.ageDays, item.requestedHorizon),
    marketPotential,
    score,
    scoreExplanation:
      "Market potential score, not probability. It estimates freshness, resolution clarity, source quality, demand, and risk.",
    reasons,
    suggestedQuestion: buildSuggestedQuestion(title, category, signals),
    resolutionHint: buildResolutionHint(category),
    sourceSupport: sourceMatch.names,
  };
}

function readHorizon(ageDays: number | null, fallback: NewsHorizon): NewsHorizon {
  if (ageDays !== null && ageDays <= 2) return "Daily";
  return fallback;
}

async function enrichNewsThumbnails(items: NewsBite[]) {
  const enriched = await Promise.all(
    items.map(async (item) => ({
      ...item,
      thumbnailUrl: item.thumbnailUrl ?? (await fetchOpenGraphImage(item.url)),
    })),
  );

  return enriched;
}

async function fetchOpenGraphImage(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SamsunMarketIntel/1.0; +https://agents.circle.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(2200),
      cache: "no-store",
    });

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = (await response.text()).slice(0, 180_000);
    const image =
      readMetaContent(html, "property", "og:image:secure_url") ??
      readMetaContent(html, "property", "og:image") ??
      readMetaContent(html, "name", "twitter:image");

    return normalizeImageUrl(image, url);
  } catch {
    return null;
  }
}

function readMetaContent(html: string, key: "property" | "name", value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+${key}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const reversePattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${key}=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern) ?? html.match(reversePattern);
  return match?.[1] ? decodeHtmlEntities(match[1]) : null;
}

function normalizeImageUrl(value: string | null, pageUrl: string) {
  if (!value) return null;
  try {
    const url = new URL(value, pageUrl);
    const lowered = url.href.toLowerCase();
    if (lowered.includes("placeholder") || lowered.includes("default-image")) return null;
    return url.href;
  } catch {
    return null;
  }
}

function classifyCategory(text: string) {
  if (
    hasAny(text, [
      "mahkeme",
      "savci",
      "savcilik",
      "iddianame",
      "tutuk",
      "gozalti",
      "goz alti",
      "ceza",
      "dava",
      "arrest",
      "detained",
      "indictment",
      "conviction",
      "sentence",
      "court",
      "prosecutor",
      "illegal betting",
      "yasa disi bahis",
    ])
  ) {
    return "Legal / Political Risk";
  }

  if (
    hasAny(text, [
      "enflasyon",
      "tuik",
      "tui k",
      "tcmb",
      "faiz",
      "merkez bankasi",
      "dolar",
      "usdtry",
      "lira",
      "cpi",
      "central bank",
      "interest rate",
    ])
  ) {
    return "Turkey Macro";
  }

  if (
    hasAny(text, [
      "sike",
      "bahis",
      "mac",
      "futbol",
      "basketbol",
      "voleybol",
      "espor",
      "esports",
      "injury",
      "roster",
      "lineup",
      "match fixing",
      "betting scandal",
    ])
  ) {
    return "Competition Integrity";
  }

  if (
    hasAny(text, [
      "secim",
      "anket",
      "meclis",
      "yasa",
      "bakan",
      "belediye",
      "agreement",
      "border",
      "sanction",
      "geopolitical",
      "war",
    ])
  ) {
    return "Geopolitics";
  }

  return "Local Event Watch";
}

function detectSignals(
  text: string,
  category: string,
  sourceMatch: SourceMatch,
  ageDays: number | null,
  feedType?: FetchedItem["feedType"],
) {
  return {
    fresh: ageDays !== null && ageDays <= 2,
    weeklyFresh: ageDays !== null && ageDays <= 7,
    registeredXSource: feedType === "x" && sourceMatch.names.length > 0,
    official:
      sourceMatch.bestCredibility === "Official" ||
      hasAny(text, ["resmi", "official", "tcmb", "tuik", "court", "mahkeme", "savcilik"]),
    registeredSource: sourceMatch.names.length > 0,
    legalMilestone:
      category === "Legal / Political Risk" &&
      hasAny(text, ["tutuk", "gozalti", "iddianame", "mahkeme", "dava", "ceza", "arrest", "court"]),
    macroRelease:
      category === "Turkey Macro" &&
      hasAny(text, ["enflasyon", "tcmb", "tuik", "faiz", "cpi", "central bank"]),
    competitionData:
      category === "Competition Integrity" &&
      hasAny(text, ["sike", "bahis", "mac", "futbol", "basketbol", "injury", "lineup", "match fixing"]),
    deadline:
      hasAny(text, ["bugun", "yarin", "bu hafta", "before", "by ", "deadline", "announced", "aciklan"]),
    allegation:
      hasAny(text, ["iddia", "alleged", "claim", "reportedly", "soylendi", "rumor"]),
    broadDemand:
      hasAny(text, ["kamuoyu", "piyasa", "beklenti", "anket", "secim", "dolar", "derbi", "final"]),
  };
}

function buildReasons(
  signals: ReturnType<typeof detectSignals>,
  category: string,
  sourceMatch: SourceMatch,
  ageDays: number | null,
) {
  const reasons: string[] = [];

  if (signals.fresh) reasons.push("Fresh item: published within roughly the last 48 hours.");
  else if (signals.weeklyFresh) reasons.push("Recent item: still inside the weekly discovery window.");

  if (signals.registeredSource) {
    reasons.push(`Registered source support: ${sourceMatch.names.slice(0, 2).join(", ")}.`);
  }

  if (signals.registeredXSource) {
    reasons.push("Registered X source signal: treat as an early lead, then confirm with news or official records.");
  }

  if (signals.legalMilestone) {
    reasons.push("Formal legal milestone language appears, so the market can be framed around indictment, conviction, sentence, appeal, or release.");
  }

  if (signals.macroRelease) {
    reasons.push("Macro release or policy-decision language appears, giving the market a clear timestamp and official data source.");
  }

  if (signals.competitionData) {
    reasons.push("Competition signal detected; analysis should check head-to-head, recent form, lineup/injury news, and abnormal betting flow.");
  }

  if (signals.deadline) {
    reasons.push("Deadline or announcement wording helps turn the story into an objective resolution question.");
  }

  if (signals.allegation) {
    reasons.push("Allegation-style wording lowers confidence; this needs source confirmation before becoming a proposal.");
  }

  if (reasons.length === 0) {
    reasons.push("The item has local event relevance, but it needs a clearer outcome and source before market design.");
  }

  if (ageDays === null) {
    reasons.push("Publication date is unclear, so freshness must be verified before launch.");
  }

  return reasons.slice(0, 5);
}

function scoreNews(
  signals: ReturnType<typeof detectSignals>,
  category: string,
  sourceMatch: SourceMatch,
  ageDays: number | null,
) {
  let score = 34;

  if (signals.fresh) score += 12;
  else if (signals.weeklyFresh) score += 7;
  else if (ageDays === null) score -= 8;

  if (signals.official) score += 12;
  if (signals.registeredSource) score += Math.round(sourceMatch.bestWeight * 14);
  if (signals.registeredXSource) score += 16;
  if (signals.legalMilestone) score += 16;
  if (signals.macroRelease) score += 15;
  if (signals.competitionData) score += 11;
  if (signals.deadline) score += 8;
  if (signals.broadDemand) score += 5;
  if (category === "Local Event Watch") score -= 8;
  if (signals.allegation) score -= 7;

  return Math.max(20, Math.min(96, score));
}

function buildSuggestedQuestion(
  title: string,
  category: string,
  signals: ReturnType<typeof detectSignals>,
) {
  if (category === "Legal / Political Risk") {
    return `Will the legal case described in "${title}" reach a formal legal milestone before a specified deadline?`;
  }

  if (category === "Turkey Macro") {
    return `Will the official Turkey macro outcome related to "${title}" exceed the pre-declared market consensus?`;
  }

  if (category === "Competition Integrity") {
    return signals.competitionData
      ? `Will the competition event related to "${title}" be flagged for abnormal pre-event betting or integrity risk?`
      : `Will the competition event related to "${title}" resolve to the market's listed outcome?`;
  }

  if (category === "Geopolitics") {
    return `Will the event described in "${title}" result in a formal official announcement before a specified deadline?`;
  }

  return `Will the event described in "${title}" reach a clear official outcome before a specified deadline?`;
}

function buildResolutionHint(category: string) {
  if (category === "Legal / Political Risk") {
    return "Use official court/prosecutor records first; credible reporting can only be fallback.";
  }

  if (category === "Turkey Macro") {
    return "Use TUIK, TCMB, official FX references, and a timestamped consensus snapshot.";
  }

  if (category === "Competition Integrity") {
    return "Use official event metadata, team news, and paid trade-flow/top-holder concentration snapshots.";
  }

  if (category === "Geopolitics") {
    return "Use official statements, treaty texts, or clearly named government sources.";
  }

  return "Require a named deadline, objective outcome, and at least one resolution-grade source.";
}

function matchSourceRegistry(domain: string, registry: SourceRegistryRecord[]): SourceMatch {
  const normalized = normalizeDomain(domain);
  if (normalized === "x.com" || normalized === "twitter.com") {
    return {
      names: [],
      bestWeight: 0,
      bestCredibility: "Unregistered",
    };
  }
  const matches = registry.filter((record) =>
    record.domains.some((candidate) => {
      const source = normalizeDomain(candidate);
      return source && normalized && (normalized === source || normalized.endsWith(`.${source}`));
    }),
  );
  const best = matches.reduce<SourceRegistryRecord | null>(
    (current, record) => (!current || record.weight > current.weight ? record : current),
    null,
  );

  return {
    names: matches.map((record) => record.name),
    bestWeight: best?.weight ?? 0,
    bestCredibility: String(best?.credibility ?? "Unregistered"),
  };
}

function matchSourceRegistryBySource(
  sourceName: string,
  sourceHandle: string,
  registry: SourceRegistryRecord[],
): SourceMatch {
  const normalizedName = normalizeForScoring(sourceName);
  const normalizedHandle = normalizeForScoring(sourceHandle).replace(/^@/, "");
  const matches = registry.filter((record) => {
    const recordName = normalizeForScoring(record.name);
    const recordHandle = readXHandle(record);

    return (
      Boolean(normalizedName && recordName === normalizedName) ||
      Boolean(normalizedName && recordName.includes(normalizedName)) ||
      Boolean(normalizedHandle && recordHandle === normalizedHandle)
    );
  });
  const best = matches.reduce<SourceRegistryRecord | null>(
    (current, record) => (!current || record.weight > current.weight ? record : current),
    null,
  );

  return {
    names: matches.map((record) => record.name),
    bestWeight: best?.weight ?? 0,
    bestCredibility: String(best?.credibility ?? "Unregistered"),
  };
}

function hasTurkeyContext(
  text: string,
  domain: string,
  sourceMatch: SourceMatch,
  rawText: string,
  forceTurkeyContext = false,
) {
  return (
    forceTurkeyContext ||
    hasAny(text, [
      "turkiye",
      "turkey",
      "turkish",
      "istanbul",
      "ankara",
      "izmir",
      "tcmb",
      "tuik",
      "cbrt",
      "lira",
      "akp",
      "chp",
      "ysk",
      "meclis",
    ]) ||
    /[ğüşöçıİĞÜŞÖÇ]/.test(rawText) ||
    domain.endsWith(".tr") ||
    sourceMatch.names.some((name) => normalizeForScoring(name).includes("turkey"))
  );
}

function parseSerperDate(value: string | undefined, now: Date) {
  if (!value) return { date: null, ageDays: null };

  const normalized = normalizeForScoring(value);
  const relative = normalized.match(/(\d+)\s*(minute|hour|day|week|month|year|dakika|saat|gun|hafta|ay|yil)/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const days =
      unit.startsWith("minute") || unit === "dakika"
        ? amount / 1440
        : unit.startsWith("hour") || unit === "saat"
          ? amount / 24
          : unit.startsWith("week") || unit === "hafta"
            ? amount * 7
            : unit.startsWith("month") || unit === "ay"
              ? amount * 30
              : unit.startsWith("year") || unit === "yil"
                ? amount * 365
                : amount;
    const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { date, ageDays: days };
  }

  if (normalized.includes("yesterday") || normalized.includes("dun")) {
    const date = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return { date, ageDays: 1 };
  }

  const parsed = new Date(value);
  if (Number.isFinite(parsed.getTime())) {
    return {
      date: parsed,
      ageDays: Math.max(0, (now.getTime() - parsed.getTime()) / (24 * 60 * 60 * 1000)),
    };
  }

  return { date: null, ageDays: null };
}

function normalizeSummary(value: string | undefined) {
  const summary = value?.trim() || "No summary available from the live feed.";
  return summary.length > 190 ? `${summary.slice(0, 187).trim()}...` : summary;
}

function titleSimilarity(left: string, right: string) {
  const leftTokens = titleTokens(left);
  const rightTokens = titleTokens(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  return overlap / Math.min(leftTokens.length, rightTokens.length);
}

function titleTokens(value: string) {
  const stopWords = new Set([
    "son",
    "dakika",
    "haberi",
    "haber",
    "turkiye",
    "bugun",
    "icin",
    "olan",
    "ile",
    "the",
    "and",
    "for",
  ]);

  return normalizeForScoring(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function sanitizeThumbnail(value: string | undefined) {
  if (!value) return null;
  const lowered = value.toLowerCase();
  if (
    lowered.includes("encrypted-tbn") ||
    lowered.includes("gstatic.com") ||
    lowered.includes("googleusercontent.com")
  ) {
    return null;
  }
  return value;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeForScoring(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function slugify(value: string) {
  return normalizeForScoring(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
}

function readDomain(value: string) {
  try {
    return normalizeDomain(new URL(value).hostname);
  } catch {
    return "";
  }
}

function readXHandle(record: SourceRegistryRecord) {
  const notesHandle = record.notes.match(/Handle:\s*@?([a-zA-Z0-9_]+)/)?.[1];
  if (notesHandle) return notesHandle.toLowerCase();

  const domainHandle = record.domains
    .map((domain) => domain.match(/(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]+)/)?.[1])
    .find(Boolean);
  if (domainHandle) return domainHandle.toLowerCase();

  const knownHandles: Record<string, string> = {
    "asayis berkemal": "asayisberkemal0",
  };
  const normalizedName = normalizeForScoring(record.name);
  return knownHandles[normalizedName] ?? "";
}

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}
