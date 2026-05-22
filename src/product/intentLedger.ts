import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { TradeIntent } from "@/src/product/tradeIntent";

const DEFAULT_LEDGER_PATH = ".cache/agent/intents.json";
const MAX_LEDGER_ITEMS = 25;

export type IntentLedger = {
  intents: TradeIntent[];
  updatedAt: string | null;
};

export async function readIntentLedger(path = DEFAULT_LEDGER_PATH): Promise<IntentLedger> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as Partial<IntentLedger>;
    const intents = Array.isArray(parsed.intents) ? parsed.intents.filter(isTradeIntent) : [];

    return {
      intents,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return {
      intents: [],
      updatedAt: null,
    };
  }
}

export async function appendTradeIntent(intent: TradeIntent, path = DEFAULT_LEDGER_PATH) {
  const current = await readIntentLedger(path);
  const next: IntentLedger = {
    intents: [intent, ...current.intents.filter((item) => item.id !== intent.id)].slice(
      0,
      MAX_LEDGER_ITEMS,
    ),
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);

  return next;
}

export async function clearIntentLedger(path = DEFAULT_LEDGER_PATH) {
  const next: IntentLedger = {
    intents: [],
    updatedAt: new Date().toISOString(),
  };

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`);

  return next;
}

function isTradeIntent(value: unknown): value is TradeIntent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.marketId === "string" &&
    typeof record.market === "string" &&
    typeof record.createdAt === "string"
  );
}
