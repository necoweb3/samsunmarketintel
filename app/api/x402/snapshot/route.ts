import { readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_MARKET_CACHE = ".cache/x402/latest-polymarket-markets.json";

type JsonObject = Record<string, unknown>;

type SnapshotMarket = {
  id: string;
  question: string;
  price: string;
  volume: string;
  liquidity: string;
  category: string;
  status: string;
  endDate: string;
  imageUrl: string | null;
};

type SnapshotPayment = {
  amount: string | null;
  chain: string | null;
  scheme: string | null;
  seller: string | null;
};

export async function GET() {
  try {
    const [raw, fileStat] = await Promise.all([
      readFile(DEFAULT_MARKET_CACHE, "utf8"),
      stat(DEFAULT_MARKET_CACHE),
    ]);
    const payload = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
    const markets = extractMarkets(payload)
      .map(normalizeMarket)
      .filter((market): market is SnapshotMarket => market !== null)
      .filter(isDisplayableMarket)
      .slice(0, 50);

    return NextResponse.json(
      {
        status: "ok",
        source: "x402-cache",
        count: markets.length,
        markets,
        payment: extractPayment(payload),
        updatedAt: fileStat.mtime.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "empty",
        source: "x402-cache",
        count: 0,
        markets: [],
        payment: null,
        updatedAt: null,
        message:
          error instanceof Error
            ? error.message
            : "No paid x402 market snapshot has been cached yet.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
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

function normalizeMarket(value: unknown, index: number): SnapshotMarket | null {
  if (!isObject(value)) return null;

  const question = firstString(value, [
    "question",
    "title",
    "description",
    "market",
    "slug",
  ]);

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
      ]) ??
      `paid-market-${index + 1}`,
    question,
    price: formatProbability(readProbability(value)),
    volume: formatCurrencyLike(
      firstPresent(value, ["volume", "volumeNum", "volume24hr", "total_volume_usd"]),
    ),
    liquidity: formatCurrencyLike(
      firstPresent(value, ["liquidity", "liquidityNum", "liquidity_usd"]),
    ),
    category:
      firstString(value, ["category", "eventTitle", "event_title", "eventSlug", "event_slug"]) ??
      "Polymarket",
    status: readStatus(value),
    endDate: firstString(value, [
      "endDate",
      "endDateIso",
      "endDateTime",
      "resolutionDate",
      "end_time",
      "close_time",
    ]) ?? "open",
    imageUrl: firstString(value, ["image_url", "imageUrl", "image", "icon", "thumbnail"]) ?? null,
  };
}

function extractPayment(payload: unknown): SnapshotPayment | null {
  const payment = getPath(payload, ["data", "payment"]) ?? getPath(payload, ["payment"]);
  if (!isObject(payment)) return null;

  return {
    amount: stringify(firstPresent(payment, ["amount", "price", "maxAmount"])),
    chain: stringify(firstPresent(payment, ["chain", "network"])),
    scheme: stringify(firstPresent(payment, ["scheme", "paymentScheme"])),
    seller: stringify(firstPresent(payment, ["seller", "payTo", "recipient"])),
  };
}

function readProbability(value: JsonObject) {
  const direct = firstPresent(value, [
    "price",
    "probability",
    "lastTradePrice",
    "bestAsk",
    "bestBid",
  ]);
  const directNumber = toNumber(direct);
  if (directNumber !== null) return directNumber;

  const outcomePrices = value.outcomePrices;
  if (Array.isArray(outcomePrices)) {
    return toNumber(outcomePrices[0]);
  }

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
    const yesOutcome = outcomes.find((outcome) => {
      if (!isObject(outcome)) return false;
      return String(outcome.label ?? "").toLowerCase() === "yes";
    });

    if (isObject(yesOutcome)) {
      const price = toNumber(yesOutcome.price);
      if (price !== null) return price;
    }

    const firstOutcome = outcomes[0];
    if (isObject(firstOutcome)) {
      return toNumber(firstOutcome.price);
    }
  }

  return null;
}

function readStatus(value: JsonObject) {
  if (value.closed === true) return "closed";
  if (value.active === false) return "inactive";
  return firstString(value, ["status"]) ?? "active";
}

function isDisplayableMarket(market: SnapshotMarket) {
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

function formatProbability(value: number | null) {
  if (value === null) return "n/a";
  const normalized = value > 1 ? value / 100 : value;
  return `${Math.round(normalized * 100)}%`;
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
    if (current !== undefined && current !== null && current !== "") {
      return current;
    }
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
