"use client";

import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  FileText,
  Gauge,
  Heart,
  MessageCircle,
  Landmark,
  LayoutGrid,
  LockKeyhole,
  MessageSquare,
  Network,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Radar,
  ReceiptText,
  Repeat2,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  WalletCards,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  emptyArcState,
  marketDrafts,
  productTone,
  sourceRegistry as starterSourceRegistry,
} from "@/src/product/mockData";
import { estimatePositionSize } from "@/src/product/positionSizing";

const LIVE_X402_RESEARCH_BUDGET_USDC = 6;

export type PageKey = "chat" | "markets" | "ideas" | "sources" | "activity" | "system";

type ArcState = {
  status: "loading" | "ok" | "missing_config" | "wrong_chain" | "error" | string;
  contractAddress: string | null;
  agentWallet: string | null;
  agentWalletBalance: string | null;
  nextReceiptId: string | null;
  latestReceiptId: string | null;
  explorer: {
    contract?: string;
  } | null;
};

type GatewayState = {
  status: "loading" | "ok" | "missing_config" | "unavailable" | string;
  chain: string;
  balance: string | null;
  token: string;
};

type X402SnapshotMarket = {
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

type X402SnapshotState = {
  status: "loading" | "ok" | "empty" | "error" | string;
  count: number;
  markets: X402SnapshotMarket[];
  updatedAt: string | null;
};

type IntegrityAlert = {
  marketId: string;
  market: string;
  risk: "Low" | "Medium" | "High";
  score: number;
  notionalUsd: string;
  topWalletShare: string;
  oneSidedShare: string;
  reason: string;
  impliedProbability: number | null;
};

type IntegrityState = {
  status: "loading" | "ok" | "empty" | "error" | string;
  trades: number;
  alerts: IntegrityAlert[];
  updatedAt: string | null;
};

type ResearchSource = {
  title: string;
  url: string;
  domain: string;
  content: string;
  score: number | null;
  credibility: "Official" | "High" | "Medium" | "Watch";
};

type ResearchState = {
  status: "loading" | "ok" | "empty" | "error" | string;
  snapshot: {
    query: string;
    answer: string | null;
    sourceCount: number;
    officialSources: number;
    averageScore: number | null;
    topSources: ResearchSource[];
  } | null;
  updatedAt: string | null;
};

type SentientResearchConfigState = {
  status:
    | "loading"
    | "ready"
    | "needs_search_provider"
    | "needs_reranker"
    | "needs_model"
    | "not_configured"
    | "error"
    | string;
  mode?: "default" | "pro";
  search?: {
    label: string;
    ready: boolean;
  };
  reranker?: {
    label: string;
    ready: boolean;
  };
  model?: {
    name: string;
    ready: boolean;
  };
  missing: string[];
};

type DeepSearchState = {
  status: "loading" | "ready" | "needs_config" | "missing_runtime" | "error" | string;
  runtime?: {
    status: "ready" | "needs_config" | "missing_runtime" | "error" | string;
    missing: string[];
  };
  result?: {
    status: "ok" | "needs_config" | "missing_runtime" | "error" | string;
    answer: string | null;
    durationMs: number | null;
    error?: string;
    updatedAt: string;
  } | null;
};

type AgentRunRecord = {
  id: string;
  marketId: string;
  market: string;
  venue: "Polymarket" | "Draft";
  category: string;
  action: "BET_YES" | "BET_NO" | "WAIT" | "DO_NOT_BET";
  riskGate: "open" | "review" | "blocked";
  summary: string;
  edge: number | null;
  confidence: number;
  sizing: {
    side: "YES" | "NO" | "NONE";
    stakeUsdc: number;
    cappedFraction: number;
    reason: string;
  };
  policy: {
    status: "healthy" | "review" | "blocked";
    walletExecution: false;
    remainingDailyUsdc: number;
  };
  analysis?: {
    marketProbability: number | null;
    agentProbability: number;
    inputRisk: "Low" | "Medium" | "High";
  };
  sentientContext?: {
    mode: string;
    activeComponents: string[];
    openDeepSearch: {
      status: string;
      currentInput: string;
    };
    roma: {
      lanes: string[];
    };
  };
  marketResearch?: {
    status: string;
    query: string;
    answer: string | null;
    durationMs: number | null;
    provider: string;
    reranker: string;
    model: string;
    sourceLinks: string[];
    error?: string;
  };
  paidResearch?: {
    status: "ok" | "partial" | "error";
    query: string;
    maxTotalUsdc: number;
    estimatedMaxSpendUsdc: number;
    services: Array<{
      id: string;
      name: string;
      provider: string;
      status: "ok" | "error" | "skipped";
      maxAmountUsdc: number;
      purpose: string;
      rawText?: string | null;
      summary: string;
      error?: string;
      payment?: {
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
    }>;
    savedTo: string | null;
    createdAt: string;
  };
  modelAnalysis?: {
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
    tradePlan: {
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
    } | null;
    usage: {
      totalTokens: number | null;
    } | null;
    error?: string;
  };
  cryptoBench?: {
    status: "active" | "skipped";
    mode: string;
    triggeredBy: string[];
    overallScore: number | null;
    dimensions: Record<
      "relevance" | "temporalRelevance" | "depth" | "dataConsistency",
      {
        score: number;
        note: string;
      }
    > | null;
    errorTaxonomy: Array<{
      id: string;
      label: string;
      present: boolean;
      note: string;
    }>;
    improvementNotes: string[];
    generatedAt: string;
  };
  sources: string[];
  marketPriceLabel?: string;
  originalUrl?: string;
  marketSlug?: string;
  conditionId?: string;
  tokenIds?: string[];
  outcomeSummary?: string;
  createdAt: string;
};

type AgentRunLedgerState = {
  status: "loading" | "ok" | "error" | string;
  runs: AgentRunRecord[];
  updatedAt: string | null;
  message?: string;
};

type TradeIntentState = {
  status: "idle" | "loading" | "ok" | "error";
  intent: {
    id: string;
    marketId: string;
    market: string;
    targetOutcome?: string | null;
    requestedAction: "APPROVE_INTENT" | "WATCH" | "AVOID";
    requestedSide?: "AUTO" | "YES" | "NO";
    executionState: "requires_human_confirmation" | "watch_only" | "no_trade" | "blocked";
    side: "YES" | "NO" | "NONE";
    stakeUsdc: number;
    riskGate: "open" | "review" | "blocked";
    summary: string;
    createdAt: string;
  } | null;
  message?: string;
};

type IntentLedgerState = {
  status: "loading" | "ok" | "error" | string;
  intents: Array<NonNullable<TradeIntentState["intent"]>>;
  updatedAt: string | null;
};

type AgentPolicyState = {
  status: "loading" | "ok" | "error" | string;
  evaluation: {
    status: "healthy" | "review" | "blocked";
    ledger: {
      stagedIntents: number;
      blockedIntents: number;
      remainingDailyUsdc: number;
    };
    nextAction: string;
  } | null;
};

type RecordedIntentReceiptState = {
  status: "loading" | "ok" | "empty" | "error" | string;
  receipt: {
    expectedReceiptId?: string;
    nextReceiptId?: string;
    explorerUrl?: string;
    recordingMode?: string;
    transactionHash?: string;
    agentWallet?: string;
    requestedAgentWallet?: string;
    intent?: {
      id?: string;
      market?: string;
      targetOutcome?: string | null;
      side?: "YES" | "NO" | "NONE";
      executionState?: string;
      requestedAction?: string;
    };
  } | null;
  updatedAt: string | null;
  message?: string;
};

type ReviewPackState = {
  status: "loading" | "ok" | "error" | string;
  pack: {
    readiness: "demo-ready" | "needs-data" | "needs-proof";
    sentient: {
      status: string;
      activeComponents: string[];
      openDeepSearch: string;
      safety: string;
      roma: string;
    };
    arcProof: {
      status: "recorded" | "pending";
      receiptId: string | null;
      explorerUrl: string | null;
    };
    inputs: {
      paidMarkets: number;
      tradeFlowAlerts: number;
      researchSources: number;
      sourceRegistryRecords: number;
      marketStudioSpecs: number;
    };
  } | null;
};

type ProductReadinessState = {
  status: "loading" | "ready_for_live_api_tests" | "infra_ready_api_keys_pending" | "error" | string;
  summary?: string;
  blockers: string[];
};

type MarketStudioSpec = {
  id: string;
  title: string;
  vertical: "Turkey Macro" | "FX / Rates" | "Market Integrity" | "Legal / Political Risk";
  status: "Design-ready" | "Needs source list" | "Watch-only";
  marketQuestion: string;
  demand: string;
  settlementCurrency: "USDC" | "EURC";
  oracle: {
    primarySource: string;
    fallbackSource: string;
    resolutionWindow: string;
  };
  launchReadiness: number;
  sourceCoverage?: {
    status: "ready" | "partial" | "missing";
    coverage: number;
  };
};

type MarketStudioState = {
  status: "loading" | "ok" | "error" | string;
  specs: MarketStudioSpec[];
};

type SourceRegistryState = {
  status: "loading" | "ok" | "error" | string;
  records: Array<{
    id: string;
    name: string;
    type: string;
    coverage: string;
    credibility: string;
    role: string;
    domains?: string[];
    notes?: string;
    weight: number;
    status: "Active" | "Needs curation" | "Watch";
  }>;
};

type SourceFormState = {
  name: string;
  type: string;
  coverage: string;
  credibility: string;
  role: string;
  domains: string;
  status: string;
  notes: string;
};

export type DashboardInitialData = {
  arcState?: ArcState;
  gatewayState?: GatewayState;
  x402Snapshot?: X402SnapshotState;
  integrityState?: IntegrityState;
  researchState?: ResearchState;
  sentientResearchConfig?: SentientResearchConfigState;
  deepSearchState?: DeepSearchState;
  agentRunLedgerState?: AgentRunLedgerState;
  intentLedgerState?: IntentLedgerState;
  agentPolicyState?: AgentPolicyState;
  recordedIntentReceiptState?: RecordedIntentReceiptState;
  reviewPackState?: ReviewPackState;
  productReadinessState?: ProductReadinessState;
  marketStudioState?: MarketStudioState;
  sourceRegistryState?: SourceRegistryState;
};

type MarketCandidate = {
  id: string;
  venue: "Polymarket" | "Draft";
  question: string;
  category: string;
  probability: number | null;
  volume: string;
  liquidity: string;
  endDate: string;
  signal: "Unchecked" | "Watch" | "Edge" | "Risk";
  risk: "Low" | "Medium" | "High";
  agentProbability: number;
  confidence: number;
  sources: string[];
  marketPriceLabel?: string;
  origin: "demo" | "x402" | "linked";
  originalUrl?: string;
  thumbnailUrl?: string | null;
  marketSlug?: string;
  conditionId?: string;
  tokenIds?: string[];
  outcomeSummary?: string;
};

type MarketLinkPreviewResponse = {
  status: "ok" | "fallback" | "error";
  market?: {
    id?: string;
    venue?: MarketCandidate["venue"];
    question?: string;
    category?: string;
    volume?: string;
    liquidity?: string;
    endDate?: string;
    probability?: number | null;
    priceLabel?: string;
    imageUrl?: string | null;
    originalUrl?: string;
    marketSlug?: string;
    conditionId?: string;
    tokenIds?: string[];
    outcomeSummary?: string;
  };
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  run?: AgentRunRecord | null;
  trace?: AgentTraceStep[];
  createdAt?: string;
};

type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
};

type MarketRecent = {
  id: string;
  title: string;
  venue: MarketCandidate["venue"];
  updatedAt: string;
};

type AgentTraceStep = {
  label: string;
  detail: string;
  status: "queued" | "running" | "done" | "blocked";
};

type TradeIntentAction = "APPROVE_INTENT" | "WATCH" | "AVOID";

type EventIdea = {
  id: string;
  title: string;
  source: string;
  category: string;
  time: string;
  score: number;
  summary: string;
  question: string;
  reasons?: string[];
  resolutionHint?: string;
  url?: string;
};

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
  horizon: "Daily" | "Weekly";
  marketPotential: "High" | "Medium" | "Watch";
  score: number;
  scoreExplanation: string;
  reasons: string[];
  suggestedQuestion: string;
  resolutionHint: string;
  sourceSupport: string[];
  demandSignals?: string[];
};

type NewsBiteState = {
  status: "idle" | "loading" | "ok" | "error" | string;
  provider?: string;
  digest?: string;
  message?: string;
  items: NewsBite[];
  updatedAt: string | null;
};

type DemoBudgetItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  status: "ok" | "manual" | "missing" | "unavailable" | string;
};

type DemoBudgetState = {
  status: "loading" | "ok" | "partial" | "error" | string;
  checkedAt: string | null;
  items: DemoBudgetItem[];
};

const navItems: Array<{
  key: PageKey;
  label: string;
  icon: typeof MessageSquare;
  badge?: string;
}> = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "markets", label: "Markets", icon: LayoutGrid },
  { key: "ideas", label: "Market Ideas", icon: Newspaper },
  { key: "sources", label: "Sources", icon: Landmark },
  { key: "activity", label: "Activity", icon: ReceiptText },
  { key: "system", label: "System", icon: Settings2 },
];

const defaultPage: PageKey = "chat";
const chatThreadsStorageKey = "agora-market-intel-chat-threads";
const chatThreadsBackupStorageKey = "agora-market-intel-chat-threads-backup";
const legacyChatStorageKey = "agora-market-intel-chat";
const linkedMarketsStorageKey = "agora-market-intel-linked-markets";
const newsBitesStorageKey = "agora-market-intel-news-bites-v2";

function readPageFromHash(hash: string): PageKey {
  const page = hash.replace("#", "") as PageKey;
  return navItems.some((item) => item.key === page) ? page : defaultPage;
}

function readPageFromPath(pathname: string): PageKey {
  const page = pathname.replace(/^\/+/, "").split("/")[0] as PageKey;
  return navItems.some((item) => item.key === page) ? page : defaultPage;
}

function readChatThreadIdFromPath(pathname: string) {
  const [page, threadId] = pathname.replace(/^\/+/, "").split("/");
  return page === "chat" && threadId ? decodeURIComponent(threadId) : "";
}

function pageToPath(page: PageKey) {
  return `/${page}`;
}

function chatThreadPath(threadId: string) {
  return `/chat/${encodeURIComponent(threadId)}`;
}

const eventIdeas: EventIdea[] = [
  {
    id: "tr-cpi-release",
    title: "Turkey CPI surprise window",
    source: "TURKSTAT / TCMB / local macro desk",
    category: "Turkey Macro",
    time: "Upcoming monthly release",
    score: 86,
    summary:
      "A short-duration market can ask whether the official annual CPI print exceeds the median economist consensus.",
    question: "Will Turkey's next annual CPI print exceed market consensus?",
  },
  {
    id: "try-volatility",
    title: "USD/TRY volatility after CBRT decision",
    source: "CBRT policy calendar",
    category: "FX / Rates",
    time: "Next rate decision",
    score: 78,
    summary:
      "Event-driven FX volatility is a natural prediction-market vertical if the resolution source and time window are precise.",
    question: "Will USD/TRY move more than 2% within 24 hours after the next CBRT rate decision?",
  },
  {
    id: "competition-flow",
    title: "Competition integrity flow watch",
    source: "Trade-flow scanner / community reports",
    category: "Competition Integrity",
    time: "Watchlist",
    score: 72,
    summary:
      "Sports, esports, and other competition markets can be checked for form, lineup news, integrity history, and one-sided wallet concentration before settlement.",
    question: "Will a flagged competition market show abnormal one-sided pre-event prediction-market flow?",
  },
  {
    id: "election-calendar",
    title: "Turkey election and polling event calendar",
    source: "YSK / polling aggregators / local media",
    category: "Geopolitics",
    time: "Longer horizon",
    score: 69,
    summary:
      "Election-adjacent markets need careful source weighting and resolution language, but demand can be strong.",
    question: "Will the next major Turkey election polling average move by more than 5 points before election week?",
  },
  {
    id: "public-figure-legal-risk",
    title: "High-profile legal outcome market",
    source: "Courthouse records / prosecutor statements / credible local press",
    category: "Legal / Political Risk",
    time: "Watchlist",
    score: 74,
    summary:
      "When a public figure is detained or charged, the product can turn the news cycle into a watch-only market proposal with strict legal milestones and source discipline.",
    question:
      "Will a named public figure receive a formal conviction or sentence before a specified deadline?",
  },
];

const emptyGatewayState: GatewayState = {
  status: "loading",
  chain: "Polygon",
  balance: null,
  token: "USDC",
};

const emptyX402Snapshot: X402SnapshotState = {
  status: "loading",
  count: 0,
  markets: [],
  updatedAt: null,
};

const emptyIntegrityState: IntegrityState = {
  status: "loading",
  trades: 0,
  alerts: [],
  updatedAt: null,
};

const emptyResearchState: ResearchState = {
  status: "loading",
  snapshot: null,
  updatedAt: null,
};

const emptySentientResearchConfigState: SentientResearchConfigState = {
  status: "loading",
  missing: [],
};

const emptyDeepSearchState: DeepSearchState = {
  status: "loading",
  result: null,
};

const emptyAgentRunLedgerState: AgentRunLedgerState = {
  status: "loading",
  runs: [],
  updatedAt: null,
};

const emptyTradeIntentState: TradeIntentState = {
  status: "idle",
  intent: null,
};

const emptyIntentLedgerState: IntentLedgerState = {
  status: "loading",
  intents: [],
  updatedAt: null,
};

const emptyAgentPolicyState: AgentPolicyState = {
  status: "loading",
  evaluation: null,
};

const emptyRecordedIntentReceiptState: RecordedIntentReceiptState = {
  status: "loading",
  receipt: null,
  updatedAt: null,
};

const emptyReviewPackState: ReviewPackState = {
  status: "loading",
  pack: null,
};

const emptyProductReadinessState: ProductReadinessState = {
  status: "loading",
  blockers: [],
};

const starterMarketSpecs: MarketStudioSpec[] = marketDrafts.map((draft, index) => ({
  id: `starter-${index + 1}`,
  title: draft.title,
  vertical:
    draft.vertical === "FX / Rates" || draft.vertical === "Market Integrity"
      ? draft.vertical
      : "Turkey Macro",
  status: draft.vertical === "Market Integrity" ? "Watch-only" : "Design-ready",
  marketQuestion:
    draft.title === "Turkey CPI Surprise"
      ? "Will Turkey's next annual CPI print exceed market consensus?"
      : draft.title === "USD/TRY Volatility Window"
        ? "Will USD/TRY move more than 2% within 24 hours after the next CBRT decision?"
        : "Will a flagged competition market show abnormal one-sided pre-event prediction-market flow?",
  demand: draft.demand,
  settlementCurrency: draft.currency,
  oracle: {
    primarySource: draft.resolution,
    fallbackSource: "Curated source registry",
    resolutionWindow: "Event-specific window",
  },
  launchReadiness: draft.vertical === "Market Integrity" ? 0.58 : 0.74,
  sourceCoverage: {
    status: "partial",
    coverage: 0.66,
  },
}));

const starterSourceRecords: SourceRegistryState["records"] = starterSourceRegistry.map(
  (record, index) => ({
    id: `starter-source-${index + 1}`,
    name: record.name,
    type: record.type,
    coverage: record.coverage,
    credibility: record.credibility,
    role: record.role,
    domains: [],
    notes: "Starter source. Add exact domains or accounts in the Sources menu.",
    weight: record.credibility === "Resolution-grade" ? 0.95 : 0.62,
    status: record.credibility === "Weighted" ? "Needs curation" : "Active",
  }),
);

const emptyMarketStudioState: MarketStudioState = {
  status: "starter",
  specs: starterMarketSpecs,
};

const emptySourceRegistryState: SourceRegistryState = {
  status: "starter",
  records: starterSourceRecords,
};

const emptyNewsBiteState: NewsBiteState = {
  status: "idle",
  items: [],
  updatedAt: null,
};

const plannedPaidResearchServices = [
  {
    label: "Polymarket markets",
    detail: "Fetching live market price, status, outcomes, and liquidity context.",
  },
  {
    label: "Polymarket trades",
    detail: "Checking recent flow for one-sided bets, large wallets, and timing anomalies.",
  },
  {
    label: "Polymarket top holders",
    detail: "Fetching largest returned wallets, side exposure, shares, and visible value for this exact market.",
  },
  {
    label: "Polymarket orderbooks",
    detail: "Checking venue depth, latest orderbook shape, and possible slippage.",
  },
  {
    label: "Polymarket candlesticks",
    detail: "Reading market price movement and volume history when a market hash is available.",
  },
  {
    label: "AIsa Polymarket markets",
    detail: "Looking for matching Polymarket markets and venue pricing context.",
  },
  {
    label: "AIsa Polymarket price/orderbook",
    detail: "Cross-checking token price and book depth through a second market-data provider.",
  },
  {
    label: "Parallel web search",
    detail: "Running a second structured web-search pass for corroboration.",
  },
  {
    label: "Tavily web search",
    detail: "Pulling broader web context for the exact event.",
  },
  {
    label: "Perplexity Sonar",
    detail: "Requesting a concise research memo with citations.",
  },
  {
    label: "Perplexity Deep Research",
    detail: "Asking for deeper source discovery when the market is ambiguous.",
  },
  {
    label: "AIsa X search",
    detail: "Scanning recent X/social discussion for early signals and hype.",
  },
  {
    label: "AIsa CoinGecko",
    detail: "Adding crypto category context when the market touches crypto or macro risk.",
  },
];

