import { NextResponse } from "next/server";

import { buildSentientPipelineStatus } from "@/src/product/sentientActivation";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildSentientPipelineStatus(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
