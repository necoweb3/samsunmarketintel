import { readFile, stat } from "node:fs/promises";

import type { DashboardInitialData } from "@/src/components/dashboard";
import { evaluateAgentPolicy } from "@/src/product/agentPolicy";
import { readAgentRunLedger } from "@/src/product/agentRunLedger";
import { buildCurrentDemoReviewPack } from "@/src/product/demoReviewState";
import { readIntentLedger } from "@/src/product/intentLedger";
import { buildIntegritySnapshot } from "@/src/product/integrityAnalysis";
import {
  attachMarketStudioSourceCoverage,
  readMarketStudioSpecs,
  summarizeMarketStudio,
} from "@/src/product/marketStudio";
import { buildProductReadiness } from "@/src/product/productReadiness";
import { buildResearchSnapshot } from "@/src/product/researchAnalysis";
import { readSentientResearchConfig } from "@/src/product/sentientResearchConfig";
import { readSourceRegistry, summarizeSourceRegistry } from "@/src/product/sourceRegistry";

const MARKET_CACHE = ".cache/x402/latest-polymarket-markets.json";
const TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";
const RESEARCH_CACHE = ".cache/x402/latest-research-search.json";
const INTENT_RECEIPT_CACHE = ".cache/arc/latest-intent-receipt.json";

type JsonObject = Record<string, unknown>;

export async function getDashboardInitialData(): Promise<DashboardInitialData> {
  const sourceRegistry = await readSourceRegistry().catch(() => []);

  const [
    x402Snapshot,
    integrityState,
    researchState,
    marketStudioState,
    productReadinessState,
    agentRunLedgerState,
    intentLedgerState,
    recordedIntentReceiptState,
    reviewPackState,
  ] = await Promise.all([
    readInitialX402Snapshot(),
    readInitialIntegrityState(),
    readInitialResearchState(sourceRegistry),
    readInitialMarketStudioState(sourceRegistry),
    buildProductReadiness().catch(() => undefined),
    readAgentRunLedger().catch(() => undefined),
    readIntentLedger().catch(() => undefined),
    readInitialIntentReceipt(),
    buildCurrentDemoReviewPack()
      .then((pack) => ({ status: "ok", pack }))
      .catch(() => undefined),
  ]);

  return {
    x402Snapshot,
    integrityState,
    researchState,
    sentientResearchConfig: readSentientResearchConfig(),
    productReadinessState,
    agentRunLedgerState: agentRunLedgerState
      ? {
          status: "ok",
          ...agentRunLedgerState,
        }
      : undefined,
    intentLedgerState: intentLedgerState
      ? {
          status: "ok",
          ...intentLedgerState,
        }
      : undefined,
    agentPolicyState: intentLedgerState
      ? {
          status: "ok",
          evaluation: evaluateAgentPolicy(intentLedgerState.intents),
        }
      : undefined,
    recordedIntentReceiptState,
    reviewPackState,
    marketStudioState,
    sourceRegistryState: {
      status: sourceRegistry.length > 0 ? "ok" : "empty",
      records: sourceRegistry,
      summary: summarizeSourceRegistry(sourceRegistry),
    } as DashboardInitialData["sourceRegistryState"],
  };
}

