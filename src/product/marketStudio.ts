import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { SourceRegistryRecord } from "@/src/product/sourceRegistry";

export type MarketStudioSourceCoverage = {
  status: "ready" | "partial" | "missing";
  matched: number;
  total: number;
  coverage: number;
  matchedSources: Array<{
    source: string;
    registryName: string;
    credibility: SourceRegistryRecord["credibility"];
    status: SourceRegistryRecord["status"];
  }>;
  missingSources: string[];
};

export type MarketStudioSpec = {
  id: string;
  title: string;
  vertical: "Turkey Macro" | "FX / Rates" | "Market Integrity" | "Legal / Political Risk";
  status: "Design-ready" | "Needs source list" | "Watch-only";
  marketQuestion: string;
  problem: string;
  demand: string;
  settlementCurrency: "USDC" | "EURC";
  settlementRail: "Arc receipt + Circle x402" | "Arc receipt + Gateway";
  oracle: {
    method: string;
    primarySource: string;
    fallbackSource: string;
    resolutionWindow: string;
  };
  primarySources: string[];
  liquidityPlan: string;
  riskPolicy: string;
  launchReadiness: number;
  sourceCoverage?: MarketStudioSourceCoverage;
};

export type MarketStudioInput = Omit<MarketStudioSpec, "id" | "launchReadiness"> & {
  id?: string;
  launchReadiness?: number;
};

const CUSTOM_MARKET_STUDIO_PATH = ".cache/studio/markets.json";

export function buildMarketStudioSpecs(): MarketStudioSpec[] {
  return [
    {
      id: "tr-cpi-surprise",
      title: "Turkey CPI Surprise",
      vertical: "Turkey Macro",
      status: "Needs source list",
      marketQuestion:
        "Will Turkey's next annual CPI print exceed the market consensus by at least 50 bps?",
      problem:
        "Local macro information moves faster than global market coverage, but prediction markets rarely expose Turkey-specific hedging instruments.",
      demand:
        "Short-duration hedging for macro traders, local analysts, exporters, importers, and rates watchers.",
      settlementCurrency: "USDC",
      settlementRail: "Arc receipt + Circle x402",
      oracle: {
        method: "Official release with pre-declared consensus snapshot.",
        primarySource: "TUIK CPI release",
        fallbackSource: "TCMB / official data mirror",
        resolutionWindow: "Same day as official CPI publication",
      },
      primarySources: ["tuik.gov.tr", "tcmb.gov.tr", "hmb.gov.tr", "foreks.com"],
      liquidityPlan: "Seed around monthly CPI windows; cap first market exposure until oracle dry-run passes.",
      riskPolicy:
        "Manual approval only; block execution if official source confirmation is missing or release wording changes.",
      launchReadiness: 0.68,
    },
    {
      id: "usdtry-vol-window",
      title: "USD/TRY Volatility Window",
      vertical: "FX / Rates",
      status: "Design-ready",
      marketQuestion:
        "Will USD/TRY move more than 2.5% within 24 hours of the next TCMB rate decision?",
      problem:
        "Existing derivatives are too heavy for small hedgers and event-driven prediction exposure.",
      demand:
        "Event-risk hedge for local businesses, treasury desks, and macro communities following TCMB decisions.",
      settlementCurrency: "USDC",
      settlementRail: "Arc receipt + Gateway",
      oracle: {
        method: "Reference FX print plus TCMB decision timestamp.",
        primarySource: "TCMB policy announcement",
        fallbackSource: "Official FX reference feed",
        resolutionWindow: "24 hours after decision timestamp",
      },
      primarySources: ["tcmb.gov.tr", "resmigazete.gov.tr", "bloomberght.com"],
      liquidityPlan: "Start with binary volatility markets before directional markets to reduce manipulation risk.",
      riskPolicy:
        "No autonomous intent if liquidity is thin or price feed divergence exceeds configured threshold.",
      launchReadiness: 0.74,
    },
    {
      id: "competition-integrity-watch",
      title: "Competition Integrity Watch",
      vertical: "Market Integrity",
      status: "Watch-only",
      marketQuestion:
        "Should this competition market be paused for integrity review before event start?",
      problem:
        "Thin sports, esports, and other competition markets can show suspicious pre-event flow before public information catches up.",
      demand:
        "Integrity tooling for market operators, bettors, communities, and analysts watching low-liquidity competition events.",
      settlementCurrency: "USDC",
      settlementRail: "Arc receipt + Circle x402",
      oracle: {
        method: "Pre-event flow anomaly record plus official event result.",
        primarySource: "Paid trade-flow scan",
        fallbackSource: "Official event page and operator review",
        resolutionWindow: "Before scheduled event start",
      },
      primarySources: ["polymarket trades", "official event feed", "community reports"],
      liquidityPlan: "Do not seed directly; provide risk alerts and operator-facing pause recommendations first.",
      riskPolicy:
        "Watch mode by default; block bet intents when wallet concentration and one-sided flow are both elevated.",
      launchReadiness: 0.61,
    },
    {
      id: "tr-public-figure-legal-outcome",
      title: "Turkey Public-Figure Legal Outcome",
      vertical: "Legal / Political Risk",
      status: "Needs source list",
      marketQuestion:
        "Will a named public figure receive a court conviction or formal sentence before a specified date?",
      problem:
        "Turkey news cycles create intense demand around legal and political accountability, but most potential markets lack clean resolution wording and source discipline.",
      demand:
        "Local politics communities, media watchers, legal analysts, and event-driven traders want structured exposure to high-attention legal outcomes.",
      settlementCurrency: "USDC",
      settlementRail: "Arc receipt + Circle x402",
      oracle: {
        method:
          "Official court/prosecutor record first; credible wire-service reporting only as fallback when official records are inaccessible.",
        primarySource: "UYAP / courthouse / prosecutor announcements / official court records",
        fallbackSource: "AA, Bianet, Diken, Medyascope, Reuters-style credible reporting",
        resolutionWindow: "Named deadline and appeal/sentence status must be pre-declared",
      },
      primarySources: [
        "adliyeler",
        "resmigazete.gov.tr",
        "aa.com.tr",
        "bianet.org",
        "diken.com.tr",
        "medyascope.tv",
      ],
      liquidityPlan:
        "Start as watch-only market proposal. Do not launch from social outrage alone; require clear public-interest threshold and precise legal milestone.",
      riskPolicy:
        "Block markets that rely on harassment, private-person claims, unsupported political proximity, or vague wording like 'will go to jail' without formal legal criteria.",
      launchReadiness: 0.49,
    },
  ];
}

