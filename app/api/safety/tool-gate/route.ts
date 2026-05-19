import { NextResponse } from "next/server";
import { z } from "zod";

import { buildToolSafetyReport, evaluateToolSafety } from "@/src/product/toolSafety";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  action: z.enum([
    "RUN_ANALYSIS",
    "READ_CACHE",
    "PAY_X402",
    "STAGE_INTENT",
    "RECORD_ARC_RECEIPT",
    "WALLET_TRANSFER",
    "BRIDGE_USDC",
    "SWAP_TOKENS",
    "SET_SPENDING_LIMIT",
  ]),
  origin: z.enum(["user", "model", "source_text", "memory", "scheduled_agent"]),
  amountUsdc: z.number().nonnegative().nullable().optional(),
  destination: z.string().nullable().optional(),
  service: z.string().nullable().optional(),
  riskGate: z.enum(["open", "review", "blocked"]).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  hasHumanApproval: z.boolean().optional(),
  sourceConfirmed: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json(buildToolSafetyReport(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        decision: null,
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      decision: evaluateToolSafety(parsed.data),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
