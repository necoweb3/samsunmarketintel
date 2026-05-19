import { execFile } from "node:child_process";
import { Buffer } from "node:buffer";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

import { resolveCircleCliPath } from "@/src/product/circleCli";

const execFileAsync = promisify(execFile);
const DEFAULT_LIVE_X402_BUDGET_USDC = 6;

export type LiveX402ServiceId =
  | "blockrun-polymarket-markets"
  | "blockrun-polymarket-trades"
  | "blockrun-polymarket-top-holders"
  | "blockrun-polymarket-orderbooks"
  | "blockrun-polymarket-candlesticks"
  | "blockrun-polymarket-smart-activity"
  | "aisa-polymarket-market-price"
  | "aisa-polymarket-orderbooks"
  | "aisa-polymarket-activity"
  | "blockrun-matching-markets"
  | "blockrun-multisource-search"
  | "aisa-polymarket-markets"
  | "exa-web-search"
  | "parallel-web-search"
  | "aisa-tavily-search"
  | "aisa-perplexity-sonar"
  | "aisa-perplexity-deep-research"
  | "aisa-twitter-advanced-search"
  | "aisa-twitter-community-search"
  | "aisa-coingecko-categories";

export type LiveX402ServiceResult = {
  id: LiveX402ServiceId;
  name: string;
  provider: "BlockRun.AI" | "AIsa API" | "Exa" | "Parallel";
  endpoint: string;
  status: "ok" | "error" | "skipped";
  maxAmountUsdc: number;
  purpose: string;
  rawText: string | null;
  summary: string;
  error?: string;
  payment?: X402PaymentRecord;
};

export type X402PaymentRecord = {
  amount: string | null;
  chain: string | null;
  scheme: string | null;
  seller: string | null;
  receiptTransaction: string | null;
  receiptNetwork: string | null;
  success: boolean | null;
  transactionHash: string | null;
  explorerUrl: string | null;
};

export type LiveX402ResearchSummary = {
  status: "ok" | "partial" | "error";
  query: string;
  maxTotalUsdc: number;
  estimatedMaxSpendUsdc: number;
  services: LiveX402ServiceResult[];
  savedTo: string | null;
  createdAt: string;
};

type LiveX402ResearchInput = {
  marketId: string;
  query: string;
  maxTotalUsdc?: number;
  env?: Record<string, string | undefined>;
};

type ServicePlan = {
  id: LiveX402ServiceId;
  name: string;
  provider: LiveX402ServiceResult["provider"];
  endpoint: string | ((query: string) => string | null);
  method: "GET" | "POST";
  maxAmountUsdc: number;
  chain?: string;
  timeoutSeconds?: number | null;
  execTimeoutMs?: number | null;
  purpose: string;
  queryParams?: (query: string) => Record<string, string | number | boolean | undefined>;
  body?: (query: string) => unknown;
};

