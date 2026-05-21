import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { buildCircleCliInvocation } from "@/src/product/circleCli";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

type BudgetStatus = "ok" | "missing" | "unavailable";

type BudgetItem = {
  id: string;
  label: string;
  value: string;
  detail: string;
  status: BudgetStatus;
};

type GatewayCliResponse = {
  data?: {
    total?: string;
    token?: string;
    balances?: Array<{
      network?: string;
      balance?: string;
    }>;
  };
};

type WalletBalanceCliResponse = {
  data?: unknown;
};

type OpenRouterCreditsResponse = {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
};

let budgetCache: {
  expiresAt: number;
  payload: {
    status: "ok" | "partial";
    checkedAt: string;
    items: BudgetItem[];
  };
} | null = null;

export async function GET() {
  if (budgetCache && budgetCache.expiresAt > Date.now()) {
    return NextResponse.json(budgetCache.payload, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  const gateway = await readGatewayBalance();
  const wallet = await readWalletBalance();
  const openRouter = await readOpenRouterCredits();
  const items = [gateway, wallet, openRouter];
  const payload = {
    status: items.every((item) => item.status === "ok") ? "ok" as const : "partial" as const,
    checkedAt: new Date().toISOString(),
    items,
  };
  budgetCache = {
    expiresAt: Date.now() + 5 * 60 * 1000,
    payload,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}

async function readGatewayBalance(): Promise<BudgetItem> {
  const address = process.env.CIRCLE_MAINNET_AGENT_WALLET_ADDRESS;
  const chain = process.env.CIRCLE_GATEWAY_CHAIN ?? "MATIC";

  if (!address || !isAddress(address)) {
    return missingBudgetItem("gateway", "Gateway spendable", "Set CIRCLE_MAINNET_AGENT_WALLET_ADDRESS");
  }

  try {
    const invocation = buildCircleCliInvocation([
      "gateway",
      "balance",
      "--address",
      address,
      "--chain",
      chain,
      "--output",
      "json",
    ]);
    const { stdout } = await execFileAsync(
      invocation.file,
      invocation.args,
      {
        maxBuffer: 1024 * 1024,
        shell: invocation.shell,
        timeout: 20_000,
        windowsHide: true,
      },
    );
    const payload = JSON.parse(stdout) as GatewayCliResponse;
    const total = payload.data?.total;
    const network = payload.data?.balances?.[0]?.network ?? chain;

    if (total) {
      return {
        id: "gateway",
        label: "Gateway spendable",
        value: `${formatDecimal(total)} ${payload.data?.token ?? "USDC"}`,
        detail: `${network} Gateway`,
        status: "ok",
      };
    }
  } catch (error) {
    // Fall back to demo override below.
    return unavailableBudgetItem("gateway", "Gateway spendable", summarizeCliError(error));
  }

  return unavailableBudgetItem("gateway", "Gateway spendable", "Gateway balance not returned");
}

async function readWalletBalance(): Promise<BudgetItem> {
  const address = process.env.CIRCLE_MAINNET_AGENT_WALLET_ADDRESS;
  const chain = process.env.CIRCLE_WALLET_BALANCE_CHAIN ?? "BASE";

  if (!address || !isAddress(address)) {
    return missingBudgetItem("wallet", "Wallet USDC", "Set CIRCLE_MAINNET_AGENT_WALLET_ADDRESS");
  }

  try {
    const invocation = buildCircleCliInvocation([
      "wallet",
      "balance",
      "--address",
      address,
      "--chain",
      chain,
      "--output",
      "json",
    ]);
    const { stdout } = await execFileAsync(
      invocation.file,
      invocation.args,
      {
        maxBuffer: 1024 * 1024,
        shell: invocation.shell,
        timeout: 20_000,
        windowsHide: true,
      },
    );
    const payload = JSON.parse(stdout) as WalletBalanceCliResponse;
    const balance = extractUsdcBalance(payload);

    if (balance) {
      return {
        id: "wallet",
        label: "Wallet USDC",
        value: `${formatDecimal(balance)} USDC`,
        detail: `${chain} wallet balance`,
        status: "ok",
      };
    }
  } catch (error) {
    // Report unavailable instead of showing a synthetic value.
    return unavailableBudgetItem("wallet", "Wallet USDC", summarizeCliError(error));
  }

  return unavailableBudgetItem("wallet", "Wallet USDC", `${chain} wallet balance unavailable`);
}

async function readOpenRouterCredits(): Promise<BudgetItem> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return missingBudgetItem("openrouter", "OpenRouter", "Set OPENROUTER_API_KEY");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
    const payload = (await response.json()) as OpenRouterCreditsResponse;
    const totalCredits = payload.data?.total_credits;
    const totalUsage = payload.data?.total_usage;

    if (typeof totalCredits === "number" && typeof totalUsage === "number") {
      const remaining = Math.max(0, totalCredits - totalUsage);
      return {
        id: "openrouter",
        label: "OpenRouter",
        value: `$${formatDecimal(remaining)}`,
        detail: `$${formatDecimal(totalUsage)} used / $${formatDecimal(totalCredits)} loaded`,
        status: "ok",
      };
    }
  } catch {
    // Fall back to demo override below.
  }

  return unavailableBudgetItem("openrouter", "OpenRouter", "Credit API unavailable");
}

function missingBudgetItem(id: string, label: string, detail: string): BudgetItem {
  return { id, label, value: "Not set", detail, status: "missing" };
}

function unavailableBudgetItem(id: string, label: string, detail: string): BudgetItem {
  return { id, label, value: "Unavailable", detail, status: "unavailable" };
}

function summarizeCliError(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const stderr = typeof record.stderr === "string" ? record.stderr : "";
  const message = error instanceof Error ? error.message : String(error);
  const detail = stderr || message;

  if (/not recognized|ENOENT|no such file|cannot find/i.test(detail)) {
    return "Circle CLI binary unavailable";
  }
  if (/login|auth|unauthorized|session|token/i.test(detail)) {
    return "Circle CLI wallet session unavailable";
  }
  if (/429|too many requests|rate limit|cloudflare/i.test(detail)) {
    return "Circle API rate limited; retry shortly";
  }

  return detail.slice(0, 180) || "Circle CLI unavailable";
}

function formatDecimal(value: string | number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return String(value);
  return numberValue.toLocaleString("en-US", {
    maximumFractionDigits: numberValue < 1 ? 4 : 2,
    minimumFractionDigits: numberValue < 1 ? 0 : 2,
  });
}

function extractUsdcBalance(payload: WalletBalanceCliResponse) {
  const balances = collectBalanceRows(payload.data);
  const usdc = balances.find((row) => {
    const token = String(row.token ?? row.symbol ?? row.currency ?? row.asset ?? row.name ?? "")
      .toLowerCase();
    return token === "usdc" || token.includes("usd coin");
  });
  const candidate = usdc ?? balances[0];
  const value =
    candidate?.balance ??
    candidate?.amount ??
    candidate?.available ??
    candidate?.value ??
    candidate?.quantity ??
    null;

  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function collectBalanceRows(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return [item as Record<string, unknown>, ...collectNestedBalanceRows(item)];
      }
      return collectBalanceRows(item);
    });
  }

  const record = value as Record<string, unknown>;
  return collectNestedBalanceRows(record);
}

function collectNestedBalanceRows(record: Record<string, unknown>): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];
  for (const key of ["balances", "tokens", "items", "assets"]) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      rows.push(
        ...nested.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item),
        ),
      );
    }
  }
  return rows;
}
