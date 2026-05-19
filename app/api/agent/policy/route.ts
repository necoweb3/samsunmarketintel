import { NextResponse } from "next/server";

import { evaluateAgentPolicy } from "@/src/product/agentPolicy";
import { readIntentLedger } from "@/src/product/intentLedger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const ledger = await readIntentLedger();
  const evaluation = evaluateAgentPolicy(ledger.intents);

  return NextResponse.json(
    {
      status: "ok",
      evaluation,
      updatedAt: ledger.updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
