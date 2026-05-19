import { NextResponse } from "next/server";

import { readPrimaryModelConfig } from "@/src/product/primaryModel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(readPrimaryModelConfig(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
