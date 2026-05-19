import { NextResponse } from "next/server";
import { z } from "zod";

import {
  readOpenDeepSearchRuntime,
  runOpenDeepSearch,
} from "@/src/product/openDeepSearchRuntime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const deepSearchSchema = z.object({
  query: z.string().min(8).max(600),
  maxSources: z.number().int().min(1).max(6).optional(),
});

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      runtime: readOpenDeepSearchRuntime(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const parsed = deepSearchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        result: null,
        message: "Invalid OpenDeepSearch request.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const result = await runOpenDeepSearch(parsed.data);

  return NextResponse.json(
    {
      status: result.status,
      result,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
