import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { buildAgentThesis } from "@/src/product/agentThesis";
import { buildIntegritySnapshot } from "@/src/product/integrityAnalysis";
import { buildResearchSnapshot } from "@/src/product/researchAnalysis";
import { readSourceRegistry } from "@/src/product/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MARKET_CACHE = ".cache/x402/latest-polymarket-markets.json";
const TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";
const RESEARCH_CACHE = ".cache/x402/latest-research-search.json";

export async function GET() {
  const [marketPayload, tradePayload, researchPayload, sourceRegistry] = await Promise.all([
    readJson(MARKET_CACHE),
    readJson(TRADES_CACHE),
    readJson(RESEARCH_CACHE),
    readSourceRegistry(),
  ]);
  const integrity = tradePayload ? buildIntegritySnapshot(tradePayload) : null;
  const research = researchPayload ? buildResearchSnapshot(researchPayload, { sourceRegistry }) : null;
  const marketCount = marketPayload ? countMarkets(marketPayload) : 0;

  return NextResponse.json(
    {
      status: "ok",
      thesis: buildAgentThesis({
        marketCount,
        alert: integrity?.alerts[0] ?? null,
        research,
      }),
      inputs: {
        marketSnapshot: marketPayload !== null,
        tradeFlow: tradePayload !== null,
        research: researchPayload !== null,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
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