const SERVICE_PLAN: ServicePlan[] = [
  {
    id: "blockrun-polymarket-markets",
    name: "Polymarket markets",
    provider: "BlockRun.AI",
    endpoint: "https://nano.blockrun.ai/api/v1/pm/polymarket/markets",
    method: "GET",
    maxAmountUsdc: 0.05,
    purpose: "Refresh broad Polymarket market context for discovery and comparable questions.",
  },
  {
    id: "blockrun-polymarket-trades",
    name: "Polymarket trades",
    provider: "BlockRun.AI",
    endpoint: "https://nano.blockrun.ai/api/v1/pm/polymarket/trades",
    method: "GET",
    maxAmountUsdc: 0.05,
    purpose: "Refresh trade-flow context for suspicious wallet or one-sided flow checks.",
  },
  {
    id: "blockrun-polymarket-top-holders",
    name: "Polymarket top holders",
    provider: "BlockRun.AI",
    endpoint: (query) => {
      const hash = extractConditionId(query);
      return hash ? `https://nano.blockrun.ai/api/v1/pm/polymarket/market/${hash}/top-holders` : null;
    },
    method: "GET",
    maxAmountUsdc: 0.1,
    purpose: "Fetch the largest position holders for this exact Polymarket market when a condition ID is available.",
  },
  {
    id: "blockrun-polymarket-orderbooks",
    name: "Polymarket orderbooks",
    provider: "BlockRun.AI",
    endpoint: (query) => (extractFirstTokenId(query) ? "https://nano.blockrun.ai/api/v1/pm/polymarket/orderbooks" : null),
    method: "GET",
    maxAmountUsdc: 0.05,
    purpose: "Fetch orderbook depth for the first returned Polymarket token when available.",
    queryParams: (query) => ({
      token_id: extractFirstTokenId(query) ?? undefined,
      limit: 40,
    }),
  },
  {
    id: "blockrun-polymarket-candlesticks",
    name: "Polymarket candlesticks",
    provider: "BlockRun.AI",
    endpoint: (query) => {
      const hash = extractConditionId(query);
      return hash ? `https://nano.blockrun.ai/api/v1/pm/polymarket/candlesticks/${hash}` : null;
    },
    method: "GET",
    maxAmountUsdc: 0.05,
    purpose: "Fetch historical price/volume candles for the exact market when a market hash is available.",
  },
  {
    id: "aisa-polymarket-market-price",
    name: "AIsa Polymarket market price",
    provider: "AIsa API",
    endpoint: (query) => {
      const tokenId = extractFirstTokenId(query);
      return tokenId ? `https://api.aisa.one/apis/v2/polymarket/market-price/${tokenId}` : null;
    },
    method: "GET",
    maxAmountUsdc: 0.1,
    purpose: "Fetch the most recent token-level Polymarket price for EV math cross-checking.",
  },
  {
    id: "aisa-polymarket-orderbooks",
    name: "AIsa Polymarket orderbooks",
    provider: "AIsa API",
    endpoint: (query) => (extractFirstTokenId(query) ? "https://api.aisa.one/apis/v2/polymarket/orderbooks" : null),
    method: "GET",
    maxAmountUsdc: 0.1,
    purpose: "Fetch latest token-level orderbook depth for sizing, slippage, and liquidity checks.",
    queryParams: (query) => ({
      token_id: extractFirstTokenId(query) ?? undefined,
      limit: 60,
    }),
  },
  {
    id: "blockrun-matching-markets",
    name: "Matching markets",
    provider: "BlockRun.AI",
    endpoint: "https://nano.blockrun.ai/api/v1/pm/matching-markets/pairs",
    method: "GET",
    maxAmountUsdc: 0.1,
    purpose: "Find comparable markets for cross-market pricing and arbitrage checks.",
  },
  {
    id: "blockrun-multisource-search",
    name: "BlockRun X/Web/News search",
    provider: "BlockRun.AI",
    endpoint: "https://nano.blockrun.ai/api/v1/search",
    method: "POST",
    maxAmountUsdc: 1,
    purpose: "Search X, web, and news together for market-moving evidence and sentiment.",
    body: (query) => ({
      query: `${compactSearchQuery(query)} latest news official sources social sentiment`,
      sources: ["x", "web", "news"],
      max_results: 12,
    }),
  },
  {
    id: "aisa-polymarket-markets",
    name: "AIsa Polymarket markets",
    provider: "AIsa API",
    endpoint: "https://api.aisa.one/apis/v2/polymarket/markets",
    method: "GET",
    maxAmountUsdc: 0.1,
    purpose: "Search live Polymarket listings from AIsa for price discovery and matching context.",
    queryParams: (query) => ({
      search: compactSearchQuery(query),
      status: "open",
      limit: 20,
    }),
  },
  {
    id: "parallel-web-search",
    name: "Parallel web search",
    provider: "Parallel",
    endpoint: "https://parallelmpp.dev/api/search",
    method: "POST",
    chain: "BASE",
    maxAmountUsdc: 0.2,
    purpose: "Run a second structured web search layer to reduce single-provider blind spots.",
    body: (query) => ({
      query: compactSearchQuery(query),
      objective: `Find recent, credible evidence for this prediction-market question: ${compactSearchQuery(query)}`,
      mode: "fast",
      search_queries: [
        `${compactSearchQuery(query)} latest news official source`,
        `${compactSearchQuery(query)} polling forecast odds analysis`,
      ],
    }),
  },
  {
    id: "aisa-tavily-search",
    name: "Tavily search",
    provider: "AIsa API",
    endpoint: "https://api.aisa.one/apis/v2/tavily/search",
    method: "POST",
    maxAmountUsdc: 0.2,
    purpose: "Paid news and source discovery for the exact market question.",
    body: (query) => ({
      query: `${compactSearchQuery(query)} latest news official sources`,
      topic: "news",
      time_range: "week",
      max_results: 8,
      search_depth: "basic",
      include_answer: true,
      include_usage: true,
      include_raw_content: false,
    }),
  },
  {
    id: "aisa-perplexity-sonar",
    name: "Perplexity Sonar",
    provider: "AIsa API",
    endpoint: "https://api.aisa.one/apis/v2/perplexity/sonar",
    method: "POST",
    maxAmountUsdc: 0.5,
    timeoutSeconds: 600,
    execTimeoutMs: 0,
    purpose: "Paid cited synthesis for the final research memo.",
    body: (query) => ({
      model: "sonar",
      temperature: 0.1,
      max_tokens: 5000,
      return_citations: true,
      search_context: "high",
      messages: [
        {
          role: "system",
          content:
            "You are a prediction-market research analyst. Return evidence, citations, source quality notes, and what would change the bet.",
        },
        {
          role: "user",
          content: query,
        },
      ],
    }),
  },
  {
    id: "aisa-perplexity-deep-research",
    name: "Perplexity Deep Research",
    provider: "AIsa API",
    endpoint: "https://api.aisa.one/apis/v2/perplexity/sonar-deep-research",
    method: "POST",
    maxAmountUsdc: 2,
    timeoutSeconds: 600,
    execTimeoutMs: 0,
    purpose: "Exhaustive cited research report for noisy event, macro, and geopolitical markets.",
    body: (query) => ({
      model: "sonar-deep-research",
      temperature: 0.1,
      max_tokens: 5000,
      return_citations: true,
      search_context: "high",
      search_recency_filter: "week",
      messages: [
        {
          role: "system",
          content:
            "You are a senior prediction-market research analyst. Be evidence-first. Separate YES evidence, NO evidence, market-pricing gaps, social sentiment, source quality, and trade sizing implications.",
        },
        {
          role: "user",
          content: query,
        },
      ],
    }),
  },
  {
    id: "aisa-twitter-advanced-search",
    name: "AIsa X advanced search",
    provider: "AIsa API",
    endpoint: "https://api.aisa.one/apis/v2/twitter/tweet/advanced_search",
    method: "GET",
    maxAmountUsdc: 0.1,
    purpose: "Read-only X/Twitter search for recent posts, rumors, and social sentiment around the market.",
    queryParams: (query) => ({
      query: buildRecentXSearchQuery(query),
      queryType: "Top",
    }),
  },
  {
    id: "aisa-twitter-community-search",
    name: "AIsa X community search",
    provider: "AIsa API",
    endpoint: "https://api.aisa.one/apis/v2/twitter/community/get_tweets_from_all_community",
    method: "GET",
    maxAmountUsdc: 0.1,
    purpose: "Read-only X/Twitter community search to catch topic-specific discussion clusters.",
    queryParams: (query) => ({
      query: buildRecentXSearchQuery(query),
      queryType: "Top",
    }),
  },
  {
    id: "aisa-coingecko-categories",
    name: "AIsa CoinGecko categories",
    provider: "AIsa API",
    endpoint: "https://api.aisa.one/apis/v2/coingecko/coins/categories",
    method: "GET",
    maxAmountUsdc: 0.1,
    purpose: "Crypto market breadth context for crypto-linked prediction markets.",
    queryParams: () => ({
      order: "market_cap_desc",
    }),
  },
];

