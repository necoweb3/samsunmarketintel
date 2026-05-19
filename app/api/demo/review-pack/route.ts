import { NextResponse } from "next/server";

import { buildCurrentDemoReviewPack } from "@/src/product/demoReviewState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      pack: await buildCurrentDemoReviewPack(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
