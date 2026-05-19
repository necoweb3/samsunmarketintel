import { NextResponse } from "next/server";

import { buildSentientRoadmap } from "@/src/product/sentientRoadmap";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildSentientRoadmap(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
