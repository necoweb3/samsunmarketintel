import { readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { buildIntegritySnapshot } from "@/src/product/integrityAnalysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";

export async function GET() {
  try {
    const [raw, fileStat] = await Promise.all([
      readFile(DEFAULT_TRADES_CACHE, "utf8"),
      stat(DEFAULT_TRADES_CACHE),
    ]);
    const payload = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
    const snapshot = buildIntegritySnapshot(payload);

    return NextResponse.json(
      {
        status: "ok",
        source: "x402-cache",
        trades: snapshot.trades.length,
        alerts: snapshot.alerts.slice(0, 6),
        payment: snapshot.payment,
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
        trades: 0,
        alerts: [],
        payment: null,
        updatedAt: null,
        message:
          error instanceof Error
            ? error.message
            : "No paid x402 trade snapshot has been cached yet.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
