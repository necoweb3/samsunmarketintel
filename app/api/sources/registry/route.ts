import { NextResponse } from "next/server";
import { z } from "zod";

import {
  appendSourceRegistryRecord,
  readCustomSourceRegistry,
  readSourceRegistry,
  summarizeSourceRegistry,
} from "@/src/product/sourceRegistry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sourceSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2),
  type: z.enum([
    "Official data",
    "Paid data",
    "Newswire",
    "Local press",
    "Social signal",
    "X account",
    "Community report",
  ]),
  coverage: z.string().min(3),
  credibility: z.enum(["Official", "High", "Medium", "Watch", "Machine-readable", "Weighted"]),
  role: z.string().min(3),
  domains: z.array(z.string().min(1)).min(1),
  weight: z.number().min(0).max(1).optional(),
  status: z.enum(["Active", "Needs curation", "Watch"]),
  notes: z.string().min(3),
});

export async function GET() {
  const [records, customRecords] = await Promise.all([
    readSourceRegistry(),
    readCustomSourceRegistry(),
  ]);

  return NextResponse.json(
    {
      status: "ok",
      records,
      summary: summarizeSourceRegistry(records),
      custom: {
        records: customRecords.length,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  const parsed = sourceSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: "error",
        record: null,
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const customRecords = await appendSourceRegistryRecord(parsed.data);
  const records = await readSourceRegistry();

  return NextResponse.json(
    {
      status: "ok",
      record: customRecords[0],
      records,
      summary: summarizeSourceRegistry(records),
      custom: {
        records: customRecords.length,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
