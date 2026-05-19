export type X402Service = {
  id: string;
  provider: "BlockRun.AI" | "AIsa API";
  name: string;
  endpoint: string;
  method: "GET" | "POST";
  venue: "Polymarket" | "Cross-market" | "Research";
  price: string;
  network: string;
  payment: string;
  purpose: string;
  requiredInput: string;
  status: "Ready" | "Needs manual approval" | "Schema mapped";
};

export const x402Services: X402Service[] = [
  {
    id: "blockrun-polymarket-markets",
    provider: "BlockRun.AI",
    name: "Polymarket markets",
    endpoint: "https://nano.blockrun.ai/api/v1/pm/polymarket/markets",
    method: "GET",
    venue: "Polymarket",
    price: "0.001 USDC",
    network: "Polygon",
    payment: "GatewayWalletBatched",
    purpose: "Market discovery, filtering, and watchlist refresh.",
    requiredInput: "none",
    status: "Ready",
  },
  {
    id: "blockrun-polymarket-trades",
    provider: "BlockRun.AI",
    name: "Polymarket trades",
    endpoint: "https://nano.blockrun.ai/api/v1/pm/polymarket/trades",
    method: "GET",
    venue: "Polymarket",
    price: "0.001 USDC",
    network: "Polygon",
    payment: "GatewayWalletBatched",
    purpose: "Trade clustering and suspicious-flow detection.",
    requiredInput: "optional filters",
    status: "Ready",
  },
  {
    id: "aisa-polymarket-orderbooks",
    provider: "AIsa API",
    name: "Polymarket orderbooks",
    endpoint: "https://api.aisa.one/apis/v2/polymarket/orderbooks",
    method: "GET",
    venue: "Polymarket",
    price: "0.01 USDC",
    network: "Base / Polygon / Ethereum",
    payment: "GatewayWalletBatched",
    purpose: "Liquidity, spread, depth, and price-impact checks.",
    requiredInput: "token_id",
    status: "Schema mapped",
  },
  {
    id: "blockrun-matching-markets",
    provider: "BlockRun.AI",
    name: "Matching markets",
    endpoint: "https://nano.blockrun.ai/api/v1/pm/matching-markets",
    method: "GET",
    venue: "Cross-market",
    price: "0.005 USDC",
    network: "Polygon",
    payment: "GatewayWalletBatched",
    purpose: "Comparable Polymarket market matching.",
    requiredInput: "none",
    status: "Ready",
  },
  {
    id: "aisa-tavily-search",
    provider: "AIsa API",
    name: "Tavily search",
    endpoint: "https://api.aisa.one/apis/v2/tavily/search",
    method: "POST",
    venue: "Research",
    price: "0.0096 USDC",
    network: "Polygon",
    payment: "GatewayWalletBatched",
    purpose: "Paid news and source discovery for macro and event-market research.",
    requiredInput: "query",
    status: "Ready",
  },
  {
    id: "aisa-perplexity-sonar",
    provider: "AIsa API",
    name: "Perplexity Sonar",
    endpoint: "https://api.aisa.one/apis/v2/perplexity/sonar",
    method: "POST",
    venue: "Research",
    price: "0.012 USDC",
    network: "Polygon",
    payment: "GatewayWalletBatched",
    purpose: "Cited research synthesis for deeper market narratives.",
    requiredInput: "messages",
    status: "Schema mapped",
  },
];

export const x402GatewayStatus = {
  agentWallet: "0xc421716945e8cfed01e06d0e73a3c7db0d733b0a",
  chain: "Polygon",
  balance: "3.019393 USDC",
  nextStep: "Gateway is funded; paid calls still require manual approval before spend.",
  checkedAt: "2026-05-18T16:31:00Z",
};

export const x402ServiceSummary = {
  servicesMapped: x402Services.length,
  lowestPrice: "0.001 USDC",
  primaryRail: "Circle Gateway",
  defaultMode: "Inspect first, pay only after approval",
};
