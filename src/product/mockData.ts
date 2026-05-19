import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeDollarSign,
  BellRing,
  Binary,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileCheck2,
  Globe2,
  Landmark,
  RadioTower,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

export type MarketDecision =
  | "BET YES"
  | "BET NO"
  | "WAIT"
  | "DO NOT BET"
  | "SUSPICIOUS FLOW";

export type MarketRow = {
  id: string;
  venue: "Polymarket" | "Draft";
  question: string;
  category: string;
  price: number | null;
  volume: string;
  liquidity: string;
  endDate: string;
  signal: "Unchecked" | "Watch" | "Edge" | "Risk";
  agentProbability: number;
  confidence: number;
  decision: MarketDecision;
  suggestedSize: string;
  risk: "Low" | "Medium" | "High";
  sources: string[];
};

export type MarketDraft = {
  title: string;
  vertical: string;
  demand: string;
  resolution: string;
  risk: string;
  currency: "USDC" | "EURC";
  icon: LucideIcon;
};

export type SourceRecord = {
  name: string;
  type: string;
  coverage: string;
  credibility: string;
  role: string;
};

export type AgentRun = {
  id: string;
  input: string;
  mode: "Manual" | "Watch" | "Guarded";
  status: "Complete" | "Watching" | "Blocked";
  cost: string;
  receipt: string;
};

export const markets: MarketRow[] = [
  {
    id: "pm-btc-120k-june",
    venue: "Polymarket",
    question: "Will Bitcoin trade above $120,000 before June?",
    category: "Crypto",
    price: 0.42,
    volume: "$2.1M",
    liquidity: "$418K",
    endDate: "Jun 30",
    signal: "Edge",
    agentProbability: 0.49,
    confidence: 0.68,
    decision: "BET YES",
    suggestedSize: "1.2% bankroll",
    risk: "Low",
    sources: ["market order book", "ETF flow cluster", "macro calendar"],
  },
  {
    id: "pm-turkey-cpi",
    venue: "Draft",
    question: "Will Turkey's next annual CPI print exceed market consensus?",
    category: "Turkey Macro",
    price: null,
    volume: "Draft",
    liquidity: "Needs seed",
    endDate: "Monthly",
    signal: "Unchecked",
    agentProbability: 0.56,
    confidence: 0.55,
    decision: "WAIT",
    suggestedSize: "market design",
    risk: "Medium",
    sources: ["TURKSTAT", "TCMB", "local analyst accounts"],
  },
  {
    id: "pm-competition-upset",
    venue: "Polymarket",
    question: "Will Team Phoenix win its next league match?",
    category: "Competition Integrity",
    price: 0.18,
    volume: "$540K",
    liquidity: "$76K",
    endDate: "May 21",
    signal: "Risk",
    agentProbability: 0.21,
    confidence: 0.44,
    decision: "SUSPICIOUS FLOW",
    suggestedSize: "blocked",
    risk: "High",
    sources: ["trade clustering", "team form", "community reports"],
  },
];

export const marketDrafts: MarketDraft[] = [
  {
    title: "Turkey CPI Surprise",
    vertical: "Turkey Macro",
    demand: "Short-duration macro hedging and local information advantage.",
    resolution: "Official TURKSTAT CPI release.",
    risk: "Political ambiguity and release-time volatility.",
    currency: "USDC",
    icon: Landmark,
  },
  {
    title: "USD/TRY Volatility Window",
    vertical: "FX / Rates",
    demand: "Hedge demand around CBRT meetings and reserves data.",
    resolution: "Central bank rate decision plus official FX reference feed.",
    risk: "Oracle source selection must be precise.",
    currency: "USDC",
    icon: CircleDollarSign,
  },
  {
    title: "Competition Integrity Watch",
    vertical: "Market Integrity",
    demand: "Thin markets need suspicious-flow alerts before settlement.",
    resolution: "Official event result with pre-event trading anomaly log.",
    risk: "False positives if liquidity is very thin.",
    currency: "USDC",
    icon: RadioTower,
  },
];

export const sourceRegistry: SourceRecord[] = [
  {
    name: "TURKSTAT",
    type: "Official data",
    coverage: "Inflation, labor, GDP",
    credibility: "Resolution-grade",
    role: "Oracle source",
  },
  {
    name: "TCMB",
    type: "Official data",
    coverage: "Rates, reserves, policy",
    credibility: "Resolution-grade",
    role: "Oracle source",
  },
  {
    name: "Circle x402 market APIs",
    type: "Paid data",
    coverage: "Polymarket prices, trades, order books",
    credibility: "Machine-readable",
    role: "Market data",
  },
  {
    name: "Local X analyst list",
    type: "Social signal",
    coverage: "Turkey macro and event risk",
    credibility: "Weighted",
    role: "Early signal",
  },
  {
    name: "Turkey legal-record source set",
    type: "Official / credible news",
    coverage: "Court records, prosecutor statements, public-figure legal outcomes",
    credibility: "Needs corroboration",
    role: "Legal event oracle support",
  },
];

export const agentRuns: AgentRun[] = [
  {
    id: "run-arc-0001",
    input: "BTC above $120k by June",
    mode: "Manual",
    status: "Complete",
    cost: "0.008 testnet USDC gas",
    receipt: "Arc #0",
  },
  {
    id: "watch-competition-02",
    input: "Team Phoenix suspicious flow",
    mode: "Watch",
    status: "Watching",
    cost: "pending x402",
    receipt: "not recorded",
  },
  {
    id: "studio-tr-cpi",
    input: "Turkey CPI market design",
    mode: "Manual",
    status: "Blocked",
    cost: "$0",
    receipt: "awaiting approval",
  },
];

export const kpis = [
  { label: "Markets tracked", value: "128", icon: ChartNoAxesCombined },
  { label: "Candidate edges", value: "14", icon: Sparkles },
  { label: "Manual approvals", value: "1", icon: FileCheck2 },
  { label: "Arc receipts", value: "1", icon: Binary },
];

export const workflowSteps = [
  { label: "Market data", icon: Activity },
  { label: "Source scoring", icon: ShieldCheck },
  { label: "Probability model", icon: Zap },
  { label: "Risk gate", icon: BellRing },
  { label: "Arc receipt", icon: BadgeDollarSign },
];

export const navItems = [
  "Command Center",
  "Markets",
  "Opportunities",
  "Market Studio",
  "Source Registry",
  "Agent Runs",
  "Receipts",
];

export const focusLabels = [
  { label: "Manual approval", value: "Default" },
  { label: "Circle stack", value: "Wallet + x402" },
  { label: "Arc role", value: "Receipt layer" },
  { label: "Research stack", value: "Research + safety" },
  { label: "Region edge", value: "Turkey macro" },
  { label: "Venue feed", value: "Polymarket" },
];

export const productTone = {
  name: "Samsun Market Intel",
  subtitle: "Agentic prediction market intelligence",
  location: "Arc Testnet",
  status: "Live receipt layer",
};

export const emptyArcState = {
  status: "loading",
  contractAddress: null,
  agentWallet: null,
  agentWalletBalance: null,
  nextReceiptId: null,
  latestReceiptId: null,
  explorer: null,
};

export const sourceIcons = [Globe2, ShieldCheck, Activity, Sparkles];