async function readInitialIntentReceipt(): Promise<DashboardInitialData["recordedIntentReceiptState"]> {
  try {
    const [raw, fileStat] = await Promise.all([
      readFile(INTENT_RECEIPT_CACHE, "utf8"),
      stat(INTENT_RECEIPT_CACHE),
    ]);

    return {
      status: "ok",
      receipt: JSON.parse(raw.replace(/^\uFEFF/, "")) as NonNullable<
        DashboardInitialData["recordedIntentReceiptState"]
      >["receipt"],
      updatedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return undefined;
  }
}

async function readInitialX402Snapshot(): Promise<DashboardInitialData["x402Snapshot"]> {
  try {
    const [raw, fileStat] = await Promise.all([readFile(MARKET_CACHE, "utf8"), stat(MARKET_CACHE)]);
    const payload = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
    const markets = extractMarkets(payload)
      .map(normalizeMarket)
      .filter((market): market is NonNullable<DashboardInitialData["x402Snapshot"]>["markets"][number] => market !== null)
      .filter(isDisplayableMarket)
      .slice(0, 50);

    return {
      status: "ok",
      count: markets.length,
      markets,
      updatedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return undefined;
  }
}

async function readInitialIntegrityState(): Promise<DashboardInitialData["integrityState"]> {
  try {
    const [raw, fileStat] = await Promise.all([readFile(TRADES_CACHE, "utf8"), stat(TRADES_CACHE)]);
    const payload = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
    const snapshot = buildIntegritySnapshot(payload);

    return {
      status: "ok",
      trades: snapshot.trades.length,
      alerts: snapshot.alerts.slice(0, 15),
      updatedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return undefined;
  }
}

async function readInitialResearchState(
  sourceRegistry: Awaited<ReturnType<typeof readSourceRegistry>>,
): Promise<DashboardInitialData["researchState"]> {
  try {
    const [raw, fileStat] = await Promise.all([readFile(RESEARCH_CACHE, "utf8"), stat(RESEARCH_CACHE)]);
    const payload = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;

    return {
      status: "ok",
      snapshot: buildResearchSnapshot(payload, { sourceRegistry }),
      updatedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return undefined;
  }
}

async function readInitialMarketStudioState(
  sourceRegistry: Awaited<ReturnType<typeof readSourceRegistry>>,
): Promise<DashboardInitialData["marketStudioState"]> {
  try {
    const specs = attachMarketStudioSourceCoverage(await readMarketStudioSpecs(), sourceRegistry);

    return {
      status: "ok",
      specs,
      summary: summarizeMarketStudio(specs),
    } as DashboardInitialData["marketStudioState"];
  } catch {
    return undefined;
  }
}

function extractMarkets(payload: unknown): unknown[] {
  const candidates = [
    getPath(payload, ["data", "response", "markets"]),
    getPath(payload, ["data", "response", "data", "markets"]),
    getPath(payload, ["data", "markets"]),
    getPath(payload, ["response", "markets"]),
    getPath(payload, ["markets"]),
  ];

  return candidates.find(Array.isArray) ?? [];
}

function normalizeMarket(value: unknown, index: number) {
  if (!isObject(value)) return null;

  const question = firstString(value, ["question", "title", "description", "market", "slug"]);
  if (!question) return null;

  return {
    id:
      firstString(value, [
        "market_slug",
        "slug",
        "event_slug",
        "id",
        "conditionId",
        "condition_id",
        "marketId",
        "market_id",
      ]) ?? `paid-market-${index + 1}`,
    question,
    price: formatProbability(readProbability(value)),
    volume: formatCurrencyLike(
      firstPresent(value, ["volume", "volumeNum", "volume24hr", "total_volume_usd"]),
    ),
    liquidity: formatCurrencyLike(firstPresent(value, ["liquidity", "liquidityNum", "liquidity_usd"])),
    category:
      firstString(value, ["category", "eventTitle", "event_title", "eventSlug", "event_slug"]) ??
      "Polymarket",
    status: value.closed === true ? "closed" : value.active === false ? "inactive" : firstString(value, ["status"]) ?? "active",
    endDate:
      firstString(value, ["endDate", "endDateIso", "endDateTime", "resolutionDate", "end_time", "close_time"]) ??
      "open",
    imageUrl: firstString(value, ["image_url", "imageUrl", "image", "icon", "thumbnail"]) ?? null,
  };
}

function readProbability(value: JsonObject) {
  const direct = firstPresent(value, ["price", "probability", "lastTradePrice", "bestAsk", "bestBid"]);
  const directNumber = toNumber(direct);
  if (directNumber !== null) return directNumber;

  const outcomePrices = value.outcomePrices;
  if (Array.isArray(outcomePrices)) return toNumber(outcomePrices[0]);

  if (typeof outcomePrices === "string") {
    try {
      const parsed = JSON.parse(outcomePrices) as unknown;
      if (Array.isArray(parsed)) return toNumber(parsed[0]);
    } catch {
      return null;
    }
  }

  const outcomes = value.outcomes;
  if (Array.isArray(outcomes)) {
    const firstOutcome = outcomes[0];
    if (isObject(firstOutcome)) return toNumber(firstOutcome.price);
  }

  return null;
}

function formatProbability(value: number | null) {
  if (value === null) return "n/a";
  const normalized = value > 1 ? value / 100 : value;
  return `${Math.round(normalized * 100)}%`;
}

function isDisplayableMarket(market: NonNullable<DashboardInitialData["x402Snapshot"]>["markets"][number]) {
  const status = market.status.toLowerCase();
  if (status.includes("closed") || status.includes("inactive") || status.includes("resolved")) {
    return false;
  }

  const endTime = Date.parse(market.endDate);
  if (Number.isFinite(endTime) && endTime < Date.now()) {
    return false;
  }

  return true;
}

function formatCurrencyLike(value: unknown) {
  const asString = stringify(value);
  if (!asString) return "n/a";
  if (asString.startsWith("$")) return asString;

  const numeric = toNumber(asString);
  if (numeric === null) return asString;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "USD",
  }).format(numeric);
}

function getPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!isObject(current)) return undefined;
    return current[key];
  }, value);
}

function firstString(value: JsonObject, keys: string[]) {
  return stringify(firstPresent(value, keys));
}

function firstPresent(value: JsonObject, keys: string[]) {
  for (const key of keys) {
    const current = value[key];
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return null;
}

function stringify(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
