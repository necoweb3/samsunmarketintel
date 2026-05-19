import { readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { buildResearchSnapshot } from "@/src/product/researchAnalysis";
import { readSourceRegistry } from "@/src/product/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_RESEARCH_CACHE = ".cache/x402/latest-research-search.json";

export async function GET() {
  try {
    const [raw, fileStat, sourceRegistry] = await Promise.all([
      readFile(DEFAULT_RESEARCH_CACHE, "utf8"),
      stat(DEFAULT_RESEARCH_CACHE),
      readSourceRegistry(),
    ]);
    const payload = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;

    return NextResponse.json(
      {
        status: "ok",
        snapshot: buildResearchSnapshot(payload, { sourceRegistry }),
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
        snapshot: null,
        updatedAt: null,
        message:
          error instanceof Error
            ? error.message
            : "No paid x402 research snapshot has been cached yet.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
