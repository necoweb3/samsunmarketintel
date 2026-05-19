import { NextResponse } from "next/server";

import { buildCurrentDemoReviewPack } from "@/src/product/demoReviewState";
import { buildProductReadiness } from "@/src/product/productReadiness";
import { buildSubmissionPack, renderSubmissionPackMarkdown } from "@/src/product/submissionPack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const [reviewPack, readiness] = await Promise.all([
    buildCurrentDemoReviewPack(),
    buildProductReadiness(),
  ]);
  const pack = buildSubmissionPack({ reviewPack, readiness });

  if (url.searchParams.get("format") === "markdown") {
    return new Response(renderSubmissionPackMarkdown(pack), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  }

  return NextResponse.json(
    {
      status: "ok",
      pack,
      markdownUrl: "/api/demo/submission-pack?format=markdown",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
