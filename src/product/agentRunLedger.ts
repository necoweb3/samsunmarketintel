import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { AgentRunRecord } from "@/src/product/agentRun";

const DEFAULT_RUN_LEDGER_PATH = ".cache/agent/runs.json";
const MAX_RUN_ITEMS = 30;

export type AgentRunLedger = {
  runs: AgentRunRecord[];
  updatedAt: string | null;
};

export async function readAgentRunLedger(
  path = DEFAULT_RUN_LEDGER_PATH,
): Promise<AgentRunLedger> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as Partial<AgentRunLedger>;
    const runs = Array.isArray(parsed.runs) ? parsed.runs.filter(isAgentRunRecord) : [];

    return {
      runs,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return {
      runs: [],
      updatedAt: null,
    };
  }
}

export async function appendAgentRun(run: AgentRunRecord, path = DEFAULT_RUN_LEDGER_PATH) {
  const current = await readAgentRunLedger(path);
  const next: AgentRunLedger = {
    runs: [run, ...current.runs.filter((item) => item.id !== run.id)].slice(0, MAX_RUN_ITEMS),
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);

  return next;
}

export async function removeAgentRunsByMarketId(
  marketId: string,
  path = DEFAULT_RUN_LEDGER_PATH,
) {
  const current = await readAgentRunLedger(path);
  const next: AgentRunLedger = {
    runs: current.runs.filter((item) => item.marketId !== marketId),
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);

  return next;
}

export async function clearAgentRunLedger(path = DEFAULT_RUN_LEDGER_PATH) {
  const next: AgentRunLedger = {
    runs: [],
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);

  return next;
}

function isAgentRunRecord(value: unknown): value is AgentRunRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.marketId === "string" &&
    typeof record.market === "string" &&
    typeof record.action === "string" &&
    typeof record.createdAt === "string"
  );
}
