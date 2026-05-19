import { NextResponse } from "next/server";

import { buildIntentReceiptCandidate } from "@/src/product/intentReceipt";
import { readIntentLedger } from "@/src/product/intentLedger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const ledger = await readIntentLedger();
  const url = new URL(request.url);
  const requestedId = url.searchParams.get("id");
  const intent = requestedId
    ? ledger.intents.find((item) => item.id === requestedId)
    : ledger.intents[0];

  if (!intent) {
    return NextResponse.json(
      {
        status: "empty",
        candidate: null,
        message: "No staged intent is available yet.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      candidate: buildIntentReceiptCandidate({
        intent,
        contract: process.env.ANALYSIS_RECEIPT_CONTRACT,
        wallet:
          process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ??
          process.env.CIRCLE_AGENT_WALLET_ADDRESS,
      }),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