export function Dashboard({
  initialPage = defaultPage,
  initialData = {},
}: {
  initialPage?: PageKey;
  initialData?: DashboardInitialData;
}) {
  const [activePage, setActivePage] = useState<PageKey>(initialPage);
  const [selectedMarketId, setSelectedMarketId] = useState("");
  const [arcState, setArcState] = useState<ArcState>(initialData.arcState ?? emptyArcState);
  const [gatewayState, setGatewayState] = useState<GatewayState>(
    initialData.gatewayState ?? emptyGatewayState,
  );
  const [x402Snapshot, setX402Snapshot] = useState<X402SnapshotState>(
    initialData.x402Snapshot ?? emptyX402Snapshot,
  );
  const [integrityState, setIntegrityState] = useState<IntegrityState>(
    initialData.integrityState ?? emptyIntegrityState,
  );
  const [researchState, setResearchState] = useState<ResearchState>(
    initialData.researchState ?? emptyResearchState,
  );
  const [sentientResearchConfig, setSentientResearchConfig] =
    useState<SentientResearchConfigState>(
      initialData.sentientResearchConfig ?? emptySentientResearchConfigState,
    );
  const [deepSearchState, setDeepSearchState] = useState<DeepSearchState>(
    initialData.deepSearchState ?? emptyDeepSearchState,
  );
  const [agentRunLedgerState, setAgentRunLedgerState] =
    useState<AgentRunLedgerState>(
      initialData.agentRunLedgerState ?? emptyAgentRunLedgerState,
    );
  const [tradeIntentState, setTradeIntentState] = useState<TradeIntentState>(emptyTradeIntentState);
  const [intentLedgerState, setIntentLedgerState] =
    useState<IntentLedgerState>(initialData.intentLedgerState ?? emptyIntentLedgerState);
  const [agentPolicyState, setAgentPolicyState] =
    useState<AgentPolicyState>(initialData.agentPolicyState ?? emptyAgentPolicyState);
  const [recordedIntentReceiptState, setRecordedIntentReceiptState] =
    useState<RecordedIntentReceiptState>(
      initialData.recordedIntentReceiptState ?? emptyRecordedIntentReceiptState,
    );
  const [reviewPackState, setReviewPackState] =
    useState<ReviewPackState>(initialData.reviewPackState ?? emptyReviewPackState);
  const [productReadinessState, setProductReadinessState] =
    useState<ProductReadinessState>(
      initialData.productReadinessState ?? emptyProductReadinessState,
    );
  const [marketStudioState, setMarketStudioState] =
    useState<MarketStudioState>(initialData.marketStudioState ?? emptyMarketStudioState);
  const [sourceRegistryState, setSourceRegistryState] =
    useState<SourceRegistryState>(
      initialData.sourceRegistryState ?? emptySourceRegistryState,
    );
  const [newsBiteState, setNewsBiteState] = useState<NewsBiteState>(emptyNewsBiteState);
  const [selectedProposal, setSelectedProposal] = useState<EventIdea | null>(null);
  const [linkedMarkets, setLinkedMarkets] = useState<MarketCandidate[]>([]);
  const [marketSearch, setMarketSearch] = useState("");
  const [marketLinkInput, setMarketLinkInput] = useState("");
  const [linkedMarketsStorageReady, setLinkedMarketsStorageReady] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [runState, setRunState] = useState<"idle" | "running" | "complete">("idle");
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [routeThreadId, setRouteThreadId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatTrace, setChatTrace] = useState<AgentTraceStep[]>([]);
  const [chatStorageReady, setChatStorageReady] = useState(false);
  const [newsBiteCacheReady, setNewsBiteCacheReady] = useState(false);
  const [showRecents, setShowRecents] = useState(false);
  const runAbortControllerRef = useRef<AbortController | null>(null);
  const deletedThreadIdsRef = useRef(new Set<string>());
  const loadedRouteThreadIdRef = useRef("");
  const [sourceForm, setSourceForm] = useState<SourceFormState>({
    name: "",
    type: "Local press",
    coverage: "",
    credibility: "High",
    role: "",
    domains: "",
    status: "Active",
    notes: "",
  });
  const [sourceSaveState, setSourceSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    const syncPage = () => {
      const nextPage = window.location.hash
        ? readPageFromHash(window.location.hash)
        : readPageFromPath(window.location.pathname);
      setActivePage(nextPage);
      setRouteThreadId(nextPage === "chat" ? readChatThreadIdFromPath(window.location.pathname) : "");
    };

    syncPage();
    window.addEventListener("hashchange", syncPage);
    window.addEventListener("popstate", syncPage);

    return () => {
      window.removeEventListener("hashchange", syncPage);
      window.removeEventListener("popstate", syncPage);
    };
  }, []);

  useEffect(() => {
    if (activePage !== "chat" || !routeThreadId) return;
    if (loadedRouteThreadIdRef.current === routeThreadId) return;
    const thread = chatThreads.find((item) => item.id === routeThreadId);
    if (!thread) return;

    loadedRouteThreadIdRef.current = thread.id;
    setActiveThreadId(thread.id);
    setChatMessages(thread.messages);
    setChatTrace([]);
  }, [activePage, routeThreadId, chatThreads]);

  useEffect(() => {
    try {
      const savedThreads = window.localStorage.getItem(chatThreadsStorageKey);
      if (savedThreads !== null) {
        const parsedThreads = JSON.parse(savedThreads) as ChatThread[];
        const validThreads = Array.isArray(parsedThreads)
          ? parsedThreads.filter(isChatThread).slice(0, 40)
          : [];

        if (validThreads.length > 0) {
          setChatThreads(validThreads);
          return;
        }
      }

      const backupThreads = window.localStorage.getItem(chatThreadsBackupStorageKey);
      if (backupThreads !== null) {
        const parsedBackupThreads = JSON.parse(backupThreads) as ChatThread[];
        const validBackupThreads = Array.isArray(parsedBackupThreads)
          ? parsedBackupThreads.filter(isChatThread).slice(0, 40)
          : [];

        setChatThreads(validBackupThreads);
        return;
      }

      const legacy = window.localStorage.getItem(legacyChatStorageKey);
      if (!legacy) return;

      const parsed = JSON.parse(legacy) as ChatMessage[];
      const legacyMessages = Array.isArray(parsed)
        ? parsed.filter(isChatMessage).slice(-24)
        : [];

      if (legacyMessages.length > 0) {
        const thread = buildChatThreadFromMessages(legacyMessages);
        setChatThreads([thread]);
      }
    } catch {
      // Local chat history is a convenience only.
    } finally {
      setChatStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!chatStorageReady) return;

    try {
      const existing = window.localStorage.getItem(chatThreadsStorageKey);
      if (existing && chatThreads.length > 0) {
        try {
          const existingThreads = JSON.parse(existing) as ChatThread[];
          const validExistingThreads = Array.isArray(existingThreads)
            ? existingThreads.filter(isChatThread)
            : [];
          if (validExistingThreads.length > 0) {
            window.localStorage.setItem(chatThreadsBackupStorageKey, existing);
          }
        } catch {
          // Keep saving the current valid in-memory thread list.
        }
      }
      window.localStorage.setItem(chatThreadsStorageKey, JSON.stringify(chatThreads));
      window.localStorage.removeItem(legacyChatStorageKey);
    } catch {
      // Ignore storage limits; the live session state still works.
    }
  }, [chatThreads, chatStorageReady]);

  useEffect(() => {
    try {
      const savedMarkets = window.localStorage.getItem(linkedMarketsStorageKey);
      if (!savedMarkets) return;

      const parsedMarkets = JSON.parse(savedMarkets) as MarketCandidate[];
      const validMarkets = Array.isArray(parsedMarkets)
        ? parsedMarkets.filter(isStoredMarketCandidate).slice(0, 50)
        : [];

      if (validMarkets.length > 0) {
        setLinkedMarkets(validMarkets);
      }
    } catch {
      // Saved markets are a convenience; links can always be pasted again.
    } finally {
      setLinkedMarketsStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!linkedMarketsStorageReady) return;

    try {
      window.localStorage.setItem(
        linkedMarketsStorageKey,
        JSON.stringify(linkedMarkets.filter((market) => market.origin !== "x402").slice(0, 50)),
      );
    } catch {
      // Ignore browser storage limits; the in-memory market list still works.
    }
  }, [linkedMarkets, linkedMarketsStorageReady]);

  useEffect(() => {
    try {
      const savedNews = window.localStorage.getItem(newsBitesStorageKey);
      if (savedNews) {
        const parsed = JSON.parse(savedNews) as NewsBiteState;
        if (isNewsBiteState(parsed) && parsed.items.length > 0) {
          setNewsBiteState(parsed);
        }
      }
    } catch {
      // Cached discovery results are optional; a manual refresh can rebuild them.
    } finally {
      setNewsBiteCacheReady(true);
    }
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;
    if (deletedThreadIdsRef.current.has(activeThreadId)) return;

    setChatThreads((current) => {
      const lastMessage = chatMessages.at(-1);
      const updatedAt = lastMessage?.createdAt ?? new Date().toISOString();
      const title = deriveThreadTitle(chatMessages);
      const existing = current.find((thread) => thread.id === activeThreadId);
      const nextThread: ChatThread = {
        id: activeThreadId,
        title: title || existing?.title || "New chat",
        messages: chatMessages.slice(-80),
        updatedAt,
      };

      if (!existing) return [nextThread, ...current].slice(0, 40);

      return [
        nextThread,
        ...current.filter((thread) => thread.id !== activeThreadId),
      ].slice(0, 40);
    });
  }, [chatMessages, activeThreadId]);

  function navigatePage(page: PageKey) {
    setActivePage(page);
    if (typeof window === "undefined") return;

    const targetHash = `#${page}`;
    const targetPath = pageToPath(page);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else if (window.location.hash && window.location.hash !== targetHash) {
      window.history.replaceState(null, "", targetPath);
    }
  }

  function navigateChatThread(threadId: string) {
    setActivePage("chat");
    setRouteThreadId(threadId);
    if (typeof window === "undefined") return;

    const targetPath = chatThreadPath(threadId);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }

  function createRunController() {
    runAbortControllerRef.current?.abort();
    const controller = new AbortController();
    runAbortControllerRef.current = controller;
    return controller;
  }

  function releaseRunController(controller: AbortController) {
    if (runAbortControllerRef.current === controller) {
      runAbortControllerRef.current = null;
    }
  }

  function cancelCurrentRun() {
    const controller = runAbortControllerRef.current;
    if (!controller) {
      setRunState("idle");
      setChatTrace((current) => markTraceStopped(current));
      return;
    }

    controller.abort();
    runAbortControllerRef.current = null;
    setRunState("idle");
    setChatTrace((current) => markTraceStopped(current));
  }

  useEffect(() => {
    let alive = true;

    const load = async <T,>(url: string, fallback: T, setter: (data: T) => void) => {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const data = (await response.json()) as T;
        if (alive) setter(data);
      } catch {
        if (alive) setter(fallback);
      }
    };

    void load("/api/arc/receipt", { ...emptyArcState, status: "error" }, setArcState);
    void load("/api/x402/gateway", { ...emptyGatewayState, status: "unavailable" }, setGatewayState);
    void load("/api/x402/snapshot", { ...emptyX402Snapshot, status: "error" }, setX402Snapshot);
    void load("/api/x402/integrity", { ...emptyIntegrityState, status: "error" }, setIntegrityState);
    void load("/api/x402/research", { ...emptyResearchState, status: "error" }, setResearchState);
    void load(
      "/api/sentient/opendeepsearch",
      { ...emptySentientResearchConfigState, status: "error" },
      setSentientResearchConfig,
    );
    void load("/api/sentient/deep-search", { ...emptyDeepSearchState, status: "error" }, (data: {
      runtime?: DeepSearchState["runtime"];
    }) => {
      setDeepSearchState({
        status: data.runtime?.status ?? "error",
        runtime: data.runtime,
        result: null,
      });
    });
    void load("/api/agent/run", { ...emptyAgentRunLedgerState, status: "error" }, setAgentRunLedgerState);
    void load("/api/agent/intent", { ...emptyIntentLedgerState, status: "error" }, setIntentLedgerState);
    void load("/api/agent/policy", { ...emptyAgentPolicyState, status: "error" }, setAgentPolicyState);
    void load(
      "/api/arc/intent-receipt",
      { ...emptyRecordedIntentReceiptState, status: "error" },
      setRecordedIntentReceiptState,
    );
    void load("/api/demo/review-pack", { ...emptyReviewPackState, status: "error" }, setReviewPackState);
    void load(
      "/api/product/readiness",
      { ...emptyProductReadinessState, status: "error" },
      setProductReadinessState,
    );
    void load("/api/studio/markets", { ...emptyMarketStudioState, status: "error" }, setMarketStudioState);
    void load("/api/sources/registry", { ...emptySourceRegistryState, status: "error" }, setSourceRegistryState);

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!newsBiteCacheReady || activePage !== "ideas" || newsBiteState.status !== "idle") return;
    void refreshNewsBites();
  }, [activePage, newsBiteState.status, newsBiteCacheReady]);

  async function refreshNewsBites() {
    setNewsBiteState((current) => ({
      ...current,
      status: "loading",
      message: undefined,
    }));

    try {
      const response = await fetch("/api/ideas/news-bites", { cache: "no-store" });
      const data = (await response.json()) as NewsBiteState;

      if (!response.ok || data.status !== "ok") {
        setNewsBiteState({
          status: "error",
          items: [],
          updatedAt: null,
          message: data.message ?? "News discovery failed.",
        });
        return;
      }

      setNewsBiteState(data);
      try {
        window.localStorage.setItem(newsBitesStorageKey, JSON.stringify(data));
      } catch {
        // Keep the in-memory result even if browser storage is unavailable.
      }
    } catch (error) {
      setNewsBiteState({
        status: "error",
        items: [],
        updatedAt: null,
        message: error instanceof Error ? error.message : "News discovery failed.",
      });
    }
  }

  const marketCandidates = useMemo(() => {
    const paidMarkets = x402Snapshot.markets.filter(isDisplayableX402Market).map(mapX402Market);
    const byId = new Map<string, MarketCandidate>();

    [...linkedMarkets, ...paidMarkets].forEach((market) => {
      byId.set(market.id, market);
    });

    return Array.from(byId.values());
  }, [linkedMarkets, x402Snapshot.markets]);

  const filteredMarkets = useMemo(() => {
    const query = marketSearch.trim().toLowerCase();
    if (!query) return marketCandidates;

    return marketCandidates.filter((market) =>
      [market.question, market.category, market.venue, market.signal]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [marketCandidates, marketSearch]);
  const marketRecents = useMemo(
    () => buildMarketRecents(agentRunLedgerState.runs),
    [agentRunLedgerState.runs],
  );

  const selectedMarket =
    marketCandidates.find((market) => market.id === selectedMarketId) ??
    filteredMarkets[0] ??
    marketCandidates[0];
  const selectedRun =
    selectedMarket
      ? agentRunLedgerState.runs.find((run) => isRunForMarket(run, selectedMarket))
      : undefined;
  const selectedAlert =
    selectedMarket
      ? integrityState.alerts.find((alert) => {
          const selectedId = selectedMarket.id.replace(/^x402-/, "");
          return (
            alert.marketId === selectedId ||
            alert.marketId === selectedMarket.id ||
            alert.market.toLowerCase() === selectedMarket.question.toLowerCase()
          );
        }) ?? null
      : null;
  const sizing = selectedMarket
    ? estimatePositionSize({
        marketProbability: selectedRun?.analysis?.marketProbability ?? selectedMarket.probability,
        agentProbability: selectedRun?.analysis?.agentProbability ?? selectedMarket.agentProbability,
        confidence: selectedRun?.confidence ?? selectedMarket.confidence,
        risk: selectedRun?.analysis?.inputRisk ?? selectedMarket.risk,
      })
    : null;

  async function runAgent(
    market: MarketCandidate,
    override?: Partial<MarketCandidate>,
    options: { navigate?: boolean; signal?: AbortSignal } = {},
  ) {
    const target = { ...market, ...override };
    const ownedController = options.signal ? null : createRunController();
    const signal = options.signal ?? ownedController?.signal;

    setSelectedMarketId(target.id);
    if (options.navigate !== false) {
      navigatePage("markets");
    }
    setRunState("running");
    setChatTrace(buildAgentTrace("running"));

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          marketId: target.id,
          market: target.question,
          venue: target.venue,
          category: target.category,
          marketProbability: target.probability,
          agentProbability: target.agentProbability,
          confidence: target.confidence,
          risk: target.risk,
          sources: target.sources,
          marketPriceLabel: target.marketPriceLabel,
          originalUrl: target.originalUrl,
          marketSlug: target.marketSlug,
          conditionId: target.conditionId,
          tokenIds: target.tokenIds,
          outcomeSummary: target.outcomeSummary,
        }),
      });
      const data = (await response.json()) as {
        status: "ok" | "error";
        ledger?: {
          runs: AgentRunRecord[];
          updatedAt: string | null;
        };
        message?: string;
      };

      if (signal?.aborted) {
        setRunState("idle");
        setChatTrace((current) => markTraceStopped(current));
        return null;
      }

      if (!response.ok || data.status !== "ok" || !data.ledger) {
        setAgentRunLedgerState((current) => ({
          ...current,
          status: "error",
          message: data.message ?? "Agent analysis failed.",
        }));
        setRunState("idle");
        return null;
      }

      setAgentRunLedgerState({
        status: "ok",
        runs: data.ledger.runs,
        updatedAt: data.ledger.updatedAt,
      });
      rememberMarket(target);
      await refreshReviewPack();
      setRunState("complete");
      const completedRun = data.ledger.runs[0] ?? null;
      setChatTrace(buildAgentTrace(completedRun ? "complete" : "blocked", completedRun));
      return completedRun;
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        setRunState("idle");
        setChatTrace((current) => markTraceStopped(current));
        return null;
      }

      setAgentRunLedgerState((current) => ({
        ...current,
        status: "error",
        message: error instanceof Error ? error.message : "Agent analysis failed.",
      }));
      setRunState("idle");
      return null;
    } finally {
      if (ownedController) releaseRunController(ownedController);
    }
  }

  function startNewChatThread() {
    const thread: ChatThread = {
      id: `thread-${Date.now()}`,
      title: "New chat",
      messages: [],
      updatedAt: new Date().toISOString(),
    };

    setChatThreads((current) => [thread, ...current].slice(0, 40));
    setActiveThreadId(thread.id);
    loadedRouteThreadIdRef.current = thread.id;
    setChatMessages([]);
    setChatInput("");
    setChatTrace([]);
    navigateChatThread(thread.id);
  }

  function selectChatThread(threadId: string) {
    const thread = chatThreads.find((item) => item.id === threadId);
    if (!thread) return;

    setActiveThreadId(thread.id);
    loadedRouteThreadIdRef.current = thread.id;
    setChatMessages(thread.messages);
    setChatTrace([]);
    navigateChatThread(thread.id);
  }

  function selectMarketRecent(marketId: string) {
    const run = agentRunLedgerState.runs.find((item) => item.marketId === marketId);
    const market =
      marketCandidates.find((item) => item.id === marketId) ??
      linkedMarkets.find((item) => item.id === marketId) ??
      (run ? marketFromRun(run) : null);

    if (!market) return;

    rememberMarket(market);
    setSelectedMarketId(market.id);
    navigatePage("markets");
  }

  function rememberMarket(market: MarketCandidate) {
    if (market.origin === "x402") return;
    setLinkedMarkets((current) => [
      market,
      ...current.filter((item) => item.id !== market.id),
    ].slice(0, 50));
  }

  function deleteChatThread(threadId: string) {
    deletedThreadIdsRef.current.add(threadId);
    const remaining = chatThreads.filter((thread) => thread.id !== threadId);
    setChatThreads(remaining);
    if (remaining.length === 0 && typeof window !== "undefined") {
      window.localStorage.removeItem(chatThreadsBackupStorageKey);
    }

    if (activeThreadId === threadId) {
      setActiveThreadId("");
      loadedRouteThreadIdRef.current = "";
      setChatMessages([]);
      setChatTrace([]);
      setRouteThreadId("");
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", "/chat");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  }

  function ensureChatThread(prompt: string) {
    if (activeThreadId) return activeThreadId;

    const thread: ChatThread = {
      id: `thread-${Date.now()}`,
      title: titleFromPrompt(prompt),
      messages: [],
      updatedAt: new Date().toISOString(),
    };

    setChatThreads((current) => [thread, ...current].slice(0, 40));
    setActiveThreadId(thread.id);
    loadedRouteThreadIdRef.current = thread.id;
    navigateChatThread(thread.id);
    return thread.id;
  }

  async function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = chatInput.trim();
    if (!prompt) return;
    ensureChatThread(prompt);
    const controller = createRunController();

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: prompt,
      createdAt: new Date().toISOString(),
    };
    setChatMessages((current) => [...current, userMessage]);
    setChatInput("");
    const runningTrace = buildAgentTrace("running");
    setChatTrace(runningTrace);

    try {
      const linkedMarket = await buildMarketFromPrompt(prompt, controller.signal);
      if (controller.signal.aborted) {
        appendStoppedChatMessage(runningTrace);
        return;
      }

      const draftMarket: MarketCandidate =
        linkedMarket ?? {
          id: buildClientRunId(prompt),
          venue: "Draft",
          question: prompt,
          category: detectPromptCategory(prompt),
          probability: null,
          volume: "Draft",
          liquidity: "Needs discovery",
          endDate: "Open",
          signal: "Watch",
          risk: "Medium",
          agentProbability: 0.58,
          confidence: 0.62,
          sources: ["User prompt", "Circle x402 research", "OpenDeepSearch", "Source registry"],
          origin: "linked",
        };

      rememberMarket(draftMarket);
      const run = await runAgent(draftMarket, undefined, { navigate: false, signal: controller.signal });

      if (controller.signal.aborted) {
        appendStoppedChatMessage(runningTrace);
        return;
      }

      const completedTrace = buildAgentTrace(run ? "complete" : "blocked", run);
      setChatTrace(completedTrace);
      setChatMessages((current) => [
        ...current,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          text: run
            ? `${formatActionLabel(run.modelAnalysis?.recommendation ?? run.action)} / ${run.modelAnalysis?.riskGate ?? run.riskGate}: ${run.modelAnalysis?.summary ?? run.summary}`
            : "I could not complete the analysis. Check the Activity or System tab for details.",
          run,
          trace: completedTrace,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        appendStoppedChatMessage(runningTrace);
        return;
      }

      const failedTrace = buildAgentTrace("blocked");
      setChatTrace(failedTrace);
      setRunState("idle");
      setChatMessages((current) => [
        ...current,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          text: "I could not complete the analysis. Check the Activity or System tab for details.",
          trace: failedTrace,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      releaseRunController(controller);
    }
  }

  function appendStoppedChatMessage(baseTrace = chatTrace) {
    const stoppedTrace = markTraceStopped(baseTrace);
    setChatTrace(stoppedTrace);
    setRunState("idle");
    setChatMessages((current) => [
      ...current,
      {
        id: `agent-${Date.now()}`,
        role: "agent",
        text: "Analysis stopped. No intent, payment, or proof was created.",
        trace: stoppedTrace,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  async function stageIntent(
    requestedAction: TradeIntentAction,
    requestedSide: "AUTO" | "YES" | "NO" = "AUTO",
  ) {
    if (!selectedMarket) return;

    if (!selectedRun) {
      setTradeIntentState({
        status: "error",
        intent: tradeIntentState.intent,
        message: "Run analysis before staging a watch or bet intent.",
      });
      return;
    }

    setTradeIntentState({ status: "loading", intent: tradeIntentState.intent });

    try {
      const response = await fetch("/api/agent/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          marketId: selectedRun?.marketId ?? selectedMarket.id,
          market: selectedRun?.market ?? selectedMarket.question,
          requestedAction,
          requestedSide,
          marketProbability:
            selectedRun?.analysis?.marketProbability ?? selectedMarket.probability,
          agentProbability:
            selectedRun?.analysis?.agentProbability ?? selectedMarket.agentProbability,
          confidence: selectedRun?.confidence ?? selectedMarket.confidence,
          risk: selectedRun?.analysis?.inputRisk ?? selectedMarket.risk,
          marketPriceLabel: selectedRun?.marketPriceLabel ?? selectedMarket.marketPriceLabel,
          targetOutcome: selectedRun?.modelAnalysis?.tradePlan?.targetOutcome ?? null,
        }),
      });
      const data = (await response.json()) as TradeIntentState & {
        ledger?: IntentLedgerState;
      };

      if (!response.ok || data.status !== "ok") {
        setTradeIntentState({
          status: "error",
          intent: null,
          message: data.message ?? "Intent staging failed.",
        });
        return;
      }

      setTradeIntentState(data);
      if (data.ledger) setIntentLedgerState(data.ledger);
      await refreshReviewPack();
      await refreshPolicy();
    } catch (error) {
      setTradeIntentState({
        status: "error",
        intent: null,
        message: error instanceof Error ? error.message : "Intent staging failed.",
      });
    }
  }

  async function stageRunIntent(
    run: AgentRunRecord,
    requestedAction: TradeIntentAction,
    requestedSide: "AUTO" | "YES" | "NO" = "AUTO",
  ) {
    setTradeIntentState({ status: "loading", intent: tradeIntentState.intent });

    try {
      const response = await fetch("/api/agent/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          marketId: run.marketId,
          market: run.market,
          requestedAction,
          requestedSide,
          marketProbability: run.analysis?.marketProbability ?? null,
          agentProbability: run.analysis?.agentProbability ?? 0.5,
          confidence: run.modelAnalysis?.confidence ?? run.confidence,
          risk: run.analysis?.inputRisk ?? "Medium",
          marketPriceLabel: run.marketPriceLabel,
          targetOutcome: run.modelAnalysis?.tradePlan?.targetOutcome ?? null,
          origin: "user",
          hasHumanApproval: true,
        }),
      });
      const data = (await response.json()) as TradeIntentState & {
        ledger?: IntentLedgerState;
        message?: string;
      };

      if (!response.ok || data.status !== "ok") {
        setTradeIntentState({
          status: "error",
          intent: null,
          message: data.message ?? "Intent staging failed.",
        });
        return;
      }

      setTradeIntentState(data);
      if (data.ledger) setIntentLedgerState(data.ledger);
      await refreshReviewPack();
      await refreshPolicy();
    } catch (error) {
      setTradeIntentState({
        status: "error",
        intent: null,
        message: error instanceof Error ? error.message : "Intent staging failed.",
      });
    }
  }

  async function runPaidResearch(run: AgentRunRecord) {
    const controller = createRunController();
    setRunState("running");
    const runningTrace = buildPaidResearchTrace("running", run);
    setChatTrace(runningTrace);

    try {
      const response = await fetch("/api/agent/live-research", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          marketId: run.marketId,
          market: run.market,
          venue: run.venue,
          category: run.category,
          marketProbability: run.analysis?.marketProbability ?? null,
          agentProbability: run.analysis?.agentProbability ?? 0.5,
          confidence: run.modelAnalysis?.confidence ?? run.confidence,
          risk: run.analysis?.inputRisk ?? "Medium",
          marketPriceLabel: run.marketPriceLabel,
          sources: [
            ...new Set([
              ...run.sources,
              "Circle live x402 paid research",
              "AIsa Tavily",
              "AIsa Perplexity Sonar",
              "AIsa Perplexity Deep Research",
              "AIsa X/Twitter search",
              "AIsa CoinGecko",
              "AIsa Polymarket",
              "BlockRun X/Web/News",
              "BlockRun Polymarket",
              "OpenDeepSearch",
            ]),
          ],
          originalUrl: run.originalUrl,
          marketSlug: run.marketSlug,
          conditionId: run.conditionId,
          tokenIds: run.tokenIds,
          outcomeSummary: run.outcomeSummary,
          maxTotalUsdc: LIVE_X402_RESEARCH_BUDGET_USDC,
        }),
      });
      const data = (await response.json()) as {
        status: "ok" | "error";
        run?: AgentRunRecord;
        ledger?: {
          runs: AgentRunRecord[];
          updatedAt: string | null;
        };
        message?: string;
      };

      if (controller.signal.aborted) {
        appendStoppedChatMessage(runningTrace);
        return;
      }

      if (!response.ok || data.status !== "ok" || !data.run || !data.ledger) {
        setRunState("idle");
        setChatTrace(buildPaidResearchTrace("blocked", run));
        setChatMessages((current) => [
          ...current,
          {
            id: `agent-paid-error-${Date.now()}`,
            role: "agent",
            text: data.message ?? "Live x402 research could not be completed.",
            trace: buildPaidResearchTrace("blocked", run),
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }

      setAgentRunLedgerState({
        status: "ok",
        runs: data.ledger.runs,
        updatedAt: data.ledger.updatedAt,
      });
      const paidRun = data.run;
      const trace = buildPaidResearchTrace("complete", paidRun);
      setChatTrace(trace);
      setChatMessages((current) => [
        ...current,
        {
          id: `agent-paid-${Date.now()}`,
          role: "agent",
          text: `Paid research upgrade - ${formatActionLabel(paidRun.modelAnalysis?.recommendation ?? paidRun.action)} / ${paidRun.modelAnalysis?.riskGate ?? paidRun.riskGate}: Circle x402 services finished, and the new evidence was re-ingested by the research stack.`,
          run: paidRun,
          trace,
          createdAt: new Date().toISOString(),
        },
      ]);
      setRunState("complete");
      await refreshReviewPack();
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        appendStoppedChatMessage(runningTrace);
        return;
      }

      setRunState("idle");
      const trace = buildPaidResearchTrace("blocked", run);
      setChatTrace(trace);
      setChatMessages((current) => [
        ...current,
        {
          id: `agent-paid-error-${Date.now()}`,
          role: "agent",
          text: error instanceof Error ? error.message : "Live x402 research failed.",
          trace,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      releaseRunController(controller);
    }
  }

  async function analyzeIdea(idea: EventIdea) {
    const market: MarketCandidate = {
      id: `idea-${idea.id}`,
      venue: "Draft",
      question: idea.question,
      category: idea.category,
      probability: null,
      volume: "Idea",
      liquidity: "Needs market maker",
      endDate: idea.time,
      signal: "Watch",
      risk:
        idea.category === "Market Integrity" ||
        idea.category === "Competition Integrity" ||
        idea.category === "Legal / Political Risk"
          ? "High"
          : "Medium",
      agentProbability: idea.score / 100,
      confidence: Math.min(0.78, Math.max(0.5, idea.score / 100)),
      sources: [idea.source, "OpenDeepSearch", "Source registry"],
      origin: "demo",
    };

    setSelectedProposal(idea);
    rememberMarket(market);
    await runAgent(market);
  }

  async function buildMarketFromPrompt(prompt: string, signal?: AbortSignal): Promise<MarketCandidate | null> {
    const link = extractPredictionMarketLink(prompt);
    if (!link) return null;

    return buildLinkedMarketFromUrl(link, signal);
  }

  async function buildLinkedMarketFromUrl(link: string, signal?: AbortSignal): Promise<MarketCandidate> {
    const parsed = parsePredictionMarketLink(link);
    const preview = await fetchMarketPreview(link, signal);

    return {
      id: preview?.id ?? parsed.id,
      venue: preview?.venue ?? "Polymarket",
      question: preview?.question ?? parsed.question,
      category: preview?.category ?? parsed.category,
      probability: preview?.probability ?? null,
      volume: preview?.volume ?? "Linked market",
      liquidity: preview?.liquidity ?? "Manual analysis",
      endDate: preview?.endDate ?? "Open",
      signal: "Watch",
      risk: "Medium",
      agentProbability: preview?.probability ?? 0.5,
      confidence: preview?.probability === null || preview?.probability === undefined ? 0.55 : 0.58,
      sources: ["User-provided Polymarket link", "Circle x402 market data", "OpenDeepSearch", "Source registry"],
      origin: "linked",
      originalUrl: preview?.originalUrl ?? link,
      thumbnailUrl: preview?.imageUrl ?? null,
      marketSlug: preview?.marketSlug,
      conditionId: preview?.conditionId,
      tokenIds: preview?.tokenIds,
      outcomeSummary: preview?.outcomeSummary,
      marketPriceLabel:
        preview?.priceLabel ??
        formatMarketPriceLabel(preview?.probability ?? null),
    };
  }

  async function loadMarketLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const link = marketLinkInput.trim();
    if (!link) return;

    const market = await buildLinkedMarketFromUrl(link);

    rememberMarket(market);
    setSelectedMarketId(market.id);
    setMarketLinkInput("");
    navigatePage("markets");
  }

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSourceSaveState("saving");

    try {
      const response = await fetch("/api/sources/registry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: sourceForm.name,
          type: sourceForm.type,
          coverage: sourceForm.coverage,
          credibility: sourceForm.credibility,
          role: sourceForm.role,
          domains: sourceForm.domains
            .split(",")
            .map((domain) => domain.trim())
            .filter(Boolean),
          status: sourceForm.status,
          notes: sourceForm.notes || "User-added source for market discovery.",
        }),
      });
      const data = (await response.json()) as SourceRegistryState;

      if (!response.ok || data.status !== "ok") {
        setSourceSaveState("error");
        return;
      }

      setSourceRegistryState(data);
      setSourceSaveState("saved");
      setSourceForm({
        name: "",
        type: "Local press",
        coverage: "",
        credibility: "High",
        role: "",
        domains: "",
        status: "Active",
        notes: "",
      });
    } catch {
      setSourceSaveState("error");
    }
  }

  async function copyIdeaProposal(idea: EventIdea) {
    setSelectedProposal(idea);
    const text = [
      `Market proposal: ${idea.question}`,
      `Why it matters: ${idea.summary}`,
      `Category: ${idea.category}`,
      `Primary sources: ${idea.source}`,
      `Resolution: ${idea.resolutionHint ?? "Use an official source or a clearly timestamped venue result."}`,
      "Notes: This market should start as watch-only until oracle and liquidity assumptions are validated.",
    ].join("\n");

    await navigator.clipboard?.writeText(text);
  }

  async function refreshReviewPack() {
    const response = await fetch("/api/demo/review-pack", { cache: "no-store" });
    const data = (await response.json()) as ReviewPackState;
    setReviewPackState(data);
  }

  async function refreshPolicy() {
    const response = await fetch("/api/agent/policy", { cache: "no-store" });
    const data = (await response.json()) as AgentPolicyState;
    setAgentPolicyState(data);
  }

  async function refreshRecordedIntentReceipt() {
    const response = await fetch("/api/arc/intent-receipt", { cache: "no-store" });
    const data = (await response.json()) as RecordedIntentReceiptState;
    setRecordedIntentReceiptState(data);
  }

  async function recordArcProof(intentId?: string) {
    setRecordedIntentReceiptState((current) => ({
      ...current,
      status: "loading",
      message: "Recording Arc proof...",
    }));

    try {
      const response = await fetch("/api/arc/intent-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ intentId }),
      });
      const data = (await response.json()) as RecordedIntentReceiptState & {
        message?: string;
      };

      if (!response.ok || data.status !== "ok") {
        setRecordedIntentReceiptState((current) => ({
          ...current,
          status: "error",
          message: data.message ?? "Arc proof recording failed.",
          updatedAt: null,
        }));
        setTradeIntentState((current) => ({
          ...current,
          message: data.message ?? "Arc proof recording failed.",
        }));
        return;
      }

      setRecordedIntentReceiptState(data);
      setTradeIntentState((current) => ({
        ...current,
        message: undefined,
      }));
      await refreshReviewPack();
      await refreshRecordedIntentReceipt();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Arc proof recording failed.";
      setRecordedIntentReceiptState((current) => ({
        ...current,
        status: "error",
        message,
        updatedAt: null,
      }));
      setTradeIntentState((current) => ({
        ...current,
        message,
      }));
    }
  }

  return (
    <main className="mi-shell">
      <input
        aria-label="Collapse sidebar"
        className="mi-sidebarToggleInput"
        id="mi-sidebar-toggle"
        type="checkbox"
      />
      <label
        className="mi-iconButton mi-sidebarToggleButton"
        htmlFor="mi-sidebar-toggle"
        title="Toggle sidebar"
      >
        <PanelLeftClose className="closeIcon" size={16} />
        <PanelLeftOpen className="openIcon" size={16} />
      </label>
      <aside className="mi-sidebar" aria-label="Product navigation">
        <div className="mi-brand">
          <img
            src="/samsun.png"
            alt="Samsun Market Intel"
            className="mi-brandLogo"
          />
          <div>
            <strong>{productTone.name}</strong>
            <span>Prediction agent</span>
          </div>
        </div>

        <nav className="mi-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                className={activePage === item.key ? "mi-navItem active" : "mi-navItem"}
                href={pageToPath(item.key)}
                key={item.key}
                onClick={() => setActivePage(item.key)}
                title={item.label}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge ? <small>{item.badge}</small> : null}
              </a>
            );
          })}
        </nav>

        <SidebarRecents
          threads={chatThreads}
          marketRecents={marketRecents}
          activeThreadId={activeThreadId}
          activeMarketId={selectedMarketId}
          visible={showRecents}
          onToggle={() => setShowRecents((current) => !current)}
          onNewThread={startNewChatThread}
          onSelectThread={selectChatThread}
          onSelectMarket={selectMarketRecent}
          onDeleteThread={deleteChatThread}
        />

        <DemoBudgetPanel />
      </aside>

      <section className="mi-main">
        {activePage === "chat" ? (
          <ChatPage
            chatMessages={chatMessages}
            onSubmit={submitChat}
            onCancelRun={cancelCurrentRun}
            chatInput={chatInput}
            setChatInput={setChatInput}
            runState={runState}
            activeTrace={chatTrace}
            onStageRunIntent={stageRunIntent}
            onRunPaidResearch={runPaidResearch}
            onRecordArcProof={recordArcProof}
            tradeIntent={tradeIntentState}
            receipt={recordedIntentReceiptState}
          />
        ) : null}

        {activePage === "markets" ? (
          <MarketsPage
            marketSearch={marketSearch}
            setMarketSearch={setMarketSearch}
            markets={filteredMarkets}
            selectedMarket={selectedMarket}
            selectedRun={selectedRun}
            sizing={sizing}
            runState={runState}
            selectedAlert={selectedAlert}
            researchState={researchState}
            onSelect={setSelectedMarketId}
            onAnalyze={runAgent}
            marketLinkInput={marketLinkInput}
            setMarketLinkInput={setMarketLinkInput}
            onLoadLink={loadMarketLink}
            onStageIntent={stageIntent}
            onRunPaidResearch={runPaidResearch}
            onRecordArcProof={recordArcProof}
            tradeIntent={tradeIntentState}
            receipt={recordedIntentReceiptState}
            activeTrace={chatTrace}
          />
        ) : null}

        {activePage === "ideas" ? (
          <IdeasPage
            sourceCount={sourceRegistryState.records.length}
            newsBites={newsBiteState}
            selectedProposal={selectedProposal}
            onAnalyzeIdea={analyzeIdea}
            onCopyIdea={copyIdeaProposal}
            onRefreshNews={refreshNewsBites}
          />
        ) : null}

        {activePage === "sources" ? (
          <SourcesPage
            records={sourceRegistryState.records}
            sourceForm={sourceForm}
            setSourceForm={setSourceForm}
            saveState={sourceSaveState}
            onSave={saveSource}
          />
        ) : null}

        {activePage === "activity" ? (
          <ActivityPage
            runs={agentRunLedgerState.runs}
            intents={intentLedgerState.intents}
            receipt={recordedIntentReceiptState}
            tradeIntent={tradeIntentState}
            onRecordArcProof={recordArcProof}
          />
        ) : null}

        {activePage === "system" ? (
          <SystemPage
            arcState={arcState}
            gatewayState={gatewayState}
            x402Snapshot={x402Snapshot}
            integrityState={integrityState}
            researchState={researchState}
            sentientResearchConfig={sentientResearchConfig}
            deepSearchState={deepSearchState}
            reviewPackState={reviewPackState}
            productReadinessState={productReadinessState}
            policyState={agentPolicyState}
            sourceRegistryState={sourceRegistryState}
          />
        ) : null}

      </section>
    </main>
  );
}

