import "dotenv/config";

import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { createPublicClient, http, isAddress } from "viem";
import { arcTestnet } from "viem/chains";

import {
  ANALYSIS_RECEIPT_FUNCTION,
  analysisReceiptAbi,
  ARC_TESTNET_CHAIN_ID,
} from "../src/arc/analysisReceipt.js";
import { buildIntegrityDecision } from "../src/product/agentDecision.js";
import { buildIntegritySnapshot } from "../src/product/integrityAnalysis.js";

const execFileAsync = promisify(execFile);
const DEFAULT_TRADES_CACHE = ".cache/x402/latest-polymarket-trades.json";

const rpcUrl =
  process.env.ARC_TESTNET_RPC_URL ?? process.env.ARC_CANTEEN_RPC_URL ?? process.env.RPC;
const contractAddress = process.env.ANALYSIS_RECEIPT_CONTRACT;
const agentWallet =
  process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ?? process.env.CIRCLE_AGENT_WALLET_ADDRESS;

if (!rpcUrl) {
  throw new Error("Missing ARC_TESTNET_RPC_URL, ARC_CANTEEN_RPC_URL, or RPC in .env");
}

if (!contractAddress || !isAddress(contractAddress)) {
  throw new Error("Missing ANALYSIS_RECEIPT_CONTRACT in .env");
}

if (!agentWallet || !isAddress(agentWallet)) {
  throw new Error("Missing ARC_TESTNET_AGENT_WALLET_ADDRESS or CIRCLE_AGENT_WALLET_ADDRESS in .env");
}

const [raw, fileStat] = await Promise.all([
  readFile(DEFAULT_TRADES_CACHE, "utf8"),
  stat(DEFAULT_TRADES_CACHE),
]);
const payload = JSON.parse(raw.replace(/^\uFEFF/, "")) as unknown;
const snapshot = buildIntegritySnapshot(payload);
const topAlert = snapshot.alerts[0];

if (!topAlert) {
  throw new Error("No integrity alert found. Run npm run x402:pay:trades first.");
}

const decision = buildIntegrityDecision({
  alert: topAlert,
  payment: snapshot.payment,
  updatedAt: fileStat.mtime.toISOString(),
});
const client = createPublicClient({
  chain: arcTestnet,
  transport: http(rpcUrl),
});

const chainId = await client.getChainId();
if (chainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`Expected Arc Testnet chain id ${ARC_TESTNET_CHAIN_ID}, got ${chainId}`);
}

const receiptId = await client.readContract({
  address: contractAddress,
  abi: analysisReceiptAbi,
  functionName: "nextReceiptId",
});

const cliArgs = [
  "wallet",
  "execute",
  ANALYSIS_RECEIPT_FUNCTION,
  ...decision.receiptArgs.map(String),
  "--contract",
  contractAddress,
  "--address",
  agentWallet,
  "--chain",
  "ARC-TESTNET",
  "--rpc-url",
  rpcUrl,
  "--output",
  "json",
];

const circleInvocation = buildCircleInvocation(cliArgs);
const { stdout, stderr } = await execFileAsync(circleInvocation.file, circleInvocation.args, {
  maxBuffer: 1024 * 1024 * 10,
  timeout: 120_000,
  windowsHide: true,
});

const nextReceiptId = await waitForReceiptIncrement(client, contractAddress, receiptId);
const recordedReceipt =
  nextReceiptId > receiptId
    ? await client.readContract({
        address: contractAddress,
        abi: analysisReceiptAbi,
        functionName: "getReceipt",
        args: [receiptId],
      })
    : null;

const output = {
  chainId,
  contractAddress,
  agentWallet,
  expectedReceiptId: receiptId.toString(),
  nextReceiptId: nextReceiptId.toString(),
  alert: topAlert,
  decision,
  circle: parseCircleOutput(stdout),
  stderr: stderr.trim() || null,
  recordedReceipt,
};

await mkdir(".cache/arc", { recursive: true });
await writeFile(
  ".cache/arc/latest-integrity-receipt.json",
  JSON.stringify(output, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2),
);

console.log(
  JSON.stringify(output, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2),
);

function resolveCirclePath() {
  if (process.env.CIRCLE_CLI_PATH) return process.env.CIRCLE_CLI_PATH;
  return "circle";
}

function buildCircleInvocation(args: string[]) {
  const circlePath = resolveCirclePath();

  if (process.platform !== "win32") {
    return { file: circlePath, args };
  }

  return {
    file: "cmd.exe",
    args: ["/d", "/s", "/c", [quoteCmdArg(circlePath), ...args.map(quoteCmdArg)].join(" ")],
  };
}

function quoteCmdArg(value: string) {
  if (/^[a-zA-Z0-9._:/\\=-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

async function waitForReceiptIncrement(
  client: ReturnType<typeof createPublicClient>,
  address: `0x${string}`,
  current: bigint,
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const next = await client.readContract({
      address,
      abi: analysisReceiptAbi,
      functionName: "nextReceiptId",
    });
    if (next > current) return next;
    await new Promise((resolve) => setTimeout(resolve, 2_500));
  }

  return current;
}

function parseCircleOutput(stdout: string) {
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return stdout.trim();
  }
}