export async function runLiveX402Research({
  marketId,
  query,
  maxTotalUsdc = DEFAULT_LIVE_X402_BUDGET_USDC,
  env = process.env,
}: LiveX402ResearchInput): Promise<LiveX402ResearchSummary> {
  const address = env.CIRCLE_MAINNET_AGENT_WALLET_ADDRESS;
  const chain = env.CIRCLE_GATEWAY_CHAIN || "MATIC";
  const createdAt = new Date().toISOString();
  const enrichedQuery = await enrichQueryWithPolymarketConditionId(query);

  if (!address) {
    return {
      status: "error",
      query: enrichedQuery,
      maxTotalUsdc,
      estimatedMaxSpendUsdc: 0,
      services: SERVICE_PLAN.map((service) => ({
        id: service.id,
        name: service.name,
        provider: service.provider,
        endpoint: typeof service.endpoint === "string" ? service.endpoint : "market-specific endpoint",
        status: "skipped",
        maxAmountUsdc: service.maxAmountUsdc,
        purpose: service.purpose,
        rawText: null,
        summary: "Missing CIRCLE_MAINNET_AGENT_WALLET_ADDRESS; paid x402 call was not attempted.",
      })),
      savedTo: null,
      createdAt,
    };
  }

  let spentBudget = 0;
  const services: LiveX402ServiceResult[] = [];

  for (const service of SERVICE_PLAN) {
    const endpoint = buildServiceUrl(service, enrichedQuery);

    if (!endpoint) {
      services.push({
        id: service.id,
        name: service.name,
        provider: service.provider,
        endpoint: "market-specific endpoint",
        status: "skipped",
        maxAmountUsdc: service.maxAmountUsdc,
        purpose: service.purpose,
        rawText: null,
        summary: "Skipped because this market did not provide the condition ID required by the service.",
      });
      continue;
    }

    if (spentBudget + service.maxAmountUsdc > maxTotalUsdc) {
      services.push({
        id: service.id,
        name: service.name,
        provider: service.provider,
        endpoint,
        status: "skipped",
        maxAmountUsdc: service.maxAmountUsdc,
        purpose: service.purpose,
        rawText: null,
        summary: `Skipped to keep the approved budget under ${maxTotalUsdc} USDC.`,
      });
      continue;
    }

    spentBudget += service.maxAmountUsdc;
    services.push(await payService({ service, query: enrichedQuery, endpoint, address, chain }));
  }

  const status = services.every((service) => service.status === "ok")
    ? "ok"
    : services.some((service) => service.status === "ok")
      ? "partial"
      : "error";
  const savedTo = `.cache/x402/live-paid-research/${safeId(marketId)}-${Date.now()}.json`;
  const summary: LiveX402ResearchSummary = {
    status,
    query: enrichedQuery,
    maxTotalUsdc,
    estimatedMaxSpendUsdc: Number(spentBudget.toFixed(4)),
    services,
    savedTo,
    createdAt,
  };

  await mkdir(dirname(savedTo), { recursive: true });
  await writeFile(savedTo, `${JSON.stringify(summary, null, 2)}\n`);

  return summary;
}

