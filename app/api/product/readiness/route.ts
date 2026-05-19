import { NextResponse } from "next/server";

import { buildProductReadiness } from "@/src/product/productReadiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await buildProductReadiness(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
