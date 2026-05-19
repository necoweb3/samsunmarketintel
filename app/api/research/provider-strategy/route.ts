import { NextResponse } from "next/server";

import { buildProviderStrategy } from "@/src/product/providerStrategy";

export async function GET() {
  return NextResponse.json(buildProviderStrategy(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
