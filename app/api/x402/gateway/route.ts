import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

import { NextResponse } from "next/server";
import { isAddress } from "viem";

import { x402GatewayStatus } from "@/src/product/x402Catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const DEFAULT_WINDOWS_CIRCLE = "C:\\Users\\pc\\AppData\\Roaming\\npm\\circle.cmd";

type GatewayCliResponse = {
  data?: {
    message?: string;
    address?: string;
    total?: string;
    token?: string;
    balances?: Array<{
      network?: string;
      domain?: number;
      balance?: string;
    }>;
  };
};

export async function GET() {
  const address =
    process.env.CIRCLE_MAINNET_AGENT_WALLET_ADDRESS ?? x402GatewayStatus.agentWallet;
  const chain = process.env.CIRCLE_GATEWAY_CHAIN ?? "MATIC";

  if (!address || !isAddress(address)) {
    return NextResponse.json({
      status: "missing_config",
      chain,
      balance: x402GatewayStatus.balance,
      message: "CIRCLE_MAINNET_AGENT_WALLET_ADDRESS is not configured.",
    });
  }

  try {
    const { stdout } = await execFileAsync(
      resolveCirclePath(),
      ["gateway", "balance", "--address", address, "--chain", chain, "--output", "json"],
      {
        maxBuffer: 1024 * 1024,
        shell: process.platform === "win32",
        timeout: 20_000,
        windowsHide: true,
      },
    );

    const payload = JSON.parse(stdout) as GatewayCliResponse;
    const total = payload.data?.total ?? null;
    const primaryBalance = payload.data?.balances?.[0];

    return NextResponse.json(
      {
        status: "ok",
        address,
        chain: primaryBalance?.network ?? x402GatewayStatus.chain,
        domain: primaryBalance?.domain ?? null,
        balance: total,
        token: payload.data?.token ?? "USDC",
        message: payload.data?.message ?? null,
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        chain: x402GatewayStatus.chain,
        balance: x402GatewayStatus.balance,
        token: "USDC",
        message: error instanceof Error ? error.message : "Circle CLI is unavailable.",
        checkedAt: x402GatewayStatus.checkedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

function resolveCirclePath() {
  if (process.env.CIRCLE_CLI_PATH) return process.env.CIRCLE_CLI_PATH;
  if (process.platform === "win32" && existsSync(DEFAULT_WINDOWS_CIRCLE)) {
    return DEFAULT_WINDOWS_CIRCLE;
  }
  return "circle";
}