function ChatPage({
  chatMessages,
  chatInput,
  setChatInput,
  onSubmit,
  onCancelRun,
  runState,
  activeTrace,
  onStageRunIntent,
  onRunPaidResearch,
  onRecordArcProof,
  tradeIntent,
  receipt,
}: {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelRun: () => void;
  runState: "idle" | "running" | "complete";
  activeTrace: AgentTraceStep[];
  onStageRunIntent: (
    run: AgentRunRecord,
    action: TradeIntentAction,
    side?: "AUTO" | "YES" | "NO",
  ) => void;
  onRunPaidResearch: (run: AgentRunRecord) => void;
  onRecordArcProof: (intentId?: string) => void;
  tradeIntent: TradeIntentState;
  receipt: RecordedIntentReceiptState;
}) {
  const hasMessages = chatMessages.length > 0;

  return (
    <section className="mi-chatWorkspace">
      <section className={hasMessages ? "mi-chatSession" : "mi-chatHome"}>
        {!hasMessages ? (
          <motion.div
            className="mi-chatIntro"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <h1>
              Ask <span>Samsun Market Intel</span>
            </h1>
            <p>
              Paste a Polymarket link, ask for a probability memo, or describe an event that may deserve a prediction market.
            </p>
          </motion.div>
        ) : null}

        {hasMessages ? (
          <div className="mi-chatTranscript">
            <AnimatePresence initial={false}>
              {chatMessages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <ChatMessageBubble
                    message={message}
                    onStageRunIntent={onStageRunIntent}
                    onRunPaidResearch={onRunPaidResearch}
                    onRecordArcProof={onRecordArcProof}
                    tradeIntent={tradeIntent}
                    receipt={receipt}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            {runState === "running" ? <AgentTrace steps={activeTrace} compact /> : null}
          </div>
        ) : null}

        <div className={hasMessages ? "mi-chatComposerDock" : ""}>
          {runState === "running" && !hasMessages ? <AgentTrace steps={activeTrace} compact /> : null}
          <form className="mi-chatBox" onSubmit={onSubmit}>
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Ask about a prediction market, paste a Polymarket link, or describe an event worth pricing..."
            />
            <div>
              {runState === "running" ? (
                <button
                  type="button"
                  className="mi-stopButton"
                  title="Stop current analysis"
                  onClick={onCancelRun}
                >
                  <Square size={13} />
                </button>
              ) : null}
              <button
                type="submit"
                className="mi-sendButton"
                title="Run agent"
                disabled={runState === "running" || !chatInput.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </section>
    </section>
  );
}

function SidebarRecents({
  threads,
  marketRecents,
  activeThreadId,
  activeMarketId,
  visible,
  onToggle,
  onNewThread,
  onSelectThread,
  onSelectMarket,
  onDeleteThread,
}: {
  threads: ChatThread[];
  marketRecents: MarketRecent[];
  activeThreadId: string;
  activeMarketId: string;
  visible: boolean;
  onToggle: () => void;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  onSelectMarket: (marketId: string) => void;
  onDeleteThread: (threadId: string) => void;
}) {
  const [showAnalyzedMarkets, setShowAnalyzedMarkets] = useState(false);

  return (
    <section className={visible ? "mi-recents open" : "mi-recents"} aria-label="Recent chats">
      <button
        type="button"
        className="mi-recentsToggle"
        onClick={onToggle}
        aria-expanded={visible}
      >
        <span>Recents</span>
        <small>{visible ? "Hide" : "Show"}</small>
      </button>

      <AnimatePresence initial={false}>
        {visible ? (
          <motion.div
            className="mi-recentsList"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <button type="button" className="mi-recentsNew" onClick={onNewThread}>
              <Plus size={13} />
              New chat
            </button>
            {threads.length === 0 && marketRecents.length === 0 ? (
              <p>No saved chats yet.</p>
            ) : null}

            {marketRecents.length > 0 ? (
              <div className="mi-recentsGroup">
                <button
                  type="button"
                  className="mi-recentsGroupToggle"
                  onClick={() => setShowAnalyzedMarkets((current) => !current)}
                  aria-expanded={showAnalyzedMarkets}
                >
                  <span>Analyzed markets</span>
                  <small>{showAnalyzedMarkets ? "Hide" : "Show"}</small>
                </button>
                <AnimatePresence initial={false}>
                  {showAnalyzedMarkets ? (
                    <motion.div
                      className="mi-recentsSubList"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                    >
                      {marketRecents.map((market, index) => (
                        <motion.div
                          className={market.id === activeMarketId ? "mi-recentThread active" : "mi-recentThread"}
                          key={market.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -4 }}
                          transition={{ duration: 0.16, delay: Math.min(index * 0.025, 0.16) }}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectMarket(market.id)}
                            title={`${market.title} - ${market.venue}`}
                          >
                            {market.title}
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}

            {threads.length > 0 ? (
              <div className="mi-recentsGroup">
                <small>Chats</small>
                {threads.map((thread, index) => (
                <motion.div
                  className={thread.id === activeThreadId ? "mi-recentThread active" : "mi-recentThread"}
                  key={thread.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -4 }}
                  transition={{ duration: 0.16, delay: Math.min(index * 0.025, 0.16) }}
                >
                  <button type="button" onClick={() => onSelectThread(thread.id)} title={`${thread.title} · ${thread.id}`}>
                    {thread.title}
                  </button>
                  <button
                    type="button"
                    className="mi-recentDelete"
                    onClick={() => onDeleteThread(thread.id)}
                    title="Delete chat"
                  >
                    <Trash2 size={12} />
                  </button>
                </motion.div>
                ))}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function DemoBudgetPanel() {
  const [budget, setBudget] = useState<DemoBudgetState>({
    status: "loading",
    checkedAt: null,
    items: [],
  });

  useEffect(() => {
    let alive = true;

    async function loadBudget() {
      try {
        const response = await fetch("/api/demo/budget", { cache: "no-store" });
        const data = (await response.json()) as DemoBudgetState;
        if (alive) setBudget(data);
      } catch {
        if (alive) {
          setBudget({
            status: "error",
            checkedAt: new Date().toISOString(),
            items: [],
          });
        }
      }
    }

    void loadBudget();
    const interval = window.setInterval(loadBudget, 90_000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  const checkedLabel = budget.checkedAt
    ? new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(budget.checkedAt))
    : "checking";

  return (
    <section className="mi-budgetPanel" aria-label="Demo credits">
      <div className="mi-budgetHeader">
        <span>Demo credits</span>
        <small>{checkedLabel}</small>
      </div>
      {budget.items.length > 0 ? (
        <div className="mi-budgetList">
          {budget.items.map((item) => (
            <div className={`mi-budgetItem ${item.status}`} key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              <b>{item.value}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="mi-budgetEmpty">
          {budget.status === "loading" ? "Checking balances..." : "Budget status unavailable."}
        </p>
      )}
    </section>
  );
}

function ChatMessageBubble({
  message,
  onStageRunIntent,
  onRunPaidResearch,
  onRecordArcProof,
  tradeIntent,
  receipt,
}: {
  message: ChatMessage;
  onStageRunIntent: (
    run: AgentRunRecord,
    action: TradeIntentAction,
    side?: "AUTO" | "YES" | "NO",
  ) => void;
  onRunPaidResearch: (run: AgentRunRecord) => void;
  onRecordArcProof: (intentId?: string) => void;
  tradeIntent: TradeIntentState;
  receipt: RecordedIntentReceiptState;
}) {
  const run = message.run ?? null;
  const recommendedSide = run ? recommendedSideForRun(run) : "NONE";
  const canStageBet = Boolean(run && recommendedSide !== "NONE" && (run.modelAnalysis?.riskGate ?? run.riskGate) !== "blocked");
  const latestIntentForRun =
    run && tradeIntent.intent?.marketId === run.marketId ? tradeIntent.intent : null;
  const proofForLatestIntent =
    latestIntentForRun && receipt.receipt?.intent?.id === latestIntentForRun.id
      ? receipt.receipt
      : null;
  const paidServicesForRun = run ? visiblePaidResearchServices(run) : [];
  const hasPaidResearch = Boolean(run?.paidResearch);
  const manualLeanNote = run ? buildManualLeanNote(run) : null;
  const tradePlan = run?.modelAnalysis?.tradePlan ?? null;
  const agentIntentLabel = formatAgentIntentLabel(tradePlan, recommendedSide);

  return (
    <article className={`mi-message ${message.role}`}>
      <div className="mi-messageHeader">
        <strong>{message.role === "agent" ? "Agent" : "You"}</strong>
        {message.createdAt ? <span>{formatTime(message.createdAt)}</span> : null}
      </div>
      <p>{cleanUserFacingText(message.text)}</p>

      {message.trace && message.trace.length > 0 ? <AgentTrace steps={message.trace} collapsible /> : null}

      {run ? (
        <div className="mi-chatRunCard">
          <div className="mi-chatRunGrid">
            <DataPoint label="Decision" value={formatActionLabel(run.modelAnalysis?.recommendation ?? run.action)} />
            <DataPoint label="Risk gate" value={run.modelAnalysis?.riskGate ?? run.riskGate} />
            <DataPoint label="Venue price" value={formatRunMarketPrice(run)} />
            <DataPoint label="Confidence" value={formatPercent(run.modelAnalysis?.confidence ?? run.confidence)} />
            <DataPoint label="Stake" value={formatStake(run.sizing.stakeUsdc)} />
          </div>
          <IntegrityBadge run={run} />
          <ConfidenceBreakdown run={run} />
          <TradePlanCard run={run} />

          {run.modelAnalysis?.thesis ? (
            <section>
              <strong>Thesis</strong>
              <p>{cleanUserFacingText(run.modelAnalysis.thesis)}</p>
            </section>
          ) : null}

          <div className="mi-chatEvidenceGrid">
            <EvidenceList title="Key drivers" items={run.modelAnalysis?.keyDrivers ?? []} />
            <EvidenceList title="Missing evidence" items={run.modelAnalysis?.missingEvidence ?? []} />
            <EvidenceList title="Source review" items={run.modelAnalysis?.sourceCredibilityNotes ?? []} />
          </div>

          <CryptoQualityReview run={run} />
          <MarketFlowSnapshot run={run} />
          <SocialEngagementSnapshot run={run} />
          <EvidenceDrawer run={run} />

            <section>
              <strong>Research path</strong>
              <p>
              Market data, web research, source scoring, and safety review are combined before any manual intent can be staged.
            </p>
            {run.paidResearch && paidServicesForRun.length > 0 ? (
              <details className="mi-details">
                <summary>
                  Circle live x402 research ({run.paidResearch.status}, {paidServicesForRun.length} services, max {run.paidResearch.estimatedMaxSpendUsdc} USDC)
                </summary>
                <div className="mi-paidServiceGrid">
                  {paidServicesForRun.map((service) => (
                    <div className={`mi-paidService ${service.status}`} key={service.id}>
                      <strong>{service.name}</strong>
                      <span>{service.provider} / {service.status}</span>
                      <p>{formatPaidServiceSummary(service)}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
            {run.marketResearch?.answer ? (
              <OpenDeepSearchBrief
                answer={run.marketResearch.answer}
                links={run.marketResearch.sourceLinks ?? []}
              />
            ) : null}
            {run.marketResearch?.sourceLinks?.length && !run.marketResearch?.answer ? (
              <div className="mi-sourceLinks">
                {run.marketResearch.sourceLinks.slice(0, 5).map((link) => (
                  <a href={link} key={link} target="_blank" rel="noreferrer">
                    <ExternalLink size={12} />
                    {shortUrl(link)}
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <section className="mi-chatActionPanel">
            <div className="mi-manualDecisionHeader">
              <div>
                <strong>Manual decision flow</strong>
                <p>
                  Choose the next action. The agent can stage an intent and record proof, but it will not execute a wallet trade by itself.
                </p>
              </div>
              <div className="mi-decisionPrompt">
                <span>Recommended: {formatActionLabel(run.modelAnalysis?.recommendation ?? run.action)}</span>
                <span>Risk: {run.modelAnalysis?.riskGate ?? run.riskGate}</span>
              </div>
            </div>

            {hasPaidResearch ? (
              <div className="mi-x402Complete">
                <CheckCircle2 size={16} />
                <div>
                  <strong>x402 research complete</strong>
                  <span>{formatPaidResearchCompletion(paidServicesForRun)}</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="mi-x402Upgrade"
                onClick={() => onRunPaidResearch(run)}
                title={`Spend up to ${LIVE_X402_RESEARCH_BUDGET_USDC} USDC through Circle x402 marketplace services, then re-run the research analysis.`}
              >
                <Sparkles size={14} />
                Upgrade with Circle x402 research
              </button>
            )}
            {hasPaidResearch ? <X402PaymentRecords run={run} /> : null}
            {hasPaidResearch ? <PaidResearchImpactSummary run={run} /> : null}
            {manualLeanNote ? (
              <div className="mi-manualLean">
                <strong>Manual lean</strong>
                <p>{manualLeanNote}</p>
              </div>
            ) : null}

            <div className="mi-actionRow mi-decisionActions">
              <button type="button" className="mi-actionSecondary" onClick={() => onStageRunIntent(run, "AVOID", "AUTO")}>
                <ShieldCheck size={14} />
                Avoid
              </button>
              <button type="button" className="mi-actionSecondary" onClick={() => onStageRunIntent(run, "WATCH", "AUTO")}>
                <Radar size={14} />
                Watch
              </button>
              <button
                type="button"
                className="mi-actionPrimary"
                onClick={() => onStageRunIntent(run, "APPROVE_INTENT", recommendedSide === "NONE" ? "AUTO" : recommendedSide)}
                disabled={!canStageBet}
                title={canStageBet ? agentIntentLabel : "No positive sized edge is available."}
              >
                <WalletCards size={14} />
                {agentIntentLabel}
              </button>
              <button type="button" className="mi-actionStrong" onClick={() => onStageRunIntent(run, "APPROVE_INTENT", "YES")}>
                Stage YES intent
              </button>
              <button type="button" className="mi-actionStrong" onClick={() => onStageRunIntent(run, "APPROVE_INTENT", "NO")}>
                Stage NO intent
              </button>
            </div>
            {latestIntentForRun ? (
              <div className="mi-proofPrompt">
                <p>
                  Intent staged: {formatIntentSide(latestIntentForRun)} / {latestIntentForRun.executionState.replaceAll("_", " ")} / {formatStake(latestIntentForRun.stakeUsdc)}.
                </p>
                <button
                  type="button"
                  onClick={() => onRecordArcProof(latestIntentForRun.id)}
                  disabled={receipt.status === "loading"}
                >
                  <ReceiptText size={14} />
                  {receipt.status === "loading" ? "Recording proof" : "Record proof on Arc"}
                </button>
                {proofForLatestIntent?.explorerUrl ? (
                  <a href={proofForLatestIntent.explorerUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={13} />
                    Open Arc proof
                  </a>
                ) : null}
                <InlineProofStatus receipt={receipt} intentId={latestIntentForRun.id} />
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </article>
  );
}

function AgentTrace({
  steps,
  compact = false,
  collapsible = false,
}: {
  steps: AgentTraceStep[];
  compact?: boolean;
  collapsible?: boolean;
}) {
  if (steps.length === 0) return null;
  const completed = steps.every((step) => step.status === "done");
  const blocked = steps.some((step) => step.status === "blocked");
  const title = blocked ? "Analysis needs attention" : completed ? "Completed analysis" : "Running analysis";
  const status = blocked ? "blocked" : completed ? "done" : "running";

  if (collapsible && (completed || blocked)) {
    return (
      <details className="mi-agentTraceDisclosure">
        <summary>
          <TraceProviderIcon label={blocked ? "Safety" : "Complete"} status={status} />
          <strong>{title}</strong>
          <span>Show flow</span>
        </summary>
        <div className="mi-agentTraceDisclosureBody">
          <AgentTraceRows steps={steps} />
        </div>
      </details>
    );
  }

  return (
    <div className={compact ? "mi-agentTrace compact" : "mi-agentTrace"}>
      <div className="mi-agentTraceHeader">
        <TraceProviderIcon label={blocked ? "Safety" : completed ? "Complete" : "Running"} status={status} />
        <strong>{title}</strong>
      </div>
      <AgentTraceRows steps={steps} />
    </div>
  );
}

function AgentTraceRows({ steps }: { steps: AgentTraceStep[] }) {
  return (
    <>
      {steps.map((step, index) => (
        <motion.div
          className={`mi-agentTraceStep ${step.status}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: Math.min(index * 0.06, 0.3) }}
          key={`${step.label}-${index}`}
        >
          <TraceProviderIcon label={step.label} status={step.status} />
          <div>
            <strong>{step.label}</strong>
            <small>{cleanUserFacingText(step.detail)}</small>
          </div>
        </motion.div>
      ))}
    </>
  );
}

function TraceProviderIcon({
  label,
  status,
}: {
  label: string;
  status: AgentTraceStep["status"];
}) {
  const visual = traceProviderVisualForLabel(label);

  if (visual.icon) {
    return (
      <span className={`mi-traceProvider hasIcon ${status}`} title={visual.title}>
        <img src={visual.icon} alt="" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={`mi-traceProvider ${status}`} title={visual.title}>
      {visual.token}
    </span>
  );
}

function traceProviderVisualForLabel(label: string) {
  const lower = label.toLowerCase();
  const iconPath = "/provider-icons/";

  if (lower.includes("parallel")) {
    return { token: "P", icon: "https://www.google.com/s2/favicons?domain=parallel.ai&sz=128", title: label };
  }
  if (lower.includes("exa")) {
    return { token: "E", icon: "https://www.google.com/s2/favicons?domain=exa.ai&sz=128", title: label };
  }
  if (lower.includes("perplexity")) return { token: "Px", icon: `${iconPath}perplexity.png`, title: label };
  if (lower.includes("polymarket")) return { token: "PM", icon: `${iconPath}polymarket.png`, title: label };
  if (lower.includes("tavily")) return { token: "T", icon: `${iconPath}tavily.png`, title: label };
  if (lower.includes("coingecko")) return { token: "G", icon: `${iconPath}coingecko.png`, title: label };
  if (
    lower.includes("x search") ||
    lower.includes("x advanced") ||
    lower.includes("x community") ||
    lower.includes("x/") ||
    lower.includes("twitter")
  ) return { token: "X", icon: `${iconPath}x.png`, title: label };
  if (lower.includes("human approval")) return { token: "H", icon: `${iconPath}manual-gate.png`, title: label };
  if (lower.includes("research ingestion")) return { token: "R", icon: `${iconPath}merge.png`, title: label };
  if (lower.includes("decision refresh")) return { token: "D", icon: `${iconPath}complete.png`, title: label };
  if (lower.includes("running")) return { token: "A", icon: `${iconPath}merge.png`, title: label };
  if (lower.includes("needs attention")) return { token: "!", icon: `${iconPath}safety.png`, title: label };
  if (lower.includes("aisa")) return { token: "AI", icon: `${iconPath}aisa.png`, title: label };
  if (lower.includes("blockrun")) return { token: "B", icon: `${iconPath}blockrun.png`, title: label };
  if (lower.includes("circle") || lower.includes("x402")) return { token: "C", icon: `${iconPath}circle.jpg`, title: label };
  if (lower.includes("serper")) return { token: "S", icon: `${iconPath}serper.png`, title: label };
  if (lower.includes("jina")) return { token: "J", icon: `${iconPath}jina.png`, title: label };
  if (lower.includes("open")) return { token: "O", icon: `${iconPath}opendeepsearch.png`, title: label };
  if (lower.includes("roma")) return { token: "R", icon: `${iconPath}roma.png`, title: label };
  if (lower === "arc" || lower.includes("arc proof") || lower.includes("arc receipt") || lower.includes("arc testnet")) return { token: "A", icon: `${iconPath}arc.png`, title: label };
  if (lower.includes("quality")) return { token: "Q", icon: `${iconPath}safety.png`, title: label };
  if (lower.includes("complete")) return { token: "OK", icon: `${iconPath}complete.png`, title: label };
  if (lower.includes("market")) return { token: "P", icon: `${iconPath}polymarket.png`, title: label };
  if (lower.includes("manual")) return { token: "M", icon: `${iconPath}manual-gate.png`, title: label };
  if (lower.includes("safety")) return { token: "S", icon: `${iconPath}safety.png`, title: label };

  return { token: "A", icon: null, title: label };
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <strong>{title}</strong>
      {items.length > 0 ? (
        items.slice(0, 5).map((item) => <span key={item}>{cleanUserFacingText(item)}</span>)
      ) : (
        <span>Not enough evidence yet.</span>
      )}
    </section>
  );
}

function TradePlanCard({ run, compact = false }: { run: AgentRunRecord; compact?: boolean }) {
  const plan = run.modelAnalysis?.tradePlan ?? null;
  if (!plan) return null;

  const targetOutcome = plan.targetOutcome ?? "No single outcome selected";
  const status = formatTradePlanStatus(plan.status);
  const side = plan.side === "NONE" ? "No trade" : plan.side;

  return (
    <section className={compact ? "mi-tradePlanCard compact" : "mi-tradePlanCard"}>
      <div className="mi-tradePlanHeader">
        <div>
          <span>Trade plan</span>
          <strong title={targetOutcome}>{targetOutcome}</strong>
        </div>
        <span>{status}</span>
      </div>

      <div className="mi-tradePlanGrid">
        <DataPoint label="Side" value={side} />
        <DataPoint label="Venue quote" value={plan.marketQuote ?? formatRunMarketPrice(run)} />
        <DataPoint label="Fair probability" value={formatPercent(plan.fairProbability)} />
        <DataPoint label="Edge" value={formatEdge(plan.edge)} />
        <DataPoint label="Plan confidence" value={formatPercent(plan.confidence)} />
      </div>

      <p>{cleanUserFacingText(plan.rationale)}</p>

      {(plan.alternative || plan.hedgeOrExit) ? (
        <div className="mi-tradePlanNotes">
          {plan.alternative ? (
            <div>
              <strong>Alternative</strong>
              <span>{cleanUserFacingText(plan.alternative)}</span>
            </div>
          ) : null}
          {plan.hedgeOrExit ? (
            <div>
              <strong>Hedge / exit</strong>
              <span>{cleanUserFacingText(plan.hedgeOrExit)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function IntegrityBadge({ run, compact = false }: { run: AgentRunRecord; compact?: boolean }) {
  const status = computeIntegrityStatus(run);

  return (
    <section className={compact ? `mi-integrityBadge ${status.tone} compact` : `mi-integrityBadge ${status.tone}`}>
      <div>
        <strong>{status.label}</strong>
        <p>{status.detail}</p>
      </div>
      <span>{status.score}/100</span>
    </section>
  );
}

function ConfidenceBreakdown({ run, compact = false }: { run: AgentRunRecord; compact?: boolean }) {
  const items = buildConfidenceBreakdown(run);

  return (
    <section className={compact ? "mi-confidenceBreakdown compact" : "mi-confidenceBreakdown"}>
      <div className="mi-confidenceHeader">
        <strong>Confidence breakdown</strong>
        <span>{formatPercent(run.modelAnalysis?.confidence ?? run.confidence)}</span>
      </div>
      <div className="mi-confidenceBars">
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <div>
              <i style={{ width: `${item.score}%` }} />
            </div>
            <strong>{item.score}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

type EvidenceDrawerItem = {
  title: string;
  detail: string;
  links?: ParsedResearchSource[];
};

type ParsedResearchSource = {
  title: string;
  url: string;
  snippet?: string;
};

function EvidenceDrawer({ run }: { run: AgentRunRecord }) {
  const evidence = buildEvidenceDrawerItems(run);

  if (evidence.length === 0) return null;

  return (
    <details className="mi-evidenceDrawer">
      <summary>
        <span>Evidence used</span>
        <small>{evidence.length} layers</small>
      </summary>
      <div>
        {evidence.map((item) => (
          <section key={item.title}>
            <strong>{item.title}</strong>
            <p>{cleanUserFacingText(item.detail)}</p>
            {item.links?.length ? <ResearchSourceList sources={item.links} /> : null}
          </section>
        ))}
      </div>
    </details>
  );
}

function OpenDeepSearchBrief({ answer, links }: { answer: string; links: string[] }) {
  const brief = parseOpenDeepSearchBrief(answer, links);

  return (
    <details className="mi-details mi-researchBrief">
      <summary>OpenDeepSearch brief</summary>
      {brief.summary ? <p>{brief.summary}</p> : null}
      {brief.sources.length ? <ResearchSourceList sources={brief.sources} /> : null}
    </details>
  );
}

function ResearchSourceList({ sources }: { sources: ParsedResearchSource[] }) {
  return (
    <ol className="mi-researchSources">
      {sources.map((source, index) => (
        <li key={`${source.url}-${index}`}>
          <a href={source.url} target="_blank" rel="noreferrer">
            <ExternalLink size={12} />
            <span>{source.title || shortUrl(source.url)}</span>
          </a>
          {source.snippet ? <p>{source.snippet}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function PaidResearchImpactSummary({ run, compact = false }: { run: AgentRunRecord; compact?: boolean }) {
  const items = buildPaidResearchImpact(run);

  if (!run.paidResearch || items.length === 0) return null;

  return (
    <section className={compact ? "mi-paidImpact compact" : "mi-paidImpact"}>
      <div className="mi-paidImpactHeader">
        <strong>What changed after x402</strong>
        <span>{run.paidResearch.status}</span>
      </div>
      <div className="mi-paidImpactGrid">
        {items.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function X402PaymentRecords({ run, compact = false }: { run: AgentRunRecord; compact?: boolean }) {
  const records = visiblePaidResearchServices(run)
    .flatMap((service) => (service.payment ? [{ service, payment: service.payment }] : []))
    .filter(({ payment }) => payment.receiptTransaction || payment.transactionHash || payment.amount);

  if (records.length === 0) return null;

  return (
    <details className={compact ? "mi-x402Payments compact" : "mi-x402Payments"}>
      <summary>
        <span>x402 payment records</span>
        <small>{records.length} receipt{records.length === 1 ? "" : "s"}</small>
      </summary>
      <div className="mi-x402PaymentGrid">
        {records.slice(0, 12).map(({ service, payment }) => {
          const transactionLabel = payment.transactionHash
            ? "Onchain transaction hash"
            : "Gateway x402 receipt";
          const transactionValue =
            payment.transactionHash ?? payment.receiptTransaction ?? "receipt recorded";

          return (
            <section key={`${service.id}-${transactionValue}`}>
              <div className="mi-x402PaymentHeader">
                <div>
                  <strong>{service.name}</strong>
                  <span>
                    {payment.amount ?? `${service.maxAmountUsdc} USDC`} · {payment.chain ?? payment.receiptNetwork ?? "Gateway"} · {payment.scheme ?? "x402"}
                  </span>
                </div>
                <b>{payment.success === false ? "failed" : "paid"}</b>
              </div>
              <p>
                {payment.transactionHash
                  ? "The provider returned a chain transaction hash for this paid call."
                  : "The provider returned a Gateway/x402 payment receipt. No per-call explorer transaction hash was included."}
              </p>
              <div className="mi-x402PaymentCode">
                <span>{transactionLabel}</span>
                <code>{transactionValue}</code>
              </div>
              {payment.seller ? (
                <div className="mi-x402PaymentCode">
                  <span>Seller</span>
                  <code>{payment.seller}</code>
                </div>
              ) : null}
              {payment.explorerUrl ? (
                <a href={payment.explorerUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={12} />
                  Open transaction
                </a>
              ) : null}
            </section>
          );
        })}
      </div>
      {records.length > 12 ? <p className="mi-x402PaymentNote">Showing the first 12 payment records for readability.</p> : null}
    </details>
  );
}

function MarketFlowSnapshot({ run, compact = false }: { run: AgentRunRecord; compact?: boolean }) {
  const snapshot = buildHolderFlowSnapshot(run);

  if (!snapshot) return null;

  return (
    <section className={compact ? "mi-flowSnapshot compact" : "mi-flowSnapshot"}>
      <div className="mi-flowHeader">
        <div>
          <strong>Holder flow</strong>
          <p>{snapshot.note}</p>
        </div>
        <span>{snapshot.status}</span>
      </div>

      {snapshot.sideTotals.length > 0 ? (
        <div className="mi-flowTotals">
          {snapshot.sideTotals.map((side) => (
            <div key={side.side}>
              <span>{side.side}</span>
              <strong>{formatUsdValue(side.amountUsd)}</strong>
              <small>{side.count} returned holder{side.count === 1 ? "" : "s"}</small>
            </div>
          ))}
        </div>
      ) : null}

      {snapshot.entries.length > 0 ? (
        <div className="mi-holderTable">
          {snapshot.entries.slice(0, 5).map((entry) => (
            <div key={`${entry.rank}-${entry.wallet}-${entry.side}`}>
              <span>#{entry.rank || "-"}</span>
              <strong title={entry.wallet}>{shortWallet(entry.wallet)}</strong>
              <span>{entry.side}</span>
              <span>{formatUsdValue(entry.amountUsd)}</span>
              <small>{formatCompactNumber(entry.shares)} shares</small>
            </div>
          ))}
        </div>
      ) : null}

      {snapshot.entries.length === 0 ? (
        <p className="mi-flowEmpty">{snapshot.detail}</p>
      ) : null}
    </section>
  );
}

function SocialEngagementSnapshot({ run, compact = false }: { run: AgentRunRecord; compact?: boolean }) {
  const snapshot = buildSocialEngagementSnapshot(run);

  if (!snapshot) return null;

  return (
    <section className={compact ? "mi-socialSnapshot compact" : "mi-socialSnapshot"}>
      <div className="mi-socialHeader">
        <div>
          <strong>X engagement</strong>
          <p>{snapshot.note}</p>
        </div>
        <span>{snapshot.status}</span>
      </div>

      {snapshot.posts.length > 0 ? (
        <div className="mi-socialList">
          {snapshot.posts.slice(0, 5).map((post, index) => (
            <a
              href={post.url || undefined}
              target={post.url ? "_blank" : undefined}
              rel={post.url ? "noreferrer" : undefined}
              key={post.id}
              className={!post.url ? "disabled" : undefined}
            >
              <span className="mi-socialRank">{index + 1}</span>
              <span className="mi-socialAvatar" aria-hidden="true">
                {post.avatarUrl ? <img src={post.avatarUrl} alt="" /> : getSocialInitial(post)}
              </span>
              <div className="mi-socialPostBody">
                <div className="mi-socialPostHeader">
                  <strong>{post.author}</strong>
                  {post.handle ? <span>{post.handle}</span> : null}
                  {post.ageLabel ? <span>{post.ageLabel}</span> : null}
                  <small>{formatCompactNumber(post.engagement)} engagement</small>
                </div>
                <p>{cleanUserFacingText(post.text)}</p>
                <div className="mi-socialMetrics" aria-label="Visible X metrics">
                  <span title="Likes">
                    <Heart size={12} />
                    {formatCompactNumber(post.likes)}
                  </span>
                  <span title="Reposts">
                    <Repeat2 size={12} />
                    {formatCompactNumber(post.reposts)}
                  </span>
                  <span title="Replies">
                    <MessageCircle size={12} />
                    {formatCompactNumber(post.replies)}
                  </span>
                  {post.views ? <span>{formatCompactNumber(post.views)} views</span> : null}
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="mi-flowEmpty">{snapshot.detail}</p>
      )}
    </section>
  );
}

type HolderFlowEntry = {
  rank: number | string | null;
  wallet: string;
  side: string;
  shares: number;
  amountUsd: number;
};

type SocialPost = {
  id: string;
  text: string;
  author: string;
  handle: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  ageLabel: string | null;
  url: string | null;
  likes: number;
  reposts: number;
  replies: number;
  views: number;
  engagement: number;
};

type PaidResearchService = NonNullable<AgentRunRecord["paidResearch"]>["services"][number];

function visiblePaidResearchServices(run: AgentRunRecord) {
  return run.paidResearch?.services.filter(isVisiblePaidResearchService) ?? [];
}

function isVisiblePaidResearchService(service: PaidResearchService) {
  const removedVenue = ["kal", "shi"].join("");
  const haystack = `${service.id} ${service.name}`.toLowerCase();
  if (haystack.includes(removedVenue) || haystack.includes("smart-money")) return false;
  if (service.id === "blockrun-polymarket-smart-activity") return false;
  if (service.id === "exa-web-search" && service.status !== "ok") return false;
  if (service.id === "aisa-polymarket-activity" && /required query param ['"]?user/i.test(`${service.rawText ?? ""} ${service.summary}`)) return false;
  return true;
}

function formatPaidResearchCompletion(services: PaidResearchService[]) {
  if (services.length === 0) return "Paid pass completed; no visible provider rows were returned.";
  const ok = services.filter((service) => service.status === "ok").length;
  return `${ok}/${services.length} services returned usable data.`;
}

function buildPaidResearchImpact(run: AgentRunRecord) {
  const services = visiblePaidResearchServices(run);
  if (!run.paidResearch || services.length === 0) return [];

  const ok = services.filter((service) => service.status === "ok").length;
  const errors = services.filter((service) => service.status === "error").length;
  const beforeDecision = formatActionLabel(run.action);
  const afterDecision = formatActionLabel(run.modelAnalysis?.recommendation ?? run.action);
  const confidenceBefore = run.confidence;
  const confidenceAfter = run.modelAnalysis?.confidence ?? run.confidence;
  const confidenceDelta = Math.round(confidenceAfter - confidenceBefore);
  const flow = buildHolderFlowSnapshot(run);
  const social = buildSocialEngagementSnapshot(run);
  const holderCount = flow?.entries.length ?? 0;
  const socialCount = social?.posts.length ?? 0;

  return [
    {
      label: "Decision refresh",
      value: beforeDecision === afterDecision ? `${afterDecision} stayed` : `${beforeDecision} -> ${afterDecision}`,
      detail:
        confidenceDelta === 0
          ? `Confidence stayed at ${formatPercent(confidenceAfter)}.`
          : `Confidence moved ${confidenceDelta > 0 ? "+" : ""}${confidenceDelta} pts to ${formatPercent(confidenceAfter)}.`,
    },
    {
      label: "Paid coverage",
      value: `${ok}/${services.length} usable`,
      detail:
        errors > 0
          ? `${errors} data gap${errors === 1 ? "" : "s"} kept as missing evidence, not as proof.`
          : "Paid services returned without visible data gaps.",
    },
    {
      label: "Holder flow",
      value: holderCount > 0 ? `${holderCount} holders` : "No rows",
      detail:
        holderCount > 0
          ? "Returned holder-side exposure was folded into integrity risk."
          : "No exact holder rows were available, so execution remains review-first.",
    },
    {
      label: "Recent X signal",
      value: socialCount > 0 ? `${socialCount} posts` : "No fresh posts",
      detail:
        socialCount > 0
          ? "Only dated posts inside the 45-day freshness window are shown."
          : "No recent dated posts were returned inside the freshness window.",
    },
  ];
}

function buildManualLeanNote(run: AgentRunRecord) {
  const recommendation = run.modelAnalysis?.recommendation ?? run.action;
  if (recommendation !== "WAIT" && recommendation !== "RESEARCH_MORE") return null;

  const explicitNote = run.modelAnalysis?.policyNotes.find((note) =>
    /still trade manually|cleaner lean|manual lean/i.test(note),
  );
  if (explicitNote) return cleanUserFacingText(explicitNote);

  return "WAIT means the agent is not comfortable sizing a trade. If you still choose to act manually, use the thesis and key drivers to pick the least-bad side, then stage only an intent for human review.";
}

function recommendedSideForRun(run: AgentRunRecord): "YES" | "NO" | "NONE" {
  const planSide = run.modelAnalysis?.tradePlan?.side;
  if (planSide === "YES" || planSide === "NO") return planSide;
  const recommendation = run.modelAnalysis?.recommendation;
  if (recommendation === "BET_YES") return "YES";
  if (recommendation === "BET_NO") return "NO";
  return run.sizing.side;
}

function formatAgentIntentLabel(
  tradePlan: NonNullable<AgentRunRecord["modelAnalysis"]>["tradePlan"] | null | undefined,
  side: "YES" | "NO" | "NONE",
) {
  if (side === "NONE") return "Use agent side intent";
  const target =
    tradePlan && typeof tradePlan === "object" && "targetOutcome" in tradePlan
      ? (tradePlan.targetOutcome as string | null)
      : null;
  if (!target) return `Use agent side ${side} intent`;
  return `Use ${truncateLabel(target, 32)} ${side} intent`;
}

function formatIntentSide(intent: { targetOutcome?: string | null; side?: "YES" | "NO" | "NONE" }) {
  const side = intent.side ?? "n/a";
  return intent.targetOutcome ? `${truncateLabel(intent.targetOutcome, 42)} ${side}` : side;
}

function buildHolderFlowSnapshot(run: AgentRunRecord) {
  const topHolderService = run.paidResearch?.services.find((item) => item.id === "blockrun-polymarket-top-holders");
  const activityService = run.paidResearch?.services.find((item) =>
    item.id === "aisa-polymarket-activity" &&
    !/required query param ['"]?user/i.test(`${item.rawText ?? ""} ${item.summary}`),
  );
  const service = topHolderService?.status === "ok" ? topHolderService : activityService ?? topHolderService;
  if (!service) return null;
  const isActivityFallback = service.id === "aisa-polymarket-activity";

  if (service.status !== "ok") {
    return {
      status: service.status,
      note: "Exact top-holder data is not available for this run.",
      detail: formatPaidServiceSummary(service),
      entries: [] as HolderFlowEntry[],
      sideTotals: [] as Array<{ side: string; count: number; amountUsd: number; shares: number }>,
    };
  }

  const parsed = parsePaidJson(service.rawText ?? service.summary);
  const payload = unwrapPaidPayload(parsed);
  const rawEntries = Array.isArray(readPath(payload, ["entries"]))
    ? readPath(payload, ["entries"]) as unknown[]
    : Array.isArray(readPath(payload, ["activities"]))
      ? readPath(payload, ["activities"]) as unknown[]
      : [];
  const entries = rawEntries.map(normalizeHolderEntry).filter(Boolean) as HolderFlowEntry[];
  const sideTotals = buildHolderSideTotals(entries);

  return {
    status: entries.length > 0 ? (isActivityFallback ? "activity x402" : "live x402") : "empty",
    note:
      entries.length > 0
        ? isActivityFallback
          ? "Top-holder snapshot was unavailable, so this uses recent market-specific activity as a flow fallback. It is not a full holder table."
          : "Real x402 top-holder snapshot for this exact market. Totals below are from returned holders, not a guaranteed full-market total."
        : isActivityFallback
          ? "Paid activity returned no wallet-level rows for this exact query."
          : "The top-holder endpoint completed but did not return holder rows.",
    detail: formatPaidServiceSummary(service) || "No holder rows returned.",
    entries,
    sideTotals,
  };
}

function buildSocialEngagementSnapshot(run: AgentRunRecord) {
  const services = visiblePaidResearchServices(run).filter((item) => item.id.includes("twitter"));
  if (services.length === 0) return null;

  const now = Date.now();
  const posts = dedupeSocialPosts(
    services
      .filter((service) => service.status === "ok")
      .flatMap((service) => parseSocialPosts(service.rawText) ?? parseSocialPosts(service.summary) ?? []),
  )
    .filter((post) => isFreshSocialPost(post, now) && post.engagement > 0)
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5);

  return {
    status: posts.length > 0 ? "live x402" : "no posts",
    note:
      posts.length > 0
        ? "Top returned X posts from the last 45 days by visible engagement. Treat as sentiment/context, not proof."
        : "Paid X search ran, but no recent dated posts with visible engagement were returned.",
    detail:
      services.find((service) => service.status === "error")?.error ??
      "No recent X posts with visible engagement were returned by the paid provider for this query.",
    posts,
  };
}

function parseSocialPosts(value: string | null | undefined): SocialPost[] | null {
  const parsed = parsePaidJson(value);
  if (!parsed) return null;
  const payload = unwrapPaidPayload(parsed);
  const tweets = Array.isArray(readPath(payload, ["tweets"]))
    ? (readPath(payload, ["tweets"]) as unknown[])
    : Array.isArray(payload)
      ? payload
      : [];

  const posts = tweets.map(normalizeSocialPost).filter(Boolean) as SocialPost[];
  return posts.length > 0 ? posts : null;
}

function normalizeSocialPost(value: unknown): SocialPost | null {
  if (!isPlainObject(value)) return null;
  const authorValue = readPath(value, ["author"]);
  const authorName = isPlainObject(authorValue)
    ? firstKnownString(authorValue, ["name", "displayName", "userName", "screenName", "screen_name", "handle"])
    : typeof authorValue === "string"
      ? authorValue
      : null;
  const authorHandle = isPlainObject(authorValue)
    ? firstKnownString(authorValue, ["userName", "screenName", "screen_name", "handle", "username"])
    : typeof authorValue === "string"
      ? authorValue
      : null;
  const avatarUrl = isPlainObject(authorValue)
    ? firstKnownString(authorValue, [
        "profilePicture",
        "profileImageUrl",
        "profile_image_url_https",
        "profile_image_url",
        "avatar",
        "picture",
      ])
    : null;
  const text = firstKnownString(value, ["text", "full_text", "content", "description"]);
  if (!text) return null;

  const id = firstKnownString(value, ["id", "tweetId", "rest_id"]) ?? stableTextId(text);
  const handle = authorHandle?.replace(/^@/, "");
  const url =
    firstKnownString(value, ["url", "tweetUrl", "link"]) ??
    (handle && id && /^[0-9]+$/.test(id) ? `https://x.com/${handle}/status/${id}` : null);
  const likes = firstKnownNumber(value, ["likeCount", "likes", "favorite_count", "favorites"]) ?? 0;
  const reposts = firstKnownNumber(value, ["retweetCount", "reposts", "retweets", "quoteCount"]) ?? 0;
  const replies = firstKnownNumber(value, ["replyCount", "replies"]) ?? 0;
  const views = firstKnownNumber(value, ["viewCount", "views", "impressionCount"]) ?? 0;
  const createdAt = parseSocialPostDate(value);

  return {
    id: url ?? `${id}-${stableTextId(text)}`,
    text,
    author: cleanSocialAuthorName(authorName, handle),
    handle: handle ? `@${handle}` : null,
    avatarUrl,
    createdAt,
    ageLabel: createdAt ? formatSocialAge(createdAt) : null,
    url,
    likes,
    reposts,
    replies,
    views,
    engagement: Math.round(likes + reposts * 2 + replies),
  };
}

function dedupeSocialPosts(posts: SocialPost[]) {
  const seen = new Set<string>();
  const unique: SocialPost[] = [];

  for (const post of posts) {
    const key = post.url ?? stableTextId(post.text);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(post);
  }

  return unique;
}

function cleanSocialAuthorName(name: string | null, handle?: string | null) {
  const fallback = handle ? `@${handle}` : "Unknown account";
  if (!name) return fallback;
  const cleaned = name.replace(/^@/, "").trim();
  if (!cleaned) return fallback;
  return cleaned.length > 28 ? `${cleaned.slice(0, 25).trim()}...` : cleaned;
}

function getSocialInitial(post: SocialPost) {
  const source = post.author || post.handle || "X";
  return source.replace(/^@/, "").trim().slice(0, 1).toUpperCase() || "X";
}

function parseSocialPostDate(value: Record<string, unknown>) {
  const stringValue = firstKnownString(value, [
    "createdAt",
    "created_at",
    "createdDate",
    "postedAt",
    "publishedAt",
    "date",
    "time",
  ]);
  const numericValue = firstKnownNumber(value, ["timestamp", "createdAtMs", "created_at_ms"]);
  const raw = stringValue ?? numericValue;
  if (!raw) return null;

  const date = typeof raw === "number"
    ? new Date(raw > 10_000_000_000 ? raw : raw * 1000)
    : new Date(raw);

  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function isFreshSocialPost(post: SocialPost, now: number) {
  if (!post.createdAt) return false;
  const timestamp = Date.parse(post.createdAt);
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = now - timestamp;
  const freshnessWindowMs = 45 * 24 * 60 * 60 * 1000;
  return ageMs >= 0 && ageMs <= freshnessWindowMs;
}

function formatSocialAge(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const diffMs = Date.now() - timestamp;
  const diffDays = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1d";
  if (diffDays < 45) return `${diffDays}d`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function computeIntegrityStatus(run: AgentRunRecord) {
  const flow = buildHolderFlowSnapshot(run);
  const holderTotals = flow?.sideTotals ?? [];
  const totalHolderUsd = holderTotals.reduce((sum, item) => sum + item.amountUsd, 0);
  const topSideUsd = Math.max(...holderTotals.map((item) => item.amountUsd), 0);
  const concentration = totalHolderUsd > 0 ? topSideUsd / totalHolderUsd : 0;
  const hasFlow = (flow?.entries.length ?? 0) > 0;
  const riskGate = run.modelAnalysis?.riskGate ?? run.riskGate;
  const confidence = run.modelAnalysis?.confidence ?? run.confidence;
  const paidServices = visiblePaidResearchServices(run);
  const paidOk = paidServices.filter((service) => service.status === "ok").length;
  const paidTotal = paidServices.length;
  const notes = (run.modelAnalysis?.sourceCredibilityNotes ?? []).join(" ").toLowerCase();
  const missing = (run.modelAnalysis?.missingEvidence ?? []).join(" ").toLowerCase();
  const suspicious =
    riskGate === "blocked" ||
    notes.includes("manipulation") ||
    notes.includes("one-sided") ||
    notes.includes("concentration") ||
    missing.includes("order book") ||
    concentration >= 0.78;

  if (suspicious) {
    return {
      label: "Integrity risk",
      tone: "risk",
      score: Math.round(Math.max(72, concentration * 100)),
      detail: hasFlow
        ? "Holder flow or source notes show concentration/manipulation risk; treat as review-first."
        : "The model flagged integrity risk, but exact holder flow is not available yet.",
    };
  }

  if (riskGate === "review" || concentration >= 0.6 || !hasFlow) {
    const noFlowScore = clampScore(
      42 +
      Math.round((confidence - 0.5) * 24) +
      (run.conditionId ? 4 : -6) +
      (paidTotal > 0 ? Math.round((paidOk / paidTotal) * 10) : 0) +
      (riskGate === "open" ? -8 : 0),
    );

    return {
      label: "Watch integrity",
      tone: "watch",
      score: Math.round(hasFlow ? Math.max(48, concentration * 100) : noFlowScore),
      detail: hasFlow
        ? "Returned holder snapshot is usable, but the market still needs human review."
        : "Exact holder rows are unavailable for this event/outcome, so the agent uses fallback activity and keeps execution manual.",
    };
  }

  return {
    label: "Clean enough",
    tone: "clean",
    score: 32,
    detail: "No strong manipulation signal from the current evidence. Manual approval still applies.",
  };
}

function buildConfidenceBreakdown(run: AgentRunRecord) {
  const hasMarketPrice = run.analysis?.marketProbability !== null && run.analysis?.marketProbability !== undefined;
  const paidServices = visiblePaidResearchServices(run);
  const paidOk = paidServices.filter((service) => service.status === "ok").length;
  const paidTotal = paidServices.length;
  const flow = buildHolderFlowSnapshot(run);
  const sourceNotes = run.modelAnalysis?.sourceCredibilityNotes.length ?? 0;
  const missingCount = run.modelAnalysis?.missingEvidence.length ?? 0;
  const researchLinks = run.marketResearch?.sourceLinks.length ?? 0;
  const riskGate = run.modelAnalysis?.riskGate ?? run.riskGate;

  return [
    {
      label: "Market data",
      score: clampScore((hasMarketPrice ? 68 : 34) + (run.conditionId ? 14 : 0) + (paidOk > 0 ? 10 : 0)),
    },
    {
      label: "News freshness",
      score: clampScore(35 + Math.min(researchLinks, 6) * 8 + (run.marketResearch?.status === "ok" ? 12 : 0)),
    },
    {
      label: "Source quality",
      score: clampScore(42 + sourceNotes * 8 - missingCount * 4 + (run.modelAnalysis?.status === "ok" ? 10 : 0)),
    },
    {
      label: "Flow integrity",
      score: clampScore((flow?.entries.length ? 72 : 38) + (riskGate === "open" ? 12 : riskGate === "blocked" ? -28 : -8)),
    },
    {
      label: "Resolution clarity",
      score: clampScore(66 - (missingContains(run, "resolution") ? 24 : 0) - (run.venue === "Draft" ? 10 : 0)),
    },
    {
      label: "Paid coverage",
      score: clampScore(paidTotal > 0 ? Math.round((paidOk / paidTotal) * 100) : 28),
    },
  ];
}

function buildEvidenceDrawerItems(run: AgentRunRecord) {
  const items: EvidenceDrawerItem[] = [];
  const paidServices = visiblePaidResearchServices(run);
  const okServices = paidServices.filter((service) => service.status === "ok");
  const failedServices = paidServices.filter((service) => service.status === "error");

  if (run.marketResearch?.sourceLinks.length) {
    const brief = parseOpenDeepSearchBrief(run.marketResearch.answer ?? "", run.marketResearch.sourceLinks);
    items.push({
      title: "Web research",
      detail: `${run.marketResearch.sourceLinks.length} source link(s) returned.${brief.summary ? ` ${brief.summary}` : ""}`,
      links: brief.sources,
    });
  }

  if (okServices.length) {
    items.push({
      title: "Circle x402 paid services",
      detail: `${okServices.length}/${paidServices.length || okServices.length} services returned usable data: ${okServices.slice(0, 5).map((service) => service.name).join(", ")}.`,
    });
  }

  if (failedServices.length) {
    items.push({
      title: "Data gaps",
      detail: `${failedServices.length} paid service(s) failed or returned unusable data. The analysis should not treat missing provider data as evidence.`,
    });
  }

  if (run.modelAnalysis?.sourceCredibilityNotes.length) {
    items.push({
      title: "Source credibility",
      detail: run.modelAnalysis.sourceCredibilityNotes.slice(0, 3).map(cleanUserFacingText).join(" "),
    });
  }

  if (run.modelAnalysis?.missingEvidence.length) {
    items.push({
      title: "Missing evidence",
      detail: run.modelAnalysis.missingEvidence.slice(0, 4).map(cleanUserFacingText).join(" "),
    });
  }

  return items;
}

function missingContains(run: AgentRunRecord, keyword: string) {
  return (run.modelAnalysis?.missingEvidence ?? []).some((item) => item.toLowerCase().includes(keyword));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeHolderEntry(value: unknown): HolderFlowEntry | null {
  if (!isPlainObject(value)) return null;

  const wallet = firstKnownString(value, ["wallet", "address", "user", "holder", "proxyWallet"]);
  if (!wallet) return null;

  return {
    rank: firstKnownNumber(value, ["rank"]) ?? firstKnownString(value, ["rank"]),
    wallet,
    side: normalizeFlowSide(firstKnownString(value, ["side", "outcome", "outcome_label"]) ?? "Unknown"),
    shares: firstKnownNumber(value, ["position_shares", "shares", "shares_normalized", "position"]) ?? 0,
    amountUsd:
      firstKnownNumber(value, ["position_value_usd", "amount_usd", "amountUsd", "value", "value_usd", "notional"]) ??
      estimateActivityAmountUsd(value),
  };
}

function estimateActivityAmountUsd(value: Record<string, unknown>) {
  const shares = firstKnownNumber(value, ["shares_normalized", "shares", "position"]) ?? 0;
  const price = firstKnownNumber(value, ["price", "avg_price", "average_price"]) ?? 0;
  return Number((shares * price).toFixed(4));
}

function buildHolderSideTotals(entries: HolderFlowEntry[]) {
  const totals = new Map<string, { side: string; count: number; amountUsd: number; shares: number }>();

  for (const entry of entries) {
    const current = totals.get(entry.side) ?? { side: entry.side, count: 0, amountUsd: 0, shares: 0 };
    current.count += 1;
    current.amountUsd += entry.amountUsd;
    current.shares += entry.shares;
    totals.set(entry.side, current);
  }

  return [...totals.values()]
    .map((item) => ({
      ...item,
      amountUsd: Number(item.amountUsd.toFixed(4)),
      shares: Number(item.shares.toFixed(4)),
    }))
    .sort((a, b) => b.amountUsd - a.amountUsd);
}

function parsePaidJson(value: string | null | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function unwrapPaidPayload(value: unknown): unknown {
  return (
    readPath(value, ["data", "response"]) ??
    readPath(value, ["response"]) ??
    readPath(value, ["data"]) ??
    value
  );
}

function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (!isPlainObject(current)) return undefined;
    return current[key];
  }, value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstKnownString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const current = value[key];
    if (typeof current === "string" && current.trim()) return current;
    if (typeof current === "number" || typeof current === "boolean") return String(current);
  }
  return null;
}

function firstKnownNumber(value: Record<string, unknown>, keys: string[]) {
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

function normalizeFlowSide(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.includes("yes")) return "YES";
  if (lowered.includes("no")) return "NO";
  return value || "Unknown";
}

function shortWallet(value: string) {
  if (!value) return "unknown";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatUsdValue(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0";
  if (value < 0.01) return "<$0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function stableTextId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function InlineProofStatus({
  receipt,
  intentId,
}: {
  receipt: RecordedIntentReceiptState;
  intentId: string;
}) {
  if (receipt.status === "loading") {
    return <span className="mi-proofState loading">Recording on Arc...</span>;
  }

  if (receipt.status === "error") {
    return <span className="mi-proofState error">{receipt.message ?? "Proof recording failed."}</span>;
  }

  if (receipt.status === "ok" && receipt.receipt?.intent?.id === intentId) {
    return (
      <span className="mi-proofState ok">
        Proof recorded{receipt.receipt.expectedReceiptId ? ` #${receipt.receipt.expectedReceiptId}` : ""}.
      </span>
    );
  }

  if (receipt.status === "ok" && receipt.receipt) {
    return <span className="mi-proofState muted">Latest proof belongs to another staged intent.</span>;
  }

  return <span className="mi-proofState muted">No Arc proof recorded for this staged intent yet.</span>;
}

function CryptoQualityReview({ run }: { run: AgentRunRecord }) {
  if (!isCryptoQualityRun(run)) return null;
  const review = run.cryptoBench;
  if (!review || review.status !== "active" || !review.dimensions) return null;
  const flagged = review.errorTaxonomy.filter((item) => item.present);

  return (
    <section className="mi-qualityReview">
      <div className="mi-qualityHeader">
        <div>
          <strong>Crypto quality review</strong>
          <span>Benchmark-style check for crypto/Web3 reasoning.</span>
        </div>
        <b>{review.overallScore?.toFixed(1) ?? "n/a"}/10</b>
      </div>
      <div className="mi-qualityGrid">
        {Object.entries(review.dimensions).map(([key, value]) => (
          <div key={key}>
            <span>{formatQualityDimension(key)}</span>
            <strong>{value.score.toFixed(1)}</strong>
          </div>
        ))}
      </div>
      <div className="mi-qualityNotes">
        {review.improvementNotes.slice(0, 3).map((note) => (
          <span key={note}>{note}</span>
        ))}
      </div>
      {flagged.length ? (
        <details className="mi-details compact">
          <summary>{flagged.length} benchmark flag{flagged.length > 1 ? "s" : ""}</summary>
          <div className="mi-qualityFlags">
            {flagged.slice(0, 4).map((flag) => (
              <span key={flag.id}>
                <strong>{flag.label}</strong>
                {flag.note}
              </span>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

function isCryptoQualityRun(run: AgentRunRecord) {
  if (run.cryptoBench?.status !== "active") return false;
  const haystack = [
    run.market,
    run.category,
    run.marketSlug ?? "",
    run.outcomeSummary ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return [
    "crypto",
    "bitcoin",
    "btc",
    "ethereum",
    "eth",
    "solana",
    "sol",
    "usdc",
    "stablecoin",
    "defi",
    "web3",
    "token",
    "blockchain",
    "onchain",
    "on-chain",
    "wallet",
  ].some((term) => haystack.includes(term));
}

function formatQualityDimension(key: string) {
  if (key === "temporalRelevance") return "Freshness";
  if (key === "dataConsistency") return "Consistency";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function MarketsPage({
  marketSearch,
  setMarketSearch,
  markets: marketList,
  selectedMarket,
  selectedRun,
  sizing,
  runState,
  selectedAlert,
  researchState,
  marketLinkInput,
  setMarketLinkInput,
  onSelect,
  onAnalyze,
  onLoadLink,
  onStageIntent,
  onRunPaidResearch,
  onRecordArcProof,
  tradeIntent,
  receipt,
  activeTrace,
}: {
  marketSearch: string;
  setMarketSearch: (value: string) => void;
  markets: MarketCandidate[];
  selectedMarket: MarketCandidate | undefined;
  selectedRun: AgentRunRecord | undefined;
  sizing: ReturnType<typeof estimatePositionSize> | null;
  runState: "idle" | "running" | "complete";
  selectedAlert: IntegrityAlert | null;
  researchState: ResearchState;
  marketLinkInput: string;
  setMarketLinkInput: (value: string) => void;
  onSelect: (id: string) => void;
  onAnalyze: (market: MarketCandidate) => Promise<AgentRunRecord | null>;
  onLoadLink: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onStageIntent: (action: TradeIntentAction, side?: "AUTO" | "YES" | "NO") => void;
  onRunPaidResearch: (run: AgentRunRecord) => void;
  onRecordArcProof: (intentId?: string) => void;
  tradeIntent: TradeIntentState;
  receipt: RecordedIntentReceiptState;
  activeTrace: AgentTraceStep[];
}) {
  const recommendation = selectedRun?.modelAnalysis?.recommendation ?? selectedRun?.action ?? "WAIT";
  const selectedPaidServices = selectedRun ? visiblePaidResearchServices(selectedRun) : [];
  const selectedRecommendedSide = selectedRun ? recommendedSideForRun(selectedRun) : "NONE";
  const selectedAgentIntentLabel = selectedRun
    ? formatAgentIntentLabel(selectedRun.modelAnalysis?.tradePlan, selectedRecommendedSide)
    : "Use agent side intent";
  const selectedIntent =
    selectedRun && tradeIntent.intent?.marketId === selectedRun.marketId
      ? tradeIntent.intent
      : selectedMarket && tradeIntent.intent?.marketId === selectedMarket.id
        ? tradeIntent.intent
        : null;
  const selectedProof =
    selectedIntent && receipt.receipt?.intent?.id === selectedIntent.id ? receipt.receipt : null;

  return (
    <section className="mi-workspace">
      <div className="mi-pageTitle">
        <div>
          <p>Market intelligence</p>
          <h1>Prediction Market Intelligence</h1>
        </div>
        <div className="mi-search">
          <Search size={16} />
          <input
            value={marketSearch}
            onChange={(event) => setMarketSearch(event.target.value)}
            placeholder="Search Polymarket, category, signal..."
          />
        </div>
      </div>

      <form className="mi-linkAnalyze" onSubmit={onLoadLink}>
        <Search size={16} />
        <input
          value={marketLinkInput}
          onChange={(event) => setMarketLinkInput(event.target.value)}
          placeholder="Paste a Polymarket link to load the prediction..."
        />
        <button type="submit" disabled={!marketLinkInput.trim() || runState === "running"}>
          <Plus size={14} />
          Load prediction
        </button>
      </form>

      <div className="mi-marketLayout">
        <div className="mi-marketList">
          {marketList.length === 0 ? (
            <section className="mi-emptyState">
              <Search size={22} />
              <h3>No loaded markets yet</h3>
              <p>
                Paste a Polymarket link above. The dashboard will load the market first, then you can manually run analysis.
              </p>
            </section>
          ) : null}
          {marketList.map((market) => (
            <article
              className={selectedMarket?.id === market.id ? "mi-marketCard active" : "mi-marketCard"}
              key={market.id}
              onClick={() => onSelect(market.id)}
            >
              <MarketThumbnail market={market} />
              <div className="mi-marketTop">
                <span>{market.venue}</span>
                <RiskPill risk={market.risk} />
              </div>
              <h3>{market.question}</h3>
              <div className="mi-marketMeta">
                <span>{market.category}</span>
                <span>{formatMarketPrice(market)}</span>
                <span>{market.volume}</span>
                <span>{market.liquidity}</span>
              </div>
              <div className="mi-marketFooter">
                <span>{market.signal}</span>
                {market.originalUrl ? (
                  <a
                    href={market.originalUrl}
                    onClick={(event) => event.stopPropagation()}
                    target="_blank"
                    rel="noreferrer"
                    title={`Open the original ${market.venue} market.`}
                  >
                    <ExternalLink size={14} />
                    Open
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onAnalyze(market);
                  }}
                >
                  <Bot size={14} />
                  Analyze
                </button>
              </div>
            </article>
          ))}
        </div>

        {selectedMarket ? (
          <aside className="mi-report">
          <div className="mi-reportHeader">
            <div>
              <span>{selectedMarket.venue} / {selectedMarket.category}</span>
              <h2>{selectedMarket.question}</h2>
            </div>
            <button
              type="button"
              className="mi-primarySmall"
              onClick={() => void onAnalyze(selectedMarket)}
              disabled={runState === "running"}
            >
              <Play size={14} />
              {runState === "running" ? "Analyzing" : "Analyze"}
            </button>
          </div>

          <div className="mi-statusStrip">
            <DataPoint label="Venue price" value={formatMarketPrice(selectedMarket)} />
            <DataPoint
              label="Agent"
              value={
                selectedRun
                  ? formatPercent(selectedRun.analysis?.agentProbability ?? selectedMarket.agentProbability)
                  : "n/a"
              }
            />
            <DataPoint label="Edge" value={formatEdge(selectedRun?.edge ?? null)} />
            <DataPoint
              label="Stake"
              value={selectedRun ? formatStake(sizing?.stakeUsdc ?? selectedRun.sizing.stakeUsdc) : "n/a"}
            />
          </div>
          {selectedRun ? <IntegrityBadge run={selectedRun} compact /> : null}
          {selectedRun ? <ConfidenceBreakdown run={selectedRun} compact /> : null}
          {selectedRun ? <TradePlanCard run={selectedRun} compact /> : null}

          <section className="mi-reportBlock">
            <div className="mi-blockHeader">
              <h3>{selectedRun ? "Agent recommendation" : "Ready for analysis"}</h3>
              <span>{selectedRun ? formatActionLabel(recommendation) : "Manual"}</span>
            </div>
            <p>
              {cleanUserFacingText(selectedRun?.modelAnalysis?.summary ??
                selectedRun?.summary ??
                "This market is loaded. Press Analyze to run source checks, probability reasoning, sizing, and the safety gate.")}
            </p>
            {selectedRun ? (
              <div className="mi-pillRow">
                <span title={riskTooltip(selectedMarket.risk)}>{selectedRun.riskGate}</span>
                <span>{formatPercent(selectedRun.confidence)}</span>
                <span>{formatResearchMode(selectedRun.sentientContext?.mode) ?? "research stack ready"}</span>
              </div>
            ) : null}
          </section>

          {selectedRun ? (
            <section className="mi-reportBlock">
              <div className="mi-tabLine">
                <strong>Bet case</strong>
                <strong>Risk case</strong>
                <strong>Missing evidence</strong>
              </div>
              <div className="mi-columns">
                <div>
                  {(selectedRun.modelAnalysis?.keyDrivers ?? selectedMarket.sources).slice(0, 4).map((item) => (
                    <span key={item}>{cleanUserFacingText(item)}</span>
                  ))}
                </div>
                <div>
                  {[
                    selectedAlert?.reason ?? sizing?.reason ?? "No high-risk flow selected.",
                    ...(selectedRun.modelAnalysis?.sourceCredibilityNotes ?? [
                      researchState.snapshot
                        ? "General research cache is available, but this run still needs market-specific source checks."
                        : "Market-specific research snapshot pending.",
                    ]),
                  ]
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((item) => (
                      <span key={item}>{cleanUserFacingText(item)}</span>
                    ))}
                </div>
                <div>
                  {(selectedRun.modelAnalysis?.missingEvidence ?? [
                    "Fresh source confirmation",
                    "Venue orderbook depth",
                    "Resolution wording",
                  ]).slice(0, 4).map((item) => (
                    <span key={item}>{cleanUserFacingText(item)}</span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {selectedRun ? <MarketFlowSnapshot run={selectedRun} compact /> : null}
          {selectedRun ? <SocialEngagementSnapshot run={selectedRun} compact /> : null}
          {selectedRun ? <EvidenceDrawer run={selectedRun} /> : null}

          <section className="mi-reportBlock">
            <div className="mi-blockHeader">
              <h3>Manual execution gate</h3>
              <span>{selectedRun?.policy.status ?? "review"}</span>
            </div>
            <p>
              {selectedRun
                ? "Pick the next action. The agent can stage a manual intent and record an Arc proof; wallet execution remains disabled."
                : "Analyze this market first; intent staging stays locked until the agent produces a fresh recommendation."}
            </p>
            {runState === "running" && activeTrace.length > 0 ? (
              <AgentTrace steps={activeTrace} compact />
            ) : null}
            {selectedRun?.paidResearch ? (
              <div className="mi-x402Complete">
                <CheckCircle2 size={16} />
                <div>
                  <strong>x402 research complete</strong>
                  <span>{formatPaidResearchCompletion(selectedPaidServices)}</span>
                </div>
              </div>
            ) : selectedRun ? (
              <button
                type="button"
                className="mi-x402Upgrade"
                onClick={() => onRunPaidResearch(selectedRun)}
                disabled={runState === "running"}
                title={`Spend up to ${LIVE_X402_RESEARCH_BUDGET_USDC} USDC through Circle x402 marketplace services, then refresh the decision.`}
              >
                <Sparkles size={14} />
                Upgrade with Circle x402
              </button>
            ) : null}
            {selectedRun?.paidResearch ? <X402PaymentRecords run={selectedRun} compact /> : null}
            {selectedRun?.paidResearch ? <PaidResearchImpactSummary run={selectedRun} compact /> : null}
            <div className="mi-actionRow mi-decisionActions">
              <button type="button" className="mi-actionSecondary" onClick={() => onStageIntent("AVOID", "AUTO")} disabled={!selectedRun}>
                <ShieldCheck size={14} />
                Avoid
              </button>
              <button type="button" className="mi-actionSecondary" onClick={() => onStageIntent("WATCH", "AUTO")} disabled={!selectedRun}>
                <Radar size={14} />
                Watch
              </button>
              <button
                type="button"
                className="mi-actionPrimary"
                onClick={() => onStageIntent("APPROVE_INTENT", selectedRecommendedSide === "NONE" ? "AUTO" : selectedRecommendedSide)}
                disabled={!selectedRun || selectedRecommendedSide === "NONE"}
                title={selectedRun && selectedRecommendedSide !== "NONE" ? selectedAgentIntentLabel : "No positive sized edge is available."}
              >
                <WalletCards size={14} />
                {selectedAgentIntentLabel}
              </button>
              <button type="button" className="mi-actionStrong" onClick={() => onStageIntent("APPROVE_INTENT", "YES")} disabled={!selectedRun}>
                <WalletCards size={14} />
                Stage YES intent
              </button>
              <button type="button" className="mi-actionStrong" onClick={() => onStageIntent("APPROVE_INTENT", "NO")} disabled={!selectedRun}>
                <WalletCards size={14} />
                Stage NO intent
              </button>
            </div>
            {selectedIntent ? (
              <div className="mi-proofPrompt">
                <p>
                  Intent staged: {formatIntentSide(selectedIntent)} / {selectedIntent.executionState.replaceAll("_", " ")} / {formatStake(selectedIntent.stakeUsdc)}.
                </p>
                <button
                  type="button"
                  onClick={() => onRecordArcProof(selectedIntent.id)}
                  disabled={receipt.status === "loading"}
                >
                  <ReceiptText size={14} />
                  {receipt.status === "loading" ? "Recording proof" : "Record proof on Arc"}
                </button>
                {selectedProof?.explorerUrl ? (
                  <a href={selectedProof.explorerUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={13} />
                    Open Arc proof
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
          </aside>
        ) : (
          <aside className="mi-report">
            <section className="mi-reportBlock">
              <div className="mi-blockHeader">
                <h3>Ready for a Polymarket link</h3>
                <span>Manual</span>
              </div>
              <p>
                Nothing is selected yet. Load a live Polymarket link, then press Analyze for the full agent run.
              </p>
            </section>
          </aside>
        )}
      </div>
    </section>
  );
}

function IdeasPage({
  sourceCount,
  newsBites,
  selectedProposal,
  onAnalyzeIdea,
  onCopyIdea,
  onRefreshNews,
}: {
  sourceCount: number;
  newsBites: NewsBiteState;
  selectedProposal: EventIdea | null;
  onAnalyzeIdea: (idea: EventIdea) => void;
  onCopyIdea: (idea: EventIdea) => void;
  onRefreshNews: () => void;
}) {
  const highPotential = newsBites.items.filter((item) => item.marketPotential === "High").length;
  const sourceBacked = newsBites.items.filter((item) => item.sourceSupport.length > 0).length;
  const radarSummary =
    newsBites.status === "loading"
      ? "Scanning live sources..."
      : `${newsBites.items.length} items / ${highPotential} high / ${sourceBacked} source-backed / ${sourceCount} sources`;

  return (
    <section className="mi-workspace narrow">
      <div className="mi-digestHeader">
        <div>
          <p>Market discovery</p>
          <h1>Market Ideas</h1>
          <span>Turkey event discovery for markets that should exist but do not yet.</span>
        </div>
        <div className="mi-digestScore">
          <strong>{sourceCount}</strong>
          <span>registered sources</span>
        </div>
      </div>

      <div className="mi-digestBanner">
        <div>
          <strong>Daily Turkey market brief</strong>
          <p>
            The agent scans macro, FX, policy, legal, sports-integrity, and local-news signals, then turns promising events into market specs.
          </p>
        </div>
        <div className="mi-reportMotion" aria-label="Report generation preview">
          <span />
          <span />
          <span />
        </div>
      </div>

      <section className="mi-reportingPanel">
        <div>
          <Sparkles size={18} />
          <strong>Live event radar</strong>
          <p>
            Daily and weekly Turkey stories are scored for market potential. Your registered sources improve the follow-up analysis.
          </p>
        </div>
        <span>{radarSummary}</span>
      </section>

      <section className="mi-liveNewsPanel">
        <div className="mi-sectionHeader">
          <div>
            <h2>Today and this week</h2>
            <p>
              {newsBites.digest ??
                "Scanning fresh Turkey-focused events. Scores are market-potential scores, not event probabilities."}
            </p>
          </div>
          <button
            type="button"
            className="mi-softButton"
            onClick={onRefreshNews}
            disabled={newsBites.status === "loading"}
          >
            <Search size={14} />
            {newsBites.status === "loading" ? "Scanning" : "Refresh"}
          </button>
        </div>

        {newsBites.status === "loading" ? <NewsBiteLoading /> : null}

        {newsBites.status === "error" ? (
          <section className="mi-emptyState compact">
            <Search size={20} />
            <h3>News discovery needs attention</h3>
            <p>{newsBites.message ?? "The live feed could not be loaded."}</p>
          </section>
        ) : null}

        {newsBites.status !== "loading" && newsBites.items.length > 0 ? (
          <div className="mi-newsBiteGrid">
            {newsBites.items.map((item) => (
              <NewsBiteCard
                item={item}
                key={item.id}
                onAnalyze={() => onAnalyzeIdea(newsBiteToIdea(item))}
                onCopy={() => onCopyIdea(newsBiteToIdea(item))}
              />
            ))}
          </div>
        ) : null}

        {newsBites.updatedAt ? (
          <p className="mi-panelNote">
            Last scan: {formatDateTime(newsBites.updatedAt)} / Provider: {newsBites.provider ?? "live feed"}.
          </p>
        ) : null}
      </section>

      {selectedProposal ? <MarketProposalCard idea={selectedProposal} /> : null}

    </section>
  );
}

function NewsBiteLoading() {
  return (
    <div className="mi-newsBiteLoading" aria-label="Loading market-worthy news">
      <div>
        <span />
        <span />
        <span />
      </div>
      <p>Scanning Turkey news, legal events, macro releases, sports integrity signals, and source quality...</p>
    </div>
  );
}

function NewsBiteCard({
  item,
  onAnalyze,
  onCopy,
}: {
  item: NewsBite;
  onAnalyze: () => void;
  onCopy: () => void;
}) {
  const showSignal = item.marketPotential !== "Medium";

  return (
    <article className={showSignal ? `mi-newsBite ${item.marketPotential.toLowerCase()}` : "mi-newsBite"}>
      <div className="mi-newsThumb">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={item.thumbnailUrl}
            onError={(event) => {
              event.currentTarget.remove();
            }}
          />
        ) : (
          <Newspaper size={26} />
        )}
        <span>{item.category}</span>
      </div>

      <div className="mi-newsBody">
        <div className="mi-newsMeta">
          <span>{item.sourceName}</span>
          <span>{item.horizon}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
      </div>

      <div className="mi-newsBiteFooter">
        {showSignal ? (
          <span
            className={`mi-marketPotential ${item.marketPotential.toLowerCase()}`}
            title={item.scoreExplanation}
          >
            {item.marketPotential} potential
          </span>
        ) : null}
        {showSignal ? (
          <span className="mi-marketScore" title={item.scoreExplanation}>
            {item.score}/100
          </span>
        ) : null}
        <a href={item.url} target="_blank" rel="noreferrer" title="Open original news source">
          <ArrowUpRight size={13} />
          Source
        </a>
      </div>

      <div className="mi-newsHover">
        <strong>Why it may deserve a market</strong>
        {item.reasons.slice(0, 4).map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
        {item.sourceSupport.length > 0 ? (
          <small>Registered support: {item.sourceSupport.slice(0, 2).join(", ")}</small>
        ) : null}
        {item.demandSignals?.length ? <small>Demand check: {item.demandSignals[0]}</small> : null}
        <small>{item.resolutionHint}</small>
      </div>

      <div className="mi-newsActions">
        <button type="button" onClick={onAnalyze}>
          <Bot size={14} />
          Analyze idea
        </button>
        <button type="button" onClick={onCopy}>
          <Clipboard size={14} />
          Proposal
        </button>
      </div>
    </article>
  );
}

function MarketProposalCard({ idea }: { idea: EventIdea }) {
  const reasons = idea.reasons?.length
    ? idea.reasons
    : [
        "The event has a clear public-interest hook.",
        "The outcome can be resolved from dated public sources.",
        "Demand can be validated before launch through watch mode.",
      ];
  const sourceParts = idea.source.split(" / ");

  return (
    <section className="mi-proposalCard">
      <div className="mi-proposalHeader">
        <div>
          <p>Market proposal draft</p>
          <h2>{idea.question}</h2>
        </div>
        <span>{idea.score}/100</span>
      </div>

      <div className="mi-proposalGrid">
        <section>
          <strong>Why this could trade</strong>
          <p>{cleanUserFacingText(idea.summary)}</p>
        </section>
        <section>
          <strong>Resolution design</strong>
          <p>{cleanUserFacingText(idea.resolutionHint ?? "Use an official source or a clearly timestamped venue result.")}</p>
        </section>
        <section>
          <strong>Source plan</strong>
          <p>{sourceParts[0]} as the first source. Registered sources can add local context and credibility checks.</p>
        </section>
      </div>

      <div className="mi-proposalReasons">
        {reasons.slice(0, 4).map((reason) => (
          <span key={reason}>{cleanUserFacingText(reason)}</span>
        ))}
      </div>

      <div className="mi-proposalFooter">
        <span>{idea.category}</span>
        <span>{idea.time}</span>
        {idea.url ? (
          <a href={idea.url} target="_blank" rel="noreferrer">
            <ExternalLink size={13} />
            Source
          </a>
        ) : null}
      </div>
    </section>
  );
}

function newsBiteToIdea(item: NewsBite): EventIdea {
  return {
    id: item.id,
    title: item.title,
    source: `${item.sourceName} / ${item.url}`,
    category: item.category,
    time: `${item.horizon} / ${item.publishedAt}`,
    score: item.score,
    summary: `${item.summary} Market-potential score: ${item.score}/100. ${item.resolutionHint}`,
    question: item.suggestedQuestion,
    reasons: [...item.reasons, ...(item.demandSignals ?? [])],
    resolutionHint: item.resolutionHint,
    url: item.url,
  };
}

function SourcesPage({
  records,
  sourceForm,
  setSourceForm,
  saveState,
  onSave,
}: {
  records: SourceRegistryState["records"];
  sourceForm: SourceFormState;
  setSourceForm: (value: SourceFormState) => void;
  saveState: "idle" | "saving" | "saved" | "error";
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (field: keyof SourceFormState, value: string) => {
    setSourceForm({
      ...sourceForm,
      [field]: value,
    });
  };

  return (
    <section className="mi-workspace narrow">
      <div className="mi-pageTitle">
        <div>
          <p>Source registry</p>
          <h1>Sources</h1>
        </div>
      </div>

      <form className="mi-sourceComposer" onSubmit={onSave}>
        <div className="mi-sourceComposerGrid">
          <label>
            <span>Name</span>
            <input
              value={sourceForm.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="BloombergHT, TCMB, X account list..."
              required
            />
          </label>
          <label>
            <span>Type</span>
            <select value={sourceForm.type} onChange={(event) => update("type", event.target.value)}>
              <option>Official data</option>
              <option>Paid data</option>
              <option>Newswire</option>
              <option>Local press</option>
              <option>Social signal</option>
              <option>X account</option>
              <option>Community report</option>
            </select>
          </label>
          <label>
            <span>Credibility</span>
            <select
              value={sourceForm.credibility}
              onChange={(event) => update("credibility", event.target.value)}
            >
              <option>Official</option>
              <option>High</option>
              <option>Medium</option>
              <option>Watch</option>
              <option>Machine-readable</option>
              <option>Weighted</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={sourceForm.status} onChange={(event) => update("status", event.target.value)}>
              <option>Active</option>
              <option>Needs curation</option>
              <option>Watch</option>
            </select>
          </label>
          <label>
            <span>Coverage</span>
            <input
              value={sourceForm.coverage}
              onChange={(event) => update("coverage", event.target.value)}
              placeholder="Turkey macro, sports integrity, FX..."
              required
            />
          </label>
          <label>
            <span>Role</span>
            <input
              value={sourceForm.role}
              onChange={(event) => update("role", event.target.value)}
              placeholder="Resolution source, early signal, validation..."
              required
            />
          </label>
          <label className="wide">
            <span>Domains or accounts</span>
            <input
              value={sourceForm.domains}
              onChange={(event) => update("domains", event.target.value)}
              placeholder="tcmb.gov.tr, tuik.gov.tr, x.com/example"
              required
            />
          </label>
          <label className="wide">
            <span>Notes</span>
            <input
              value={sourceForm.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="How should the agent use this source?"
            />
          </label>
        </div>
        <div className="mi-sourceComposerFooter">
          <span>{saveState === "saved" ? "Source saved." : saveState === "error" ? "Could not save source." : "Add trusted sites, X accounts, or official sources here."}</span>
          <button type="submit" disabled={saveState === "saving"}>
            <Plus size={14} />
            {saveState === "saving" ? "Saving" : "Add source"}
          </button>
        </div>
      </form>

      <div className="mi-sourceList">
        {records.map((record) => (
          <article className="mi-sourceCard" key={record.id}>
            <div>
              <strong>{record.name}</strong>
              <p>{record.coverage}</p>
            </div>
            <span>{record.credibility}</span>
            <span>{record.status}</span>
            <small>{record.domains?.slice(0, 3).join(", ") || record.role}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActivityPage({
  runs,
  intents,
  receipt,
  tradeIntent,
  onRecordArcProof,
}: {
  runs: AgentRunRecord[];
  intents: IntentLedgerState["intents"];
  receipt: RecordedIntentReceiptState;
  tradeIntent: TradeIntentState;
  onRecordArcProof: (intentId?: string) => void;
}) {
  const sortedRuns = [...runs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const sortedIntents = [...intents].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const latestReceipt = receipt.receipt;
  const latestReceiptIntentId = latestReceipt?.intent?.id;
  const latestIntent = tradeIntent.intent ?? sortedIntents[0] ?? null;
  const x402RunCount = sortedRuns.filter((run) => Boolean(run.paidResearch)).length;

  return (
    <section className="mi-workspace">
      <div className="mi-pageTitle">
        <div>
          <p>Proof and agent memory</p>
          <h1>Activity</h1>
        </div>
      </div>

      {tradeIntent.message ? (
        <div className={tradeIntent.status === "error" ? "mi-inlineError" : "mi-inlineSuccess"}>
          {tradeIntent.message}
        </div>
      ) : null}
      {receipt.message && receipt.status !== "error" ? (
        <div className="mi-inlineSuccess">{receipt.message}</div>
      ) : null}

      <div className="mi-activityDocument">
        <div className="mi-activityOverview">
          <DataPoint label="Analysis runs" value={`${runs.length}`} />
          <DataPoint label="Manual intents" value={`${intents.length}`} />
          <DataPoint label="x402 enriched" value={`${x402RunCount}`} />
          <DataPoint label="Latest proof" value={formatProofStatus(receipt)} />
        </div>

        <section className={`mi-proofDocument ${receipt.status}`}>
          <div className="mi-proofDocumentTop">
            <div>
              <span>Arc proof ledger</span>
              <h2>
                {latestReceipt?.expectedReceiptId
                  ? `Receipt #${latestReceipt.expectedReceiptId}`
                  : receipt.status === "loading"
                    ? "Recording proof"
                    : "No proof selected"}
              </h2>
              <p>
                Manual intent proofs are written only after you click record. The latest recorded proof is shown here with its transaction link.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRecordArcProof(latestIntent?.id)}
              disabled={receipt.status === "loading" || !latestIntent}
            >
              <ReceiptText size={14} />
              {receipt.status === "loading" ? "Recording" : "Record latest"}
            </button>
          </div>

          {receipt.status === "error" ? (
            <div className="mi-proofError">{receipt.message ?? "Arc proof recording failed."}</div>
          ) : null}

          <div className="mi-proofMetaGrid">
            <DataPoint label="Status" value={formatProofStatus(receipt)} />
            <DataPoint label="Intent" value={latestReceiptIntentId ? shortId(latestReceiptIntentId) : "not recorded"} />
            <DataPoint label="Side" value={latestReceipt?.intent ? formatIntentSide(latestReceipt.intent) : "n/a"} />
            <DataPoint label="Mode" value={formatRecordingMode(latestReceipt?.recordingMode)} />
          </div>

          {latestReceipt ? (
            <div className="mi-proofReceipt">
              <div>
                <strong>{latestReceipt.intent?.market ?? "Recorded intent"}</strong>
                <span>{latestReceipt.transactionHash ? shortTx(latestReceipt.transactionHash) : "transaction hash pending"}</span>
              </div>
              {latestReceipt.explorerUrl ? (
                <a className="mi-linkButton" href={latestReceipt.explorerUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} />
                  Open proof
                </a>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="mi-ledgerDocumentGrid">
          <section className="mi-reportBlock mi-ledgerPanel">
            <div className="mi-blockHeader">
              <h3>Manual intent ledger</h3>
              <span>{sortedIntents.length}</span>
            </div>
            <div className="mi-documentScroll">
              {sortedIntents.slice(0, 18).map((intent) => (
                <article
                  className={`mi-documentIntent ${latestReceiptIntentId === intent.id ? "recorded" : ""}`}
                  key={intent.id}
                >
                  <div>
                    <strong>{intent.market}</strong>
                    <span>{shortId(intent.id)} / {formatDateTime(intent.createdAt)}</span>
                  </div>
                  <div className="mi-documentIntentMeta">
                    <span>{formatIntentSide(intent)}</span>
                    <span>{intent.executionState.replaceAll("_", " ")}</span>
                    <span>{formatStake(intent.stakeUsdc)}</span>
                    {latestReceiptIntentId === intent.id ? <b>proof recorded</b> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRecordArcProof(intent.id)}
                    disabled={receipt.status === "loading"}
                  >
                    <ReceiptText size={13} />
                    Proof
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="mi-reportBlock mi-ledgerPanel">
            <div className="mi-blockHeader">
              <h3>Analysis run ledger</h3>
              <span>{sortedRuns.length}</span>
            </div>
            <div className="mi-documentScroll">
              {sortedRuns.slice(0, 12).map((run) => (
                <details className="mi-ledgerDetail mi-documentRun" key={run.id}>
                  <summary>
                    <strong title={run.id}>{shortId(run.id)}</strong>
                    <span>{run.market}</span>
                    <small>{formatActionLabel(run.modelAnalysis?.recommendation ?? run.action)} / {run.modelAnalysis?.riskGate ?? run.riskGate} / {formatDateTime(run.createdAt)}</small>
                  </summary>
                  <div className="mi-ledgerExpanded">
                    <div className="mi-chatRunGrid">
                      <DataPoint label="Venue price" value={formatRunMarketPrice(run)} />
                      <DataPoint label="Agent" value={formatPercent(run.analysis?.agentProbability)} />
                      <DataPoint label="Confidence" value={formatPercent(run.modelAnalysis?.confidence ?? run.confidence)} />
                      <DataPoint label="Stake" value={formatStake(run.sizing.stakeUsdc)} />
                    </div>
                    {run.paidResearch ? <PaidResearchImpactSummary run={run} compact /> : null}
                    <p>{cleanUserFacingText(run.modelAnalysis?.thesis ?? run.summary)}</p>
                    <AgentTrace steps={buildAgentTrace("complete", run)} collapsible />
                    <div className="mi-chatEvidenceGrid">
                      <EvidenceList title="Key drivers" items={run.modelAnalysis?.keyDrivers ?? []} />
                      <EvidenceList title="Missing evidence" items={run.modelAnalysis?.missingEvidence ?? []} />
                      <EvidenceList title="Source quality review" items={run.modelAnalysis?.sourceCredibilityNotes ?? []} />
                    </div>
                    <CryptoQualityReview run={run} />
                    <MarketFlowSnapshot run={run} compact />
                    <SocialEngagementSnapshot run={run} compact />
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function formatProofStatus(receipt: RecordedIntentReceiptState) {
  if (receipt.status === "loading") return "recording";
  if (receipt.status === "error") return "error";
  if (receipt.status === "ok" && receipt.receipt) return "recorded";
  return "not recorded";
}

function formatRecordingMode(mode?: string) {
  if (!mode) return "n/a";
  if (mode.includes("circle-agent")) return "Circle wallet";
  if (mode.includes("fallback")) return "Arc fallback";
  return mode.replaceAll("_", " ");
}

function shortTx(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function SystemPage({
  arcState,
  gatewayState,
  x402Snapshot,
  integrityState,
  researchState,
  sentientResearchConfig,
  deepSearchState,
  reviewPackState,
  productReadinessState,
  policyState,
  sourceRegistryState,
}: {
  arcState: ArcState;
  gatewayState: GatewayState;
  x402Snapshot: X402SnapshotState;
  integrityState: IntegrityState;
  researchState: ResearchState;
  sentientResearchConfig: SentientResearchConfigState;
  deepSearchState: DeepSearchState;
  reviewPackState: ReviewPackState;
  productReadinessState: ProductReadinessState;
  policyState: AgentPolicyState;
  sourceRegistryState: SourceRegistryState;
}) {
  return (
    <section className="mi-workspace narrow">
      <div className="mi-pageTitle">
        <div>
          <p>Technical layer</p>
          <h1>System</h1>
        </div>
      </div>

      <div className="mi-systemGrid">
        <SystemTile icon={Network} label="Arc" value={arcState.status} detail={arcState.contractAddress ?? "contract pending"} />
        <SystemTile icon={WalletCards} label="Circle Gateway" value={gatewayState.status} detail={`${gatewayState.balance ?? "0"} ${gatewayState.token}`} />
        <SystemTile icon={Activity} label="x402 markets" value={x402Snapshot.status} detail={`${x402Snapshot.count} market records`} />
        <SystemTile icon={Gauge} label="Trade flow" value={integrityState.status} detail={`${integrityState.alerts.length} alert groups`} />
        <SystemTile icon={Search} label="Research" value={researchState.status} detail={`${researchState.snapshot?.sourceCount ?? 0} sources`} />
        <SystemTile icon={Sparkles} label="OpenDeepSearch" value={sentientResearchConfig.status} detail={deepSearchState.runtime?.status ?? deepSearchState.status} />
        <SystemTile icon={ShieldCheck} label="Safety" value={reviewPackState.pack?.sentient.safety ?? "loading"} detail={reviewPackState.pack?.sentient.status ?? "pipeline"} />
        <SystemTile icon={LockKeyhole} label="Policy" value={policyState.evaluation?.status ?? policyState.status} detail={`${policyState.evaluation?.ledger.remainingDailyUsdc ?? 0} USDC daily left`} />
        <SystemTile icon={FileText} label="Readiness" value={productReadinessState.status} detail={productReadinessState.blockers[0] ?? "no blocker"} />
        <SystemTile icon={Landmark} label="Sources" value={sourceRegistryState.status} detail={`${sourceRegistryState.records.length} records`} />
      </div>
    </section>
  );
}

function GlobalCommand({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
}) {
  return (
    <form className="mi-floatingCommand" onSubmit={onSubmit}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask the agent or paste a Polymarket link..."
      />
      <button type="submit" disabled={disabled}>
        <Send size={16} />
      </button>
    </form>
  );
}

function SystemTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Network;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="mi-systemTile">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value.replaceAll("_", " ")}</strong>
      <small>{detail}</small>
    </article>
  );
}

function MarketThumbnail({ market }: { market: MarketCandidate }) {
  const label = market.category.split(/\s|\//).filter(Boolean).slice(0, 2).join(" ");

  if (market.thumbnailUrl) {
    return (
      <div className={`mi-marketImage hasImage ${market.risk.toLowerCase()}`}>
        <span>{label || market.venue}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          src={market.thumbnailUrl}
          onError={(event) => {
            event.currentTarget.remove();
          }}
        />
      </div>
    );
  }

  return (
    <div className={`mi-marketImage generated ${market.risk.toLowerCase()}`}>
      <span>{label || market.venue}</span>
    </div>
  );
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div className="mi-dataPoint">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusDot({ status }: { status: "ok" | "review" | "blocked" }) {
  return <span className={`mi-statusDot ${status}`} />;
}

function RiskPill({ risk }: { risk: "Low" | "Medium" | "High" }) {
  return (
    <span className={`mi-riskPill ${risk.toLowerCase()}`} title={riskTooltip(risk)}>
      {risk}
    </span>
  );
}

function mapX402Market(market: X402SnapshotMarket): MarketCandidate {
  const probability = readProbability(market.price);
  return {
    id: `x402-${market.id}`,
    venue: "Polymarket",
    question: market.question,
    category: market.category || "Prediction market",
    probability,
    volume: market.volume || "n/a",
    liquidity: market.liquidity || "n/a",
    endDate: market.endDate || "n/a",
    signal: "Watch",
    risk: "Medium",
    agentProbability: probability === null ? 0.5 : Math.min(0.92, Math.max(0.08, probability + 0.04)),
    confidence: 0.56,
    sources: ["Circle x402 Polymarket feed", "OpenDeepSearch", "Source registry"],
    marketPriceLabel: market.price || formatMarketPriceLabel(probability),
    origin: "x402",
    originalUrl: buildVenueUrl("Polymarket", market.id, market.question),
    thumbnailUrl: market.imageUrl ?? null,
  };
}

function marketFromRun(run: AgentRunRecord): MarketCandidate {
  return {
    id: run.marketId,
    venue: run.venue,
    question: run.market,
    category: run.category,
    probability: run.analysis?.marketProbability ?? null,
    volume: run.venue === "Draft" ? "Idea" : "Analyzed market",
    liquidity: "Previously analyzed",
    endDate: "Open",
    signal: "Watch",
    risk: run.analysis?.inputRisk ?? "Medium",
    agentProbability: run.analysis?.agentProbability ?? 0.5,
    confidence: run.modelAnalysis?.confidence ?? run.confidence,
    sources: run.sources,
    marketPriceLabel: run.marketPriceLabel,
    origin: run.marketId.startsWith("x402-") ? "x402" : run.originalUrl ? "linked" : "demo",
    originalUrl: run.originalUrl,
    marketSlug: run.marketSlug,
    conditionId: run.conditionId,
    tokenIds: run.tokenIds,
    outcomeSummary: run.outcomeSummary,
  };
}

function buildMarketRecents(runs: AgentRunRecord[]): MarketRecent[] {
  const seen = new Set<string>();
  const recents: MarketRecent[] = [];

  [...runs]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .forEach((run) => {
      if (seen.has(run.marketId)) return;
      if (!run.originalUrl && run.venue !== "Polymarket" && !run.marketId.startsWith("idea-")) return;

      seen.add(run.marketId);
      recents.push({
        id: run.marketId,
        title: run.market,
        venue: run.venue,
        updatedAt: run.createdAt,
      });
    });

  return recents.slice(0, 14);
}

function isDisplayableX402Market(market: X402SnapshotMarket) {
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

function isStoredMarketCandidate(value: unknown): value is MarketCandidate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    (record.venue === "Polymarket" || record.venue === "Draft") &&
    typeof record.question === "string" &&
    typeof record.category === "string" &&
    (typeof record.probability === "number" || record.probability === null) &&
    typeof record.volume === "string" &&
    typeof record.liquidity === "string" &&
    typeof record.endDate === "string" &&
    (record.signal === "Unchecked" || record.signal === "Watch" || record.signal === "Edge" || record.signal === "Risk") &&
    (record.risk === "Low" || record.risk === "Medium" || record.risk === "High") &&
    typeof record.agentProbability === "number" &&
    typeof record.confidence === "number" &&
    Array.isArray(record.sources) &&
    record.sources.every((source) => typeof source === "string") &&
    (record.origin === "demo" || record.origin === "x402" || record.origin === "linked")
  );
}

function isRunForMarket(run: AgentRunRecord, market: MarketCandidate) {
  if (run.marketId !== market.id) return false;
  if (run.market !== market.question) return false;

  if (market.probability !== null && run.analysis?.marketProbability !== null) {
    const runProbability = run.analysis?.marketProbability;
    if (runProbability === undefined) return false;
    return Math.abs(runProbability - market.probability) < 0.001;
  }

  return true;
}

function parsePredictionMarketLink(link: string) {
  let slug = "";

  try {
    const url = new URL(link);
    const parts = url.pathname.split("/").filter(Boolean);
    slug = parts[parts.length - 1] ?? "";
  } catch {
    slug = link;
  }

  const normalized = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 84);
  const title = titleFromSlug(normalized || slug || "linked prediction market");
  const question = /^(will|who|what|when|which|how|does|is|are|can|should)\b/i.test(title)
    ? `${title.replace(/\?+$/, "")}?`
    : title;

  return {
    id: `linked-polymarket-${normalized || buildClientRunId(link).replace(/^draft-/, "")}`,
    question,
    category: "Linked market",
  };
}

function extractPredictionMarketLink(value: string) {
  const matches = value.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const link = matches.find((candidate) => {
    const normalized = candidate.toLowerCase();
    return normalized.includes("polymarket.com");
  });

  return link?.replace(/[),.;!?]+$/g, "") ?? null;
}

async function fetchMarketPreview(link: string, signal?: AbortSignal) {
  try {
    const response = await fetch(`/api/markets/preview?url=${encodeURIComponent(link)}`, {
      cache: "no-store",
      signal,
    });
    const data = (await response.json()) as MarketLinkPreviewResponse;

    if (!response.ok || !data.market) return null;
    return data.market;
  } catch {
    return null;
  }
}

function titleFromSlug(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildVenueUrl(venue: MarketCandidate["venue"], id: string, question: string) {
  if (venue === "Draft") return undefined;
  const normalizedId = id.replace(/^x402-/, "");
  const slug = normalizedId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  const query = encodeURIComponent(question);

  return slug ? `https://polymarket.com/event/${slug}` : `https://polymarket.com/search?query=${query}`;
}

function riskTooltip(risk: "Low" | "Medium" | "High") {
  return {
    Low: "Low risk: market flow looks relatively normal; still needs source checks before any bet.",
    Medium:
      "Medium risk: the agent sees uncertainty, thin evidence, or venue/orderbook concerns. Human review is recommended.",
    High:
      "High risk: manipulation, one-sided flow, weak evidence, or resolution ambiguity may block execution.",
  }[risk];
}

function marketIdeaVisualClass(vertical: MarketStudioSpec["vertical"]) {
  if (vertical === "Turkey Macro") return "turkeyMacro";
  if (vertical === "FX / Rates") return "fxRates";
  if (vertical === "Market Integrity") return "marketIntegrity";
  return "geopolitics";
}

function readProbability(value: string) {
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1 ? numeric / 100 : numeric;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function formatMarketPrice(market: Pick<MarketCandidate, "marketPriceLabel" | "probability" | "venue">) {
  if (market.marketPriceLabel) return market.marketPriceLabel;
  if (market.venue === "Polymarket") return formatMarketPriceLabel(market.probability) ?? "n/a";
  return formatPercent(market.probability);
}

function formatRunMarketPrice(run: AgentRunRecord) {
  if (run.marketPriceLabel) return run.marketPriceLabel;
  if (run.venue === "Polymarket") return formatMarketPriceLabel(run.analysis?.marketProbability ?? null) ?? "n/a";
  return formatPercent(run.analysis?.marketProbability);
}

function formatMarketPriceLabel(value: number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  return `${Math.round(value * 100)}¢`;
}

function formatEdge(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatStake(value: number) {
  if (!value) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatActionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatTradePlanStatus(value: "trade" | "watch" | "avoid" | "research_more") {
  if (value === "research_more") return "Research more";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncateLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function shortId(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 12)}...${value.slice(-4)}`;
}

function shortUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`.slice(0, 54);
  } catch {
    return value.slice(0, 54);
  }
}

function parseOpenDeepSearchBrief(answer: string, sourceLinks: string[]) {
  const cleaned = cleanUserFacingText(answer);
  const [rawSummary, rawSources = ""] = cleaned.split(/Search sources:\s*/i);
  const parsedSources = rawSources
    .split(/\n\s*-\s+/)
    .map((line) => line.replace(/^-\s+/, "").trim())
    .filter(Boolean)
    .reduce<ParsedResearchSource[]>((sources, line) => {
      const match = line.match(/^(.*?)\s+\((https?:\/\/[^)]+)\):\s*(.*)$/);
      if (!match) return sources;
      sources.push({
        title: cleanUserFacingText(match[1]),
        url: match[2],
        snippet: cleanUserFacingText(match[3]),
      });
      return sources;
    }, []);
  const knownUrls = new Set(parsedSources.map((source) => source.url));

  for (const link of sourceLinks) {
    if (!knownUrls.has(link)) {
      parsedSources.push({
        title: shortUrl(link),
        url: link,
      });
      knownUrls.add(link);
    }
  }

  return {
    summary: cleanUserFacingText(rawSummary).replace(/\n{3,}/g, "\n\n"),
    sources: parsedSources.slice(0, 8),
  };
}

function formatTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanUserFacingText(value: string) {
  return value
    .replace(/\uFFFD/g, "")
    .replace(/ï¿½/g, "")
    .replace(/Â¢/g, "¢")
    .replace(/Â£/g, "£")
    .replace(/Â¥/g, "¥")
    .replace(/Â/g, "")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€”|â€“/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/ğŸ[\s\S]{0,4}/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/ROMA\/Sentient|Sentient\/ROMA/g, "ROMA")
    .replace(/\bSentient\b/g, "research stack")
    .replace(/\bsentient\b/g, "research stack")
    .replace(/\bOpenDeepSearch\b/g, "Web research")
    .replace(/\bROMA safety review\b/g, "Safety review")
    .replace(/\bROMA\b/g, "Safety review")
    .replace(/\bprovider gap(?:s)?\b/gi, "data gap")
    .replace(/Payment details saved to:\s*\S+/gi, "")
    .replace(/PAYMENT (?:WAS |MAY HAVE BEEN )SUBMITTED[^.]*\./gi, "")
    .replace(/Error:\s*Payment submitted but request failed[^.]*\./gi, "This provider did not return usable data.")
    .replace(/Error:\s*Payment submitted but paid request failed[^.]*\./gi, "This provider did not return usable data.")
    .replace(/Server response:\s*[^.]+/gi, "")
    .replace(/\b(\d{1,3})%\s+YES implied probability\b/gi, "$1¢ YES quote")
    .replace(/\b(\d{1,3})%\s+implied probability\b/gi, "$1¢ price-implied estimate")
    .replace(/\bpriced in at\s+(\d{1,3})%\b/gi, "priced near a $1¢ YES quote")
    .replace(/\s+\./g, ".")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatResearchMode(value?: string) {
  if (!value) return null;
  return cleanUserFacingText(value.replaceAll("_", " "));
}

function buildAgentTrace(
  state: "running" | "complete" | "blocked",
  run?: AgentRunRecord | null,
): AgentTraceStep[] {
  const completed = state === "complete";
  const blocked = state === "blocked";
  const paidServices = run ? visiblePaidResearchServices(run) : [];
  const paidOk = paidServices.filter((service) => service.status === "ok").length;
  const steps: AgentTraceStep[] = [
    {
      label: "Market context",
      detail: "Reading the pasted market or prompt and preparing a clean research brief.",
      status: completed ? "done" : blocked ? "blocked" : "running",
    },
    {
      label: "Circle x402 layer",
      detail: run?.paidResearch
        ? `Paid data pass used ${paidServices.length === 0 ? "no visible" : `${paidOk}/${paidServices.length}`} services.`
        : "Checking available market, flow, and paid-data context. Live spend waits for your approval.",
      status: completed ? "done" : blocked ? "blocked" : "running",
    },
    {
      label: "OpenDeepSearch",
      detail: run?.marketResearch
        ? `Web research completed with ${run.marketResearch.sourceLinks.length} source links.`
        : "Searching the web and ranking useful sources for this exact question.",
      status: completed ? "done" : blocked ? "blocked" : "running",
    },
    {
      label: "ROMA review",
      detail:
        run?.sentientContext?.roma.lanes.join(", ") ??
        "Separating research, source quality, risk, and policy checks.",
      status: completed ? "done" : blocked ? "blocked" : "queued",
    },
  ];

  if (run && isCryptoQualityRun(run)) {
    steps.push({
      label: "Crypto quality review",
      detail: `Benchmark-style score ${run.cryptoBench?.overallScore?.toFixed(1) ?? "n/a"}/10.`,
      status: completed ? "done" : blocked ? "blocked" : "queued",
    });
  }

  steps.push(
    {
      label: "Manual safety gate",
      detail: run
        ? `${formatActionLabel(run.modelAnalysis?.recommendation ?? run.action)} / ${run.modelAnalysis?.riskGate ?? run.riskGate}. Wallet execution remains off.`
        : "No payment or bet is executed unless you approve it.",
      status: completed ? "done" : blocked ? "blocked" : "queued",
    },
  );

  return steps;
}

function markTraceStopped(steps: AgentTraceStep[]) {
  if (steps.length === 0) {
    return [
      {
        label: "Analysis stopped",
        detail: "The current request was cancelled before the agent returned a decision.",
        status: "blocked" as const,
      },
    ];
  }

  return steps.map((step) => ({
    ...step,
    detail:
      step.status === "running"
        ? "Stopped by the user before this step completed."
        : step.detail,
    status:
      step.status === "done"
        ? step.status
        : ("blocked" as AgentTraceStep["status"]),
  }));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function buildPaidResearchTrace(
  state: "running" | "complete" | "blocked",
  run?: AgentRunRecord | null,
): AgentTraceStep[] {
  const completed = state === "complete";
  const blocked = state === "blocked";
  const visibleServices = run ? visiblePaidResearchServices(run) : [];
  const serviceSteps: AgentTraceStep[] = run?.paidResearch
    ? visibleServices.map((service) => ({
        label: service.name,
        detail: `${service.provider}: ${formatPaidServiceSummary(service)}`,
        status: mapPaidServiceStatus(service.status),
      }))
    : plannedPaidResearchServices.map((service) => ({
        label: service.label,
        detail: service.detail,
        status: blocked ? "blocked" : "running",
      }));

  return [
    {
      label: "Human approval",
      detail: `Live paid research was approved with a ${LIVE_X402_RESEARCH_BUDGET_USDC} USDC cap.`,
      status: completed ? "done" : blocked ? "blocked" : "done",
    },
    ...serviceSteps,
    {
      label: "Research ingestion",
      detail:
        "Merging paid results with web research and registered sources.",
      status: completed ? "done" : blocked ? "blocked" : "queued",
    },
    {
      label: "Decision refresh",
      detail:
        run?.modelAnalysis?.summary ??
        "Refreshing recommendation, source quality, sizing, and safety gate.",
      status: completed ? "done" : blocked ? "blocked" : "queued",
    },
  ];
}

function summarizeTraceDetail(value: string, maxLength = 180) {
  const cleaned = cleanUserFacingText(value)
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

function formatPaidServiceSummary(
  service: NonNullable<AgentRunRecord["paidResearch"]>["services"][number],
) {
  if (service.status === "skipped") {
    return isExactMarketDataService(service)
      ? "Exact market-level data needs a selected outcome with condition/token IDs. The analysis used broader market activity and source checks instead."
      : "Skipped because the approved x402 pass did not need this provider for the current market.";
  }

  if (service.status === "error") {
    return "Provider did not return usable data for this market. This is tracked as a data gap, not evidence for either side.";
  }

  const source =
    service.summary || service.purpose;
  const cleaned = summarizeTraceDetail(source, 520);

  if (!cleaned) {
    return service.status === "ok"
      ? "Service completed; no compact summary was returned."
      : "Service did not return a usable summary.";
  }

  if (/^[{[]/.test(cleaned)) {
    return service.status === "ok"
      ? "Structured data returned successfully and was folded into the final analysis."
      : cleaned;
  }

  return cleaned;
}

function isExactMarketDataService(service: PaidResearchService) {
  return (
    service.id.includes("top-holders") ||
    service.id.includes("orderbooks") ||
    service.id.includes("candlesticks") ||
    service.id.includes("market-price")
  );
}

function mapPaidServiceStatus(
  status: NonNullable<AgentRunRecord["paidResearch"]>["services"][number]["status"],
) {
  if (status === "ok") return "done";
  if (status === "error") return "blocked";
  return "queued";
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;

  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "agent") &&
    typeof message.text === "string"
  );
}

function isChatThread(value: unknown): value is ChatThread {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const thread = value as Record<string, unknown>;

  return (
    typeof thread.id === "string" &&
    typeof thread.title === "string" &&
    Array.isArray(thread.messages) &&
    thread.messages.every(isChatMessage) &&
    typeof thread.updatedAt === "string"
  );
}

function isNewsBiteState(value: unknown): value is NewsBiteState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;

  return (
    typeof state.status === "string" &&
    Array.isArray(state.items) &&
    state.items.every(isNewsBite) &&
    (typeof state.updatedAt === "string" || state.updatedAt === null)
  );
}

function isNewsBite(value: unknown): value is NewsBite {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.summary === "string" &&
    typeof item.sourceName === "string" &&
    typeof item.url === "string" &&
    typeof item.category === "string" &&
    typeof item.score === "number"
  );
}

function buildChatThreadFromMessages(messages: ChatMessage[]): ChatThread {
  return {
    id: `thread-${Date.now()}`,
    title: deriveThreadTitle(messages) || "Imported chat",
    messages,
    updatedAt: messages.at(-1)?.createdAt ?? new Date().toISOString(),
  };
}

function deriveThreadTitle(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user")?.text;
  return firstUserMessage ? titleFromPrompt(firstUserMessage) : "";
}

function titleFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/https?:\/\/\S+/g, "Polymarket link")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 54 ? `${cleaned.slice(0, 51).trim()}...` : cleaned;
}

function buildClientRunId(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

  return `draft-${normalized || "prompt"}-${Date.now()}`;
}

function detectPromptCategory(prompt: string) {
  const text = prompt.toLowerCase();
  if (text.includes("cpi") || text.includes("tcmb") || text.includes("inflation")) {
    return "Turkey Macro";
  }
  if (text.includes("fed") || text.includes("rate")) {
    return "Macro";
  }
  if (text.includes("match") || text.includes("esport") || text.includes("football")) {
    return "Market Integrity";
  }
  if (
    text.includes("tutuk") ||
    text.includes("mahkeme") ||
    text.includes("hapse") ||
    text.includes("ceza") ||
    text.includes("hükümet") ||
    text.includes("government") ||
    text.includes("court")
  ) {
    return "Legal / Political Risk";
  }
  return "Custom intelligence brief";
}
