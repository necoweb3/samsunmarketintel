import { readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { buildIntegrityDecision } from "@/src/product/agentDecision";
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
    const topAlert = snapshot.alerts[0];

    if (!topAlert) {
      return NextResponse.json({
        status: "empty",
        decision: null,
        message: "No trade-flow alert is available yet.",
      });
    }

    return NextResponse.json(
      {
        status: "ok",
        decision: buildIntegrityDecision({
          alert: topAlert,
          payment: snapshot.payment,
          updatedAt: fileStat.mtime.toISOString(),
        }),
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
        decision: null,
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
