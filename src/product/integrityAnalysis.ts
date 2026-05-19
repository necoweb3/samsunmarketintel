export type JsonObject = Record<string, unknown>;

export type TradeRecord = {
  id: string;
  marketId: string;
  market: string;
  wallet: string;
  side: string;
  amountUsd: number;
  price: number | null;
  timestamp: string | null;
};

export type FlowAlert = {
  marketId: string;
  market: string;
  risk: "Low" | "Medium" | "High";
  score: number;
  trades: number;
  notionalUsd: string;
  uniqueWallets: number;
  topWalletShare: string;
  oneSidedShare: string;
  largestTrade: string;
  reason: string;
  impliedProbability: number | null;
};

export type X402PaymentSummary = {
  amount: string | null;
  chain: string | null;
  scheme: string | null;
  seller: string | null;
};

export function buildIntegritySnapshot(payload: unknown) {
  const trades = extractTrades(payload)
    .map(normalizeTrade)
    .filter((trade): trade is TradeRecord => trade !== null);

  return {
    trades,
    alerts: buildFlowAlerts(trades),
    payment: extractPayment(payload),
  };
}

export function extractTrades(payload: unknown): unknown[] {
  const candidates = [
    getPath(payload, ["data", "response", "trades"]),
    getPath(payload, ["data", "response", "data", "trades"]),
    getPath(payload, ["data", "trades"]),
    getPath(payload, ["response", "trades"]),
    getPath(payload, ["trades"]),
  ];

  return candidates.find(Array.isArray) ?? [];
}

export function normalizeTrade(value: unknown, index: number): TradeRecord | null {
  if (!isObject(value)) return null;

  const marketId =
    firstString(value, [
      "condition_id",
      "conditionId",
      "market_id",
      "marketId",
      "market_slug",
      "slug",
    ]) ?? "unknown-market";
  const market =
    firstString(value, ["title", "question", "market", "market_title", "market_slug"]) ??
    marketId;
  const wallet =
    firstString(value, [
      "proxy_wallet",
      "proxyWallet",
      "wallet",
      "user",
      "trader",
      "maker",
      "taker",
      "address",
    ]) ?? "unknown-wallet";
  const side = normalizeOutcome(value);
  const price = toNumber(firstPresent(value, ["price", "avg_price", "average_price"]));
  const amountUsd = readAmountUsd(value, price);

  if (amountUsd <= 0) return null;

  return {
    id:
      firstString(value, ["id", "trade_id", "transaction_hash", "tx_hash", "order_hash"]) ??
      `trade-${index + 1}`,
    marketId,
    market,
    wallet,
    side,
    amountUsd,
    price,
    timestamp:
      firstString(value, ["timestamp", "time", "created_at", "createdAt", "block_time"]) ??
      null,
  };
}

export function buildFlowAlerts(trades: TradeRecord[]): FlowAlert[] {
  const byMarket = new Map<string, TradeRecord[]>();
  for (const trade of trades) {
    const current = byMarket.get(trade.marketId) ?? [];
    current.push(trade);
    byMarket.set(trade.marketId, current);
  }

  return [...byMarket.values()]
    .map(scoreMarket)
    .sort((a, b) => b.score - a.score);
}

export function extractPayment(payload: unknown): X402PaymentSummary | null {
  const payment = getPath(payload, ["data", "payment"]) ?? getPath(payload, ["payment"]);
  if (!isObject(payment)) return null;

  return {
    amount: stringify(firstPresent(payment, ["amount", "price", "maxAmount"])),
    chain: stringify(firstPresent(payment, ["chain", "network"])),
    scheme: stringify(firstPresent(payment, ["scheme", "paymentScheme"])),
    seller: stringify(firstPresent(payment, ["seller", "payTo", "recipient"])),
  };
}