async function payService({
  service,
  query,
  endpoint,
  address,
  chain,
}: {
  service: ServicePlan;
  query: string;
  endpoint: string;
  address: string;
  chain: string;
}): Promise<LiveX402ServiceResult> {
  const args = [
    "services",
    "pay",
    endpoint,
    "--address",
    address,
    "--chain",
    service.chain ?? chain,
    "--max-amount",
    service.maxAmountUsdc.toString(),
    "--output",
    "json",
  ];

  if (service.timeoutSeconds !== null) {
    args.push("--timeout", (service.timeoutSeconds ?? 300).toString());
  }

  if (service.method === "POST") {
    args.push(
      "--method",
      "POST",
      "--header",
      "Content-Type: application/json",
      "--data",
      JSON.stringify(service.body?.(query) ?? {}),
    );
  }

  try {
    const invocation = buildCircleInvocation(args);
    const { stdout, stderr } = await execFileAsync(invocation.file, invocation.args, {
      maxBuffer: 1024 * 1024 * 32,
      timeout: service.execTimeoutMs ?? 0,
      windowsHide: true,
    });
    const rawText = stdout.trim();
    const payloadError = readPayloadError(rawText);
    const payment = extractX402PaymentRecord(rawText);

    return {
      id: service.id,
      name: service.name,
      provider: service.provider,
      endpoint,
      status: payloadError ? "error" : "ok",
      maxAmountUsdc: service.maxAmountUsdc,
      purpose: service.purpose,
      rawText,
      summary: payloadError ?? summarizeRawPayload(rawText || stderr),
      ...(payloadError ? { error: payloadError } : {}),
      ...(payment ? { payment } : {}),
    };
  } catch (error) {
    const message = isExecError(error)
      ? `${error.stderr || error.stdout || error.message}`.trim()
      : error instanceof Error
        ? error.message
        : "x402 service call failed.";
    const rawText = isExecError(error) ? error.stdout || null : null;
    const payment = rawText ? extractX402PaymentRecord(rawText) : null;

    return {
      id: service.id,
      name: service.name,
      provider: service.provider,
      endpoint,
      status: "error",
      maxAmountUsdc: service.maxAmountUsdc,
      purpose: service.purpose,
      rawText,
      summary: truncate(message, 900),
      error: truncate(message, 900),
      ...(payment ? { payment } : {}),
    };
  }
}

