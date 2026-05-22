import { NextResponse } from "next/server";
import { z } from "zod";

import { appendTradeIntent, clearIntentLedger, readIntentLedger } from "@/src/product/intentLedger";
import { buildTradeIntent } from "@/src/product/tradeIntent";
import { evaluateToolSafety } from "@/src/product/toolSafety";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const intentSchema = z.object({
  marketId: z.string().min(1),
  market: z.string().min(1),
  requestedAction: z.enum(["APPROVE_INTENT", "WATCH", "AVOID"]),
  requestedSide: z.enum(["AUTO", "YES", "NO"]).default("AUTO"),
  targetOutcome: z.string().min(1).max(160).nullable().optional(),
  marketProbability: z.number().min(0).max(1).nullable(),
  agentProbability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  risk: z.enum(["Low", "Medium", "High"]),
  bankrollUsdc: z.number().min(0).optional(),
  origin: z.enum(["user", "model", "source_text", "memory", "scheduled_agent"]).default("user"),
  hasHumanApproval: z.boolean().default(true),
});

export async function GET() {
  const ledger = await readIntentLedger();

  return NextResponse.json(
    {
      status: "ok",
      ...ledger,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function DELETE() {
  const ledger = await clearIntentLedger();

  return NextResponse.json(
    {
      status: "ok",
      ledger,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const parsed = intentSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        intent: null,
        message: "Invalid intent request.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const intent = buildTradeIntent(parsed.data);
  const safety = evaluateToolSafety({
    action: "STAGE_INTENT",
    origin: parsed.data.origin,
    amountUsdc: intent.stakeUsdc,
    riskGate: intent.riskGate,
    confidence: parsed.data.confidence,
    hasHumanApproval: parsed.data.hasHumanApproval,
    sourceConfirmed: parsed.data.origin === "user",
  });

  if (safety.decision === "block") {
    return NextResponse.json(
      {
        status: "blocked",
        intent: null,
        safety,
        message: safety.reason,
      },
      { status: 403 },
    );
  }

  const ledger = await appendTradeIntent(intent);

  return NextResponse.json(
    {
      status: "ok",
      intent,
      ledger,
      safety,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
