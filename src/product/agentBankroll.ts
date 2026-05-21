import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { isAddress } from "viem";

import { resolveCircleCliPath } from "@/src/product/circleCli";

const execFileAsync = promisify(execFile);

type GatewayCliResponse = {
  data?: {
    total?: string;
    balances?: Array<{
      balance?: string;
    }>;
  };
};

type WalletBalanceCliResponse = {
  data?: unknown;
};

export async function readAgentBankrollUsdc() {
  const override = readNumber(process.env.AGENT_BANKROLL_USDC ?? process.env.DEMO_BANKROLL_USDC);
  if (override !== null) return override;

  const gateway = await readAgentGatewaySpendableUsdc();
  if (gateway !== null) return gateway;

  return readWalletUsdcBalance();
}

export async function readAgentGatewaySpendableUsdc() {
  const address = process.env.CIRCLE_MAINNET_AGENT_WALLET_ADDRESS;
  const chain = process.env.CIRCLE_GATEWAY_CHAIN ?? "MATIC";
  if (!address || !isAddress(address)) return null;

  try {
    const { stdout } = await execFileAsync(
      resolveCircleCliPath(),
      ["gateway", "balance", "--address", address, "--chain", chain, "--output", "json"],
      {
        maxBuffer: 1024 * 1024,
        shell: process.platform === "win32",
        timeout: 15_000,
        windowsHide: true,
      },
    );
    const payload = JSON.parse(stdout) as GatewayCliResponse;
    return readNumber(payload.data?.total ?? payload.data?.balances?.[0]?.balance ?? null);
  } catch {
    return null;
  }
}

async function readWalletUsdcBalance() {
  const address = process.env.CIRCLE_MAINNET_AGENT_WALLET_ADDRESS;
  const chain = process.env.CIRCLE_WALLET_BALANCE_CHAIN ?? "BASE";
  if (!address || !isAddress(address)) return null;

  try {
    const { stdout } = await execFileAsync(
      resolveCircleCliPath(),
      ["wallet", "balance", "--address", address, "--chain", chain, "--output", "json"],
      {
        maxBuffer: 1024 * 1024,
        shell: process.platform === "win32",
        timeout: 15_000,
        windowsHide: true,
      },
    );
    const payload = JSON.parse(stdout) as WalletBalanceCliResponse;
    return extractUsdcBalance(payload);
  } catch {
    return null;
  }
}

function extractUsdcBalance(payload: WalletBalanceCliResponse) {
  const rows = collectBalanceRows(payload.data);
  const usdc = rows.find((row) => {
    const token = String(row.token ?? row.symbol ?? row.currency ?? row.asset ?? row.name ?? "").toLowerCase();
    return token === "usdc" || token.includes("usd coin");
  });
  const candidate = usdc ?? rows[0];
  return readNumber(candidate?.balance ?? candidate?.amount ?? candidate?.available ?? null);
}

function collectBalanceRows(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap(collectBalanceRows);
  }

  const record = value as Record<string, unknown>;
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

function readNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