export async function readMarketStudioSpecs(path = CUSTOM_MARKET_STUDIO_PATH) {
  const custom = await readCustomMarketStudioSpecs(path);
  return [...buildMarketStudioSpecs(), ...custom];
}

export function attachMarketStudioSourceCoverage(
  specs: MarketStudioSpec[],
  sourceRegistry: SourceRegistryRecord[],
) {
  return specs.map((spec) => ({
    ...spec,
    sourceCoverage: scoreMarketStudioSourceCoverage(spec, sourceRegistry),
  }));
}

export function scoreMarketStudioSourceCoverage(
  spec: MarketStudioSpec,
  sourceRegistry: SourceRegistryRecord[],
): MarketStudioSourceCoverage {
  const sources = spec.primarySources.map(normalizeLookupSource).filter(Boolean);
  const matches = sources.map((source) => ({
    source,
    record: findSourceRegistryMatch(source, sourceRegistry),
  }));
  const matchedSources = matches
    .filter((match): match is { source: string; record: SourceRegistryRecord } => match.record !== null)
    .map((match) => ({
      source: match.source,
      registryName: match.record.name,
      credibility: match.record.credibility,
      status: match.record.status,
    }));
  const missingSources = matches
    .filter((match) => match.record === null)
    .map((match) => match.source);
  const coverage = sources.length > 0 ? matchedSources.length / sources.length : 0;

  return {
    status:
      sources.length === 0 || coverage === 0
        ? "missing"
        : coverage >= 0.75
          ? "ready"
          : "partial",
    matched: matchedSources.length,
    total: sources.length,
    coverage,
    matchedSources,
    missingSources,
  };
}

export async function readCustomMarketStudioSpecs(path = CUSTOM_MARKET_STUDIO_PATH) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as { specs?: unknown };

    return Array.isArray(parsed.specs)
      ? parsed.specs.filter(isMarketStudioSpec)
      : [];
  } catch {
    return [];
  }
}

