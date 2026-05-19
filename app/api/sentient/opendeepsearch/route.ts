import { NextResponse } from "next/server";

import { readSentientResearchConfig } from "@/src/product/sentientResearchConfig";

export async function GET() {
  return NextResponse.json(readSentientResearchConfig(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
