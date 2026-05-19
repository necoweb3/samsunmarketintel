import { readFile } from "node:fs/promises";

import { evaluateAgentPolicy } from "@/src/product/agentPolicy";
import { readAgentRunLedger } from "@/src/product/agentRunLedger";
import { buildAgentThesis } from "@/src/product/agentThesis";
import { readIntentLedger } from "@/src/product/intentLedger";
import { buildIntegritySnapshot } from "@/src/product/integrityAnalysis";
import {
  attachMarketStudioSourceCoverage,
  readMarketStudioSpecs,
} from "@/src/product/marketStudio";
import { buildResearchSnapshot } from "@/src/product/researchAnalysis";
import { buildDemoReviewPack, type DemoReviewPack, type RecordedIntentProof } from "@/src/product/reviewPack";
import { readSourceRegistry } from "@/src/product/sourceRegistry";

const MARKET_CACHE = ".cache/x402/latest-polymarket-markets.json";
const TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";
const RESEARCH_CACHE = ".cache/x402/latest-research-search.json";
const RECORDED_INTENT_RECEIPT_CACHE = ".cache/arc/latest-intent-receipt.json";

export async function buildCurrentDemoReviewPack(): Promise<DemoReviewPack> {
  const [
    marketPayload,
    tradePayload,
    researchPayload,
    recordedProofPayload,
    ledger,
    sourceRegistry,
    runLedger,
    marketStudio,
  ] = await Promise.all([
    readJson(MARKET_CACHE),
    readJson(TRADES_CACHE),
    readJson(RESEARCH_CACHE),
    readJson(RECORDED_INTENT_RECEIPT_CACHE),
    readIntentLedger(),
    readSourceRegistry(),
    readAgentRunLedger(),
    readMarketStudioSpecs(),
  ]);
  const integrity = tradePayload ? buildIntegritySnapshot(tradePayload) : null;
  const research = researchPayload ? buildResearchSnapshot(researchPayload, { sourceRegistry }) : null;
  const marketCount = marketPayload ? countMarkets(marketPayload) : 0;
  const thesis = buildAgentThesis({
    marketCount,
    alert: integrity?.alerts[0] ?? null,
    research,
  });
  const policy = evaluateAgentPolicy(ledger.intents);
  const marketStudioWithCoverage = attachMarketStudioSourceCoverage(marketStudio, sourceRegistry);

  return buildDemoReviewPack({
    thesis,
    policy,
    ledger,
    marketCount,
    alerts: integrity?.alerts ?? [],
    research,
    sourceRegistry,
    marketStudio: marketStudioWithCoverage,
    recordedProof: recordedProofPayload as RecordedIntentProof | null,
    latestAgentRun: runLedger.runs[0] ?? null,
  });
}

async function readJson(path: string) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    return null;
  }
}

function countMarkets(payload: unknown) {
  const candidates = [
    getPath(payload, ["data", "response", "markets"]),
    getPath(payload, ["data", "response", "data", "markets"]),
    getPath(payload, ["data", "markets"]),
    getPath(payload, ["response", "markets"]),
    getPath(payload, ["markets"]),
  ];

  const markets = candidates.find(Array.isArray);
  return markets?.length ?? 0;
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
