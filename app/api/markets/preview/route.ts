import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonObject = Record<string, unknown>;

type MarketPreview = {
  id: string;
  venue: "Polymarket";
  question: string;
  category: string;
  volume: string;
  liquidity: string;
  endDate: string;
  probability: number | null;
  priceLabel?: string;
  imageUrl: string | null;
  originalUrl: string;
  marketSlug?: string;
  conditionId?: string;
  tokenIds?: string[];
  outcomeSummary?: string;
};

type PreviewMetadata = {
  question?: string;
  category?: string;
  volume?: string;
  liquidity?: string;
  endDate?: string;
  probability?: number | null;
  priceLabel?: string;
  imageUrl: string | null;
  marketSlug?: string;
  conditionId?: string;
  tokenIds?: string[];
  outcomeSummary?: string;
};

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url")?.trim();
  if (!rawUrl) {
    return NextResponse.json({ status: "error", message: "Missing market URL." }, { status: 400 });
  }

  const parsed = parseMarketUrl(rawUrl);
  if (!parsed) {
    return NextResponse.json({ status: "error", message: "Unsupported market URL." }, { status: 400 });
  }

  const metadata = await readPolymarketPreview(parsed.slug, rawUrl, parsed.marketSlug);
  const marketKey = metadata.marketSlug ?? parsed.marketSlug ?? parsed.slug ?? stableId(rawUrl);

  const market = {
    id: `linked-${parsed.venue.toLowerCase()}-${marketKey}`,
    venue: parsed.venue,
    question: cleanQuestion(metadata.question, parsed.slug),
    category: metadata.category ?? "Linked market",
    volume: metadata.volume ?? "Linked market",
    liquidity: metadata.liquidity ?? "Manual analysis",
    endDate: metadata.endDate ?? "Open",
    probability: metadata.probability ?? null,
    priceLabel:
      metadata.priceLabel ??
      (parsed.venue === "Polymarket" ? formatPolymarketPrice(metadata.probability ?? null) : undefined),
    imageUrl: metadata.imageUrl ?? null,
    originalUrl: rawUrl,
    marketSlug: metadata.marketSlug ?? parsed.marketSlug ?? parsed.slug,
    conditionId: metadata.conditionId,
    tokenIds: metadata.tokenIds,
    outcomeSummary: metadata.outcomeSummary,
  } satisfies MarketPreview;

  return NextResponse.json(
    {
      status: metadata.imageUrl || metadata.question ? "ok" : "fallback",
      market,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function parseMarketUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1]?.toLowerCase().replace(/[^a-z0-9-]+/g, "-") ?? "";
    const marketSlug = normalizeSlug(url.searchParams.get("marketSlug"));

    if (host.includes("polymarket.com")) {
      return { venue: "Polymarket" as const, slug, marketSlug };
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeSlug(value: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || null;
}

async function readPolymarketPreview(
  slug: string,
  originalUrl: string,
  selectedMarketSlug?: string | null,
): Promise<PreviewMetadata> {
  const eventRecords = await fetchJsonArray(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`);
  const event = eventRecords[0];
  if (event) {
    return normalizePreviewRecord(event, "Polymarket", slug, selectedMarketSlug);
  }

  const marketRecords = await fetchJsonArray(
    `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(selectedMarketSlug ?? slug)}`,
  );
  const market = marketRecords[0];
  if (market) {
    return normalizePreviewRecord(market, "Polymarket", selectedMarketSlug ?? slug);
  }

  return readHtmlPreview(originalUrl, "Polymarket", slug);
}

async function fetchJsonArray(url: string) {
  const response = await timedFetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!response?.ok) return [];

  const payload = (await response.json()) as unknown;
  if (Array.isArray(payload)) return payload.filter(isObject);
  if (isObject(payload) && Array.isArray(payload.data)) return payload.data.filter(isObject);
  return [];
}

async function readHtmlPreview(
  url: string,
  venue: MarketPreview["venue"],
  slug: string,
): Promise<PreviewMetadata> {
  const response = await timedFetch(url, {
    headers: {
      Accept: "text/html",
    },
  });
  if (!response?.ok) {
    return {
      question: titleFromSlug(slug || "Linked prediction market"),
      category: "Linked market",
      imageUrl: null,
    };
  }

  const html = await response.text();
  return {
    question: readMeta(html, "og:title") ?? readTitle(html) ?? titleFromSlug(slug),
    category: "Linked market",
    imageUrl: readMeta(html, "og:image") ?? readMeta(html, "twitter:image"),
  };
}

async function timedFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizePreviewRecord(
  record: JsonObject,
  venue: MarketPreview["venue"],
  slug = "",
  selectedMarketSlug?: string | null,
) {
  const eventMarkets = readActiveMarkets(record);
  const selectedMarket = selectedMarketSlug
    ? eventMarkets.find((market) =>
        ["slug", "market_slug"].some((key) => firstString(market, [key])?.toLowerCase() === selectedMarketSlug),
      )
    : null;

  if (selectedMarket) {
    return normalizePreviewRecord(
      {
        ...record,
        ...selectedMarket,
        markets: undefined,
        image:
          firstString(selectedMarket, ["image", "imageUrl", "image_url", "icon", "thumbnail"]) ??
          firstString(record, ["image", "imageUrl", "image_url", "icon", "thumbnail"]),
      },
      venue,
      selectedMarketSlug ?? slug,
    );
  }

  if (eventMarkets.length > 1) {
    const outcomes = eventMarkets
      .map(normalizeOutcomePreview)
      .sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    const topOutcomes = outcomes.slice(0, 12);
    const question =
      firstString(record, ["title", "question", "eventTitle", "event_title", "slug"]) ??
      titleFromSlug(slug);

    return {
      question,
      category: "Polymarket event",
      volume: formatCurrencyLike(firstPresent(record, ["volume", "volumeNum", "volume24hr", "total_volume_usd"])),
      liquidity: formatCurrencyLike(firstPresent(record, ["liquidity", "liquidityNum", "liquidity_usd"])),
      endDate:
        firstString(record, ["endDate", "endDateIso", "endDateTime", "resolutionDate", "end_time", "close_time"]) ??
        inferQuestionDate(question),
      probability: null,
      priceLabel: `${outcomes.length} outcomes`,
      imageUrl: firstString(record, ["image", "imageUrl", "image_url", "icon", "thumbnail"]) ?? null,
      marketSlug: selectedMarketSlug ?? slug,
      conditionId: undefined,
      tokenIds: undefined,
      outcomeSummary: topOutcomes
        .map((item, index) => `${index + 1}. ${item.label}: ${item.priceLabel ?? "n/a"}${item.volume ? `, vol ${item.volume}` : ""}`)
        .join("; "),
    };
  }

  const primaryMarket = readPrimaryMarket(record, selectedMarketSlug ?? slug);
  const pricingRecord = primaryMarket ?? record;
  const question =
    (primaryMarket
      ? firstString(primaryMarket, ["question", "title", "market_slug", "slug"])
      : null) ??
    firstString(record, ["title", "question", "eventTitle", "event_title", "description", "slug"]) ??
    undefined;
  const rawEndDate =
    firstString(pricingRecord, ["endDate", "endDateIso", "endDateTime", "resolutionDate", "end_time", "close_time"]) ??
    undefined;

  const probability = readProbability(pricingRecord);

  return {
    question,
    category: "Linked market",
    volume: formatCurrencyLike(firstPresent(record, ["volume", "volumeNum", "volume24hr", "total_volume_usd"])),
    liquidity: formatCurrencyLike(
      firstPresent(record, ["liquidity", "liquidityNum", "liquidity_usd"]) ??
        (primaryMarket ? firstPresent(primaryMarket, ["liquidity", "liquidityNum", "liquidity_usd"]) : null),
    ),
    endDate: inferQuestionDate(question) ?? rawEndDate,
    probability,
    priceLabel: readPriceLabel(pricingRecord, probability),
    imageUrl:
      firstString(record, ["image", "imageUrl", "image_url", "icon", "thumbnail"]) ??
      (primaryMarket ? firstString(primaryMarket, ["image", "imageUrl", "image_url", "icon", "thumbnail"]) : null) ??
      null,
    marketSlug: firstString(pricingRecord, ["slug", "market_slug"]) ?? selectedMarketSlug ?? slug,
    conditionId: firstString(pricingRecord, ["conditionId", "condition_id"]) ?? undefined,
    tokenIds: readTokenIds(pricingRecord),
  };
}

function readActiveMarkets(record: JsonObject) {
  const markets = record.markets;
  if (!Array.isArray(markets)) return [];

  return markets
    .filter(isObject)
    .filter((market) => market.closed !== true && market.acceptingOrders !== false);
}

function normalizeOutcomePreview(record: JsonObject) {
  const label =
    firstString(record, ["groupItemTitle", "outcome", "question", "title", "slug", "market_slug"]) ??
    "Unnamed outcome";
  const price = readProbability(record);

  return {
    label: cleanOutcomeLabel(label),
    price,
    priceLabel: readPriceLabel(record, price),
    volume: formatCurrencyLike(firstPresent(record, ["volume", "volumeNum", "volume24hr", "total_volume_usd"])),
  };
}

function cleanOutcomeLabel(value: string) {
  return value
    .replace(/^will\s+/i, "")
    .replace(/\s+win(s)?\s+the\s+2028\s+republican\s+presidential\s+nomination\??$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readTokenIds(record: JsonObject) {
  const raw = firstPresent(record, ["clobTokenIds", "tokenIds", "token_id"]);
  if (Array.isArray(raw)) return raw.map(stringify).filter((item): item is string => Boolean(item));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(stringify).filter((item): item is string => Boolean(item));
    } catch {
      return raw ? [raw] : undefined;
    }
  }

  return undefined;
}

function inferQuestionDate(question: string | undefined) {
  const match = question?.match(/\bby\s+([A-Z][a-z]+)\s+(\d{1,2})\b/);
  return match ? `${match[1]} ${match[2]}` : undefined;
}

function readPrimaryMarket(record: JsonObject, slug = "") {
  const markets = record.markets;
  if (!Array.isArray(markets)) return null;

  const objects = markets.filter(isObject);
  const normalizedSlug = slug.toLowerCase();
  const exactMatch = objects.find((market) =>
    ["slug", "market_slug"].some((key) => firstString(market, [key])?.toLowerCase() === normalizedSlug),
  );

  return (
    (exactMatch && exactMatch.closed !== true && exactMatch.acceptingOrders !== false ? exactMatch : null) ??
    objects.find((market) => market.closed !== true && market.acceptingOrders !== false) ??
    objects.find((market) => market.active === true && market.closed !== true) ??
    (exactMatch ?? null) ??
    objects[0] ??
    null
  );
}

function readProbability(record: JsonObject) {
  const direct = firstPresent(record, ["lastTradePrice", "bestAsk", "bestBid", "price", "probability"]);
  const directNumber = toNumber(direct);
  if (directNumber !== null) return normalizeProbability(directNumber);

  const outcomePrices = record.outcomePrices;
  if (Array.isArray(outcomePrices)) {
    return normalizeProbability(toNumber(outcomePrices[0]));
  }

  if (typeof outcomePrices === "string") {
    try {
      const parsed = JSON.parse(outcomePrices) as unknown;
      if (Array.isArray(parsed)) return normalizeProbability(toNumber(parsed[0]));
    } catch {
      return null;
    }
  }

  return null;
}

function readPriceLabel(record: JsonObject, probability: number | null) {
  const direct = firstPresent(record, ["lastTradePrice", "bestAsk", "bestBid", "price"]);
  const directNumber = toNumber(direct);
  if (directNumber !== null) return formatPolymarketPrice(normalizeProbability(directNumber));

  const outcomePrices = record.outcomePrices;
  if (Array.isArray(outcomePrices)) {
    return formatPolymarketPrice(normalizeProbability(toNumber(outcomePrices[0])));
  }

  if (typeof outcomePrices === "string") {
    try {
      const parsed = JSON.parse(outcomePrices) as unknown;
      if (Array.isArray(parsed)) return formatPolymarketPrice(normalizeProbability(toNumber(parsed[0])));
    } catch {
      return formatPolymarketPrice(probability);
    }
  }

  return formatPolymarketPrice(probability);
}

function readMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    if (match) return decodeHtml(match);
  }

  return null;
}

function readTitle(html: string) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  return title ? decodeHtml(title) : null;
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

function formatCurrencyLike(value: unknown) {
  const asString = stringify(value);
  if (!asString) return undefined;
  if (asString.startsWith("$")) return asString;

  const numeric = toNumber(asString);
  if (numeric === null) return asString;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "USD",
  }).format(numeric);
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeProbability(value: number | null) {
  if (value === null) return null;
  const normalized = value > 1 ? value / 100 : value;
  if (normalized < 0 || normalized > 1) return null;
  return normalized;
}

function formatPolymarketPrice(value: number | null) {
  if (value === null) return undefined;
  return `${Math.round(value * 100)}¢`;
}

function titleFromSlug(value: string) {
  const title = value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  return title || "Linked prediction market";
}

function cleanQuestion(value: string | undefined, slug: string) {
  const question = value?.trim();
  if (!question || question.includes("...")) return titleFromSlug(slug || "Linked prediction market");
  return question;
}

function stableId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 84);
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