export async function appendMarketStudioSpec(
  input: MarketStudioInput,
  path = CUSTOM_MARKET_STUDIO_PATH,
) {
  const current = await readCustomMarketStudioSpecs(path);
  const spec = normalizeMarketStudioInput(input);
  const next = [
    spec,
    ...current.filter((item) => item.id !== spec.id && item.title !== spec.title),
  ].slice(0, 100);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        specs: next,
      },
      null,
      2,
    )}\n`,
  );

  return next;
}

export function normalizeMarketStudioInput(input: MarketStudioInput): MarketStudioSpec {
  const id =
    input.id?.trim() ||
    `${input.vertical}-${input.title}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  return {
    id,
    title: input.title.trim(),
    vertical: input.vertical,
    status: input.status,
    marketQuestion: input.marketQuestion.trim(),
    problem: input.problem.trim(),
    demand: input.demand.trim(),
    settlementCurrency: input.settlementCurrency,
    settlementRail: input.settlementRail,
    oracle: {
      method: input.oracle.method.trim(),
      primarySource: input.oracle.primarySource.trim(),
      fallbackSource: input.oracle.fallbackSource.trim(),
      resolutionWindow: input.oracle.resolutionWindow.trim(),
    },
    primarySources: input.primarySources.map(normalizeSource).filter(Boolean),
    liquidityPlan: input.liquidityPlan.trim(),
    riskPolicy: input.riskPolicy.trim(),
    launchReadiness:
      typeof input.launchReadiness === "number" && Number.isFinite(input.launchReadiness)
        ? clamp(input.launchReadiness, 0.05, 0.98)
        : readDefaultReadiness(input.status),
  };
}

export function summarizeMarketStudio(specs: MarketStudioSpec[]) {
  const designReady = specs.filter((spec) => spec.status === "Design-ready").length;
  const sourceReady = specs.filter((spec) => spec.sourceCoverage?.status === "ready").length;
  const averageReadiness =
    specs.reduce((sum, spec) => sum + spec.launchReadiness, 0) / Math.max(1, specs.length);

  return {
    specs: specs.length,
    designReady,
    sourceReady,
    averageReadiness,
    settlementCurrencies: [...new Set(specs.map((spec) => spec.settlementCurrency))],
  };
}

function readDefaultReadiness(status: MarketStudioSpec["status"]) {
  if (status === "Design-ready") return 0.72;
  if (status === "Needs source list") return 0.54;
  return 0.42;
}

function normalizeSource(value: string) {
  return value.trim();
}

function findSourceRegistryMatch(source: string, sourceRegistry: SourceRegistryRecord[]) {
  const normalized = normalizeLookupSource(source);
  if (!normalized) return null;

  return (
    sourceRegistry.find((record) => {
      const recordName = normalizeLookupSource(record.name);
      const coverage = normalizeLookupSource(record.coverage);
      const role = normalizeLookupSource(record.role);
      const notes = normalizeLookupSource(record.notes);
      return (
        recordName === normalized ||
        textMatchesLookupSource(recordName, normalized) ||
        normalized.includes(recordName) ||
        textMatchesLookupSource(coverage, normalized) ||
        textMatchesLookupSource(role, normalized) ||
        textMatchesLookupSource(notes, normalized) ||
        record.domains.some((domain) => sourceMatchesRegistryDomain(normalized, domain))
      );
    }) ?? null
  );
}

function sourceMatchesRegistryDomain(source: string, domain: string) {
  const normalizedDomain = normalizeLookupSource(domain);
  return (
    normalizedDomain.length > 0 &&
    (source === normalizedDomain ||
      source.endsWith(`.${normalizedDomain}`) ||
      normalizedDomain.includes(source) ||
      source.includes(normalizedDomain))
  );
}

function normalizeLookupSource(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function textMatchesLookupSource(text: string, source: string) {
  if (!text || !source) return false;
  if (text.includes(source)) return true;

  const tokens = source.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  return tokens.length > 0 && tokens.every((token) => text.includes(token));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isMarketStudioSpec(value: unknown): value is MarketStudioSpec {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const spec = value as Record<string, unknown>;

  return (
    typeof spec.id === "string" &&
    typeof spec.title === "string" &&
    typeof spec.vertical === "string" &&
    typeof spec.status === "string" &&
    typeof spec.marketQuestion === "string" &&
    typeof spec.oracle === "object" &&
    spec.oracle !== null &&
    Array.isArray(spec.primarySources) &&
    typeof spec.launchReadiness === "number"
  );
}
