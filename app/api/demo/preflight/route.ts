import { NextResponse } from "next/server";

import { buildDemoPreflight } from "@/src/product/demoPreflight";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      report: await buildDemoPreflight(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
