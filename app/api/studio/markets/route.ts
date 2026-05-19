import { NextResponse } from "next/server";
import { z } from "zod";

import {
  appendMarketStudioSpec,
  attachMarketStudioSourceCoverage,
  readCustomMarketStudioSpecs,
  readMarketStudioSpecs,
  summarizeMarketStudio,
} from "@/src/product/marketStudio";
import { readSourceRegistry } from "@/src/product/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const marketStudioSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(2),
  vertical: z.enum(["Turkey Macro", "FX / Rates", "Market Integrity", "Legal / Political Risk"]),
  status: z.enum(["Design-ready", "Needs source list", "Watch-only"]),
  marketQuestion: z.string().min(8),
  problem: z.string().min(8),
  demand: z.string().min(8),
  settlementCurrency: z.enum(["USDC", "EURC"]),
  settlementRail: z.enum(["Arc receipt + Circle x402", "Arc receipt + Gateway"]),
  oracle: z.object({
    method: z.string().min(5),
    primarySource: z.string().min(2),
    fallbackSource: z.string().min(2),
    resolutionWindow: z.string().min(2),
  }),
  primarySources: z.array(z.string().min(1)).min(1),
  liquidityPlan: z.string().min(8),
  riskPolicy: z.string().min(8),
  launchReadiness: z.number().min(0).max(1).optional(),
});

export async function GET() {
  const [rawSpecs, customSpecs, sourceRegistry] = await Promise.all([
    readMarketStudioSpecs(),
    readCustomMarketStudioSpecs(),
    readSourceRegistry(),
  ]);
  const specs = attachMarketStudioSourceCoverage(rawSpecs, sourceRegistry);

  return NextResponse.json(
    {
      status: "ok",
      specs,
      summary: summarizeMarketStudio(specs),
      custom: {
        specs: customSpecs.length,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const parsed = marketStudioSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        spec: null,
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const customSpecs = await appendMarketStudioSpec(parsed.data);
  const [rawSpecs, sourceRegistry] = await Promise.all([
    readMarketStudioSpecs(),
    readSourceRegistry(),
  ]);
  const specs = attachMarketStudioSourceCoverage(rawSpecs, sourceRegistry);

  return NextResponse.json(
    {
      status: "ok",
      spec: customSpecs[0],
      specs,
      summary: summarizeMarketStudio(specs),
      custom: {
        specs: customSpecs.length,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