function extractX402PaymentRecord(rawText: string): X402PaymentRecord | null {
  if (!rawText.trim()) return null;

  try {
    const parsed = JSON.parse(rawText) as unknown;
    const payment = getPath(parsed, ["data", "payment"]) ?? getPath(parsed, ["payment"]);
    if (!isObject(payment)) return null;

    const receipt = firstString(payment, ["receipt"]);
    const decodedReceipt = receipt ? decodePaymentReceipt(receipt) : null;

    return {
      amount: firstString(payment, ["amount"]),
      chain: firstString(payment, ["chain"]),
      scheme: firstString(payment, ["scheme"]),
      seller: firstString(payment, ["seller", "payTo", "recipient"]),
      receiptTransaction: decodedReceipt?.transaction ?? null,
      receiptNetwork: decodedReceipt?.network ?? null,
      success: decodedReceipt?.success ?? null,
      transactionHash:
        firstString(payment, ["transactionHash", "txHash", "tx_hash"]) ??
        decodedReceipt?.transactionHash ??
        null,
      explorerUrl: firstString(payment, ["explorerUrl", "explorer"]) ?? decodedReceipt?.explorerUrl ?? null,
    };
  } catch {
    return null;
  }
}

function decodePaymentReceipt(receipt: string) {
  try {
    const decoded = Buffer.from(receipt, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (!isObject(parsed)) return null;

    return {
      success: typeof parsed.success === "boolean" ? parsed.success : null,
      transaction: firstString(parsed, ["transaction", "transactionId", "id"]),
      network: firstString(parsed, ["network", "chain"]),
      transactionHash: firstString(parsed, ["transactionHash", "txHash", "tx_hash"]),
      explorerUrl: firstString(parsed, ["explorerUrl", "explorer"]),
    };
  } catch {
    return null;
  }
}

function readPayloadError(rawText: string) {
  if (!rawText.trim()) return null;

  try {
    const parsed = JSON.parse(rawText) as unknown;
    const error = isObject(parsed)
      ? getPath(parsed, ["detail", "error"]) ?? getPath(parsed, ["error"]) ?? getPath(parsed, ["message"])
        ?? getPath(parsed, ["data", "response", "error"]) ?? getPath(parsed, ["response", "error"])
      : null;

    return typeof error === "string" && /error|too long|invalid|failed/i.test(error)
      ? truncate(error, 900)
      : null;
  } catch {
    return null;
  }
}

function buildServiceUrl(service: ServicePlan, query: string) {
  const endpoint = typeof service.endpoint === "function" ? service.endpoint(query) : service.endpoint;
  if (!endpoint) return null;
  if (!service.queryParams) return endpoint;

  const url = new URL(endpoint);
  Object.entries(service.queryParams(query)).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function extractConditionId(query: string) {
  return query.match(/Condition ID:\s*(0x[a-fA-F0-9]+)/)?.[1] ?? null;
}

async function enrichQueryWithPolymarketConditionId(query: string) {
  if (extractConditionId(query)) return query;

  const slug = extractMarketSlug(query);
  if (!slug) return query;

  const conditionId = await fetchConditionIdForPolymarketSlug(slug);
  if (!conditionId) return query;

  return `${query} Condition ID: ${conditionId}.`;
}

function extractMarketSlug(query: string) {
  const explicit = query.match(/Market slug:\s*([a-zA-Z0-9-]+)/)?.[1];
  if (explicit) return explicit.toLowerCase();

  const urlMatch = query.match(/https?:\/\/(?:www\.)?polymarket\.com\/event\/[^\s.]+/i)?.[0];
  if (!urlMatch) return null;

  try {
    const url = new URL(urlMatch);
    return url.searchParams.get("marketSlug")?.toLowerCase().replace(/[^a-z0-9-]+/g, "-") || null;
  } catch {
    return null;
  }
}

function extractFirstTokenId(query: string) {
  return query.match(/Token IDs:\s*([0-9]+)/)?.[1] ?? null;
}

async function fetchConditionIdForPolymarketSlug(slug: string) {
  const records = await fetchPolymarketRecords(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`);
  const record = records[0];
  return record ? firstString(record, ["conditionId", "condition_id"]) : null;
}

async function fetchPolymarketRecords(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = await response.json() as unknown;
    if (Array.isArray(payload)) return payload.filter(isObject);
    if (isObject(payload) && Array.isArray(payload.data)) return payload.data.filter(isObject);
    return [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function compactSearchQuery(query: string) {
  const withoutUrls = query.replace(/https?:\/\/\S+/gi, " ");
  const marketMatch = withoutUrls.match(/Prediction market research:\s*(.*?)(?:\s+Venue:|\s+Find whether|$)/i);
  const core = marketMatch?.[1] ?? withoutUrls;

  return core
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function buildRecentXSearchQuery(query: string) {
  const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const core = compactSearchQuery(query).slice(0, 180);
  return `${core} since:${since}`;
}

function buildCircleInvocation(args: string[]) {
  const jsPath = resolveCircleJsPath();
  if (jsPath) {
    return { file: "node", args: [jsPath, ...args] };
  }

  const circlePath = resolveCircleCliPath();
  if (process.platform !== "win32") {
    return { file: circlePath, args };
  }

  return {
    file: "cmd.exe",
    args: ["/d", "/s", "/c", [quoteCmdArg(circlePath), ...args.map(quoteCmdArg)].join(" ")],
  };
}

function resolveCircleJsPath() {
  if (process.env.CIRCLE_CLI_JS_PATH && existsSync(process.env.CIRCLE_CLI_JS_PATH)) {
    return process.env.CIRCLE_CLI_JS_PATH;
  }

  const candidates = [
    "C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\@circle-fin\\cli\\dist\\index.js",
    "C:\\Users\\pc\\AppData\\Roaming\\npm\\node_modules\\@circle-fin\\cli\\bin\\circle.js",
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function summarizeRawPayload(rawText: string) {
  if (!rawText.trim()) return "Service returned an empty response.";

  try {
    const parsed = JSON.parse(rawText);
    return truncate(JSON.stringify(extractUsefulPayload(parsed), null, 2), 1800);
  } catch {
    return truncate(rawText, 1800);
  }
}

function extractUsefulPayload(value: unknown): unknown {
  if (!isObject(value)) return value;

  const payload =
    getPath(value, ["data", "response"]) ??
    getPath(value, ["response"]) ??
    getPath(value, ["data"]) ??
    value;

  return compactPayload(payload);
}

function compactPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 8).map(compactRecord);
  }

  if (!isObject(value)) return value;

  const choices = value.choices;
  if (Array.isArray(choices)) {
    const firstChoice = choices.find(isObject);
    const message = firstChoice ? getPath(firstChoice, ["message", "content"]) : null;
    const citations = Array.isArray(value.citations) ? value.citations.slice(0, 12) : undefined;

    return {
      content: typeof message === "string" && message.trim() ? message : "No textual answer returned.",
      citations,
    };
  }

  if (Array.isArray(value.markets)) {
    return {
      markets: value.markets.slice(0, 8).map(compactRecord),
      cursor: value.cursor,
    };
  }

  if (Array.isArray(value.tweets)) {
    return {
      tweets: value.tweets.slice(0, 8).map(compactTweet),
      hasNextPage: value.has_next_page,
    };
  }

  if (Array.isArray(value.results)) {
    return {
      answer: value.answer,
      results: value.results.slice(0, 8).map(compactRecord),
    };
  }

  if (Array.isArray(value.entries)) {
    const entries = value.entries.slice(0, 10).map(compactHolderRecord);

    return {
      title: firstString(value, ["title", "question", "market_slug"]),
      conditionId: firstString(value, ["condition_id"]),
      marketSlug: firstString(value, ["market_slug"]),
      side: firstString(value, ["side"]),
      totalCount: value.total_count,
      entries,
      sideTotals: summarizeSideTotals(entries),
    };
  }

  if (Array.isArray(value.trades)) {
    const trades = value.trades.slice(0, 20).map(compactTradeRecord);

    return {
      trades,
      sideTotals: summarizeSideTotals(trades),
    };
  }

  if (Array.isArray(value.activities)) {
    const activities = value.activities.slice(0, 30).map(compactTradeRecord);

    return {
      activities,
      pagination: value.pagination,
      sideTotals: summarizeSideTotals(activities),
    };
  }

  if (Array.isArray(value.orderbooks) || Array.isArray(value.orderbook)) {
    const rawOrderbooks: unknown[] = Array.isArray(value.orderbooks)
      ? value.orderbooks
      : Array.isArray(value.orderbook)
        ? value.orderbook
        : [];
    const orderbooks = rawOrderbooks.slice(0, 8).map(compactRecord);

    return {
      tokenId: firstString(value, ["token_id", "asset_id", "assetId"]),
      orderbooks,
      pagination: value.pagination,
    };
  }

  if (Array.isArray(value.candlesticks) || Array.isArray(value.candles) || Array.isArray(value.data)) {
    const raw =
      Array.isArray(value.candlesticks)
        ? value.candlesticks
        : Array.isArray(value.candles)
          ? value.candles
          : Array.isArray(value.data)
            ? value.data
            : [];

    return {
      candles: raw.slice(0, 16).map(compactRecord),
      count: raw.length,
    };
  }

  const detailError = getPath(value, ["detail", "error"]);
  if (typeof detailError === "string") {
    return { error: detailError };
  }

  return compactRecord(value);
}

function compactTweet(value: unknown) {
  if (!isObject(value)) return value;
  const author = isObject(value.author) ? value.author : {};

  return {
    text: firstString(value, ["text", "full_text", "content"]),
    url: firstString(value, ["url"]),
    createdAt: firstString(value, ["createdAt", "created_at"]),
    author: firstString(author, ["userName", "screenName", "name"]),
    followers: author.followers,
    likes: value.likeCount ?? value.likes,
    reposts: value.retweetCount ?? value.reposts,
  };
}

function compactRecord(value: unknown) {
  if (!isObject(value)) return value;

  return {
    title: firstString(value, ["title", "question", "name", "event_title", "market_slug", "slug"]),
    description: truncate(firstString(value, ["description", "content", "snippet", "summary"]) ?? "", 420),
    status: firstString(value, ["status"]),
    price: value.price ?? value.bestAsk ?? value.last_price ?? value.lastPrice,
    probability: value.probability ?? value.bestAsk ?? value.lastTradePrice,
    bid: value.bid ?? value.bestBid ?? value.bids,
    ask: value.ask ?? value.bestAsk ?? value.asks,
    open: value.open,
    high: value.high,
    low: value.low,
    close: value.close,
    volume: value.volume ?? value.volumeNum ?? value.volume_dollars ?? value.total_volume_usd,
    liquidity: value.liquidity ?? value.liquidityNum ?? value.liquidity_dollars,
    endDate: firstString(value, ["endDate", "end_time", "close_time", "expiration_time"]),
    url: firstString(value, ["url", "link"]),
    wallet: firstString(value, ["wallet", "address", "user", "holder", "proxyWallet"]),
    side: firstString(value, ["side", "outcome", "outcome_label"]),
    shares: value.shares ?? value.shares_normalized ?? value.position,
    amountUsd: value.amount_usd ?? value.value ?? value.value_usd ?? value.notional,
  };
}

function compactHolderRecord(value: unknown) {
  if (!isObject(value)) return value;

  return {
    rank: value.rank,
    wallet: firstString(value, ["wallet", "address", "user", "holder", "proxyWallet"]),
    side: firstString(value, ["side", "outcome", "outcome_label"]),
    shares: value.position_shares ?? value.shares ?? value.shares_normalized ?? value.position,
    amountUsd: value.position_value_usd ?? value.amount_usd ?? value.value ?? value.value_usd ?? value.notional,
    avgPrice: value.avg_price,
    tradeCount: value.trade_count,
    firstTradeAt: value.first_trade_at,
    lastTradeAt: value.last_trade_at,
    realizedPnl: value.realized_pnl,
    unrealizedPnl: value.unrealized_pnl,
  };
}

function compactTradeRecord(value: unknown) {
  if (!isObject(value)) return value;

  return {
    wallet: firstString(value, ["wallet", "address", "user", "holder", "proxyWallet"]),
    side: firstString(value, ["side", "outcome", "outcome_label"]),
    outcomeLabel: firstString(value, ["outcome_label", "outcome", "label"]),
    marketSlug: firstString(value, ["market_slug"]),
    conditionId: firstString(value, ["condition_id"]),
    shares: value.shares_normalized ?? value.shares ?? value.position,
    amountUsd: value.amount_usd ?? value.value ?? value.value_usd ?? value.notional,
    price: value.price,
    timestamp: value.timestamp,
  };
}

function summarizeSideTotals(entries: unknown[]) {
  const totals = new Map<string, { count: number; amountUsd: number; shares: number }>();

  for (const entry of entries) {
    if (!isObject(entry)) continue;
    const side = normalizeSide(firstString(entry, ["side", "outcomeLabel"]) ?? "Unknown");
    const current = totals.get(side) ?? { count: 0, amountUsd: 0, shares: 0 };
    current.count += 1;
    current.amountUsd += numericValue(entry.amountUsd);
    current.shares += numericValue(entry.shares);
    totals.set(side, current);
  }

  return Object.fromEntries([...totals.entries()].map(([side, value]) => [
    side,
    {
      count: value.count,
      amountUsd: Number(value.amountUsd.toFixed(4)),
      shares: Number(value.shares.toFixed(4)),
    },
  ]));
}

function normalizeSide(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.includes("yes")) return "YES";
  if (lowered.includes("no")) return "NO";
  if (lowered.includes("buy")) return "BUY";
  if (lowered.includes("sell")) return "SELL";
  return value || "Unknown";
}

function numericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function firstString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const current = value[key];
    if (typeof current === "string" && current.trim()) return current;
    if (typeof current === "number" || typeof current === "boolean") return String(current);
  }

  return null;
}

function getPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!isObject(current)) return undefined;
    return current[key];
  }, value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExecError(error: unknown): error is Error & {
  stdout?: string;
  stderr?: string;
  code?: number;
} {
  return typeof error === "object" && error !== null && "message" in error;
}

function quoteCmdArg(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "market";
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