function scoreMarket(trades: TradeRecord[]): FlowAlert {
  const total = trades.reduce((sum, trade) => sum + trade.amountUsd, 0);
  const walletTotals = sumBy(trades, (trade) => trade.wallet);
  const sideTotals = sumBy(trades, (trade) => trade.side);
  const topWallet = Math.max(...walletTotals.values(), 0);
  const topSide = Math.max(...sideTotals.values(), 0);
  const largestTrade = Math.max(...trades.map((trade) => trade.amountUsd), 0);
  const topWalletShare = total > 0 ? topWallet / total : 0;
  const oneSidedShare = total > 0 ? topSide / total : 0;
  const largestShare = total > 0 ? largestTrade / total : 0;

  const rawScore = Math.min(
    100,
    Math.round(topWalletShare * 42 + oneSidedShare * 34 + largestShare * 24),
  );
  const sampleFactor =
    trades.length >= 12 ? 1 : trades.length >= 6 ? 0.82 : trades.length >= 3 ? 0.62 : 0.35;
  const notionalFactor = total >= 500 ? 1 : total >= 100 ? 0.82 : total >= 25 ? 0.62 : 0.35;
  const score = Math.round(rawScore * Math.min(sampleFactor, notionalFactor));
  const risk = score >= 72 ? "High" : score >= 48 ? "Medium" : "Low";

  return {
    marketId: trades[0]?.marketId ?? "unknown-market",
    market: trades[0]?.market ?? "Unknown market",
    risk,
    score,
    trades: trades.length,
    notionalUsd: formatUsd(total),
    uniqueWallets: walletTotals.size,
    topWalletShare: formatPercent(topWalletShare),
    oneSidedShare: formatPercent(oneSidedShare),
    largestTrade: formatUsd(largestTrade),
    reason: buildReason(topWalletShare, oneSidedShare, largestShare, trades.length, total),
    impliedProbability: readImpliedProbability(trades),
  };
}

function sumBy(trades: TradeRecord[], getKey: (trade: TradeRecord) => string) {
  const totals = new Map<string, number>();
  for (const trade of trades) {
    const key = getKey(trade);
    totals.set(key, (totals.get(key) ?? 0) + trade.amountUsd);
  }
  return totals;
}

function buildReason(
  topWalletShare: number,
  oneSidedShare: number,
  largestShare: number,
  trades: number,
  total: number,
) {
  const reasons = [];
  if (trades < 6) reasons.push("thin sample");
  if (total < 100) reasons.push("low notional");
  if (topWalletShare >= 0.55) reasons.push("wallet concentration");
  if (oneSidedShare >= 0.78) reasons.push("one-sided flow");
  if (largestShare >= 0.45) reasons.push("single large print");
  return reasons.length > 0 ? reasons.join(" + ") : "balanced flow";
}

function readImpliedProbability(trades: TradeRecord[]) {
  let weightedSum = 0;
  let weight = 0;

  for (const trade of trades) {
    if (trade.price === null) continue;

    const yesProbability = trade.side === "no" ? 1 - trade.price : trade.price;
    weightedSum += yesProbability * trade.amountUsd;
    weight += trade.amountUsd;
  }

  return weight > 0 ? clampProbability(weightedSum / weight) : null;
}

function readAmountUsd(value: JsonObject, price: number | null) {
  const direct = toNumber(
    firstPresent(value, [
      "amount_usd",
      "amountUsd",
      "value_usd",
      "notional_usd",
      "usdc_size",
      "cash_value",
    ]),
  );
  if (direct !== null) return direct;

  const size = toNumber(firstPresent(value, ["size", "shares", "quantity", "amount"]));
  if (size !== null && price !== null) return size * price;
  return size ?? 0;
}

function normalizeOutcome(value: JsonObject) {
  if (typeof value.is_yes_side === "boolean") {
    return value.is_yes_side ? "yes" : "no";
  }

  const outcome = firstString(value, ["outcome_label", "outcome", "label"]);
  if (outcome) return normalizeSide(outcome);

  return normalizeSide(firstString(value, ["side", "action"]));
}

function normalizeSide(value: string | null) {
  if (!value) return "unknown";
  const lowered = value.toLowerCase();
  if (lowered === "no" || lowered.includes("down") || lowered.includes("sell")) return "no";
  if (lowered === "yes" || lowered.includes("up") || lowered.includes("buy")) return "yes";
  return lowered;
}

function clampProbability(value: number) {
  return Math.min(1, Math.max(0, value));
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
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
