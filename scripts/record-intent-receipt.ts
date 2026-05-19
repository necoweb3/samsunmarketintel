import "dotenv/config";

import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { createPublicClient, http, isAddress } from "viem";
import { arcTestnet } from "viem/chains";

import {
  ANALYSIS_RECEIPT_FUNCTION,
  analysisReceiptAbi,
  ARC_TESTNET_CHAIN_ID,
} from "../src/arc/analysisReceipt.js";
import { buildIntentReceiptCandidate } from "../src/product/intentReceipt.js";
import { readIntentLedger } from "../src/product/intentLedger.js";

const execFileAsync = promisify(execFile);
const DEFAULT_WINDOWS_CIRCLE = "C:\\Users\\pc\\AppData\\Roaming\\npm\\circle.cmd";

const rpcUrl =
  process.env.ARC_TESTNET_RPC_URL ?? process.env.ARC_CANTEEN_RPC_URL ?? process.env.RPC;
const contractAddress = process.env.ANALYSIS_RECEIPT_CONTRACT;
const agentWallet =
  process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ?? process.env.CIRCLE_AGENT_WALLET_ADDRESS;
const intentId = process.argv[2];

if (!rpcUrl) {
  throw new Error("Missing ARC_TESTNET_RPC_URL, ARC_CANTEEN_RPC_URL, or RPC in .env");
}

if (!contractAddress || !isAddress(contractAddress)) {
  throw new Error("Missing ANALYSIS_RECEIPT_CONTRACT in .env");
}

if (!agentWallet || !isAddress(agentWallet)) {
  throw new Error("Missing ARC_TESTNET_AGENT_WALLET_ADDRESS or CIRCLE_AGENT_WALLET_ADDRESS in .env");
}

const checkedRpcUrl = rpcUrl;
const checkedContractAddress = contractAddress;
const checkedAgentWallet = agentWallet;

const ledger = await readIntentLedger();
const intent = intentId
  ? ledger.intents.find((item) => item.id === intentId)
  : ledger.intents[0];

if (!intent) {
  throw new Error("No staged intent found. Use the dashboard or POST /api/agent/intent first.");
}

const candidate = buildIntentReceiptCandidate({
  intent,
  contract: checkedContractAddress,
  wallet: checkedAgentWallet,
});
const client = createPublicClient({
  chain: arcTestnet,
  transport: http(checkedRpcUrl),
});

const chainId = await client.getChainId();
if (chainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`Expected Arc Testnet chain id ${ARC_TESTNET_CHAIN_ID}, got ${chainId}`);
}

const receiptId = await client.readContract({
  address: checkedContractAddress,
  abi: analysisReceiptAbi,
  functionName: "nextReceiptId",
});

const { stdout, stderr, argumentMode } = await executeCircleWithRetry();

const nextReceiptId = await waitForReceiptIncrement(client, checkedContractAddress, receiptId);
const recordedReceipt =
  nextReceiptId > receiptId
    ? await client.readContract({
        address: checkedContractAddress,
        abi: analysisReceiptAbi,
        functionName: "getReceipt",
        args: [receiptId],
      })
    : null;

const output = {
  chainId,
  contractAddress: checkedContractAddress,
  agentWallet: checkedAgentWallet,
  expectedReceiptId: receiptId.toString(),
  nextReceiptId: nextReceiptId.toString(),
  intent,
  candidate,
  argumentMode,
  circle: parseCircleOutput(stdout),
  stderr: stderr.trim() || null,
  recordedReceipt,
};

await mkdir(".cache/arc", { recursive: true });
await writeFile(
  ".cache/arc/latest-intent-receipt.json",
  JSON.stringify(output, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2),
);

console.log(
  JSON.stringify(output, (_, value: unknown) => (typeof value === "bigint" ? value.toString() : value), 2),
);

function resolveCirclePath() {
  if (process.env.CIRCLE_CLI_PATH) return process.env.CIRCLE_CLI_PATH;
  if (process.platform === "win32") return DEFAULT_WINDOWS_CIRCLE;
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

async function executeCircleWithRetry() {
  const attempts = [
    { mode: "decimal", args: candidate.receiptArgs.map(String) },
    { mode: "hex-uint8-fallback", args: formatReceiptArgsWithHexUint8s() },
    { mode: "hex-uint-fallback", args: formatReceiptArgsWithHexIntegers() },
  ];
  let lastError: unknown;
  const tried = new Set<string>();

  for (const attempt of attempts) {
    const fingerprint = attempt.args.join("|");
    if (tried.has(fingerprint)) continue;
    tried.add(fingerprint);

    try {
      return {
        ...(await executeCircle(buildCliArgs(attempt.args))),
        argumentMode: attempt.mode,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableCircleExecuteError(error)) throw error;
    }
  }

  throw enhanceCircleExecuteError(lastError);
}

async function executeCircle(args: string[]) {
  const circleInvocation = buildCircleInvocation(args);
  return execFileAsync(circleInvocation.file, circleInvocation.args, {
    maxBuffer: 1024 * 1024 * 10,
    timeout: 120_000,
    windowsHide: true,
  });
}

function buildCliArgs(receiptArgs: string[]) {
  return [
    "wallet",
    "execute",
    ANALYSIS_RECEIPT_FUNCTION,
    ...receiptArgs,
    "--contract",
    checkedContractAddress,
    "--address",
    checkedAgentWallet,
    "--chain",
    "ARC-TESTNET",
    "--rpc-url",
    checkedRpcUrl,
    "--output",
    "json",
  ];
}

function formatReceiptArgsWithHexUint8s() {
  return candidate.receiptArgs.map((value, index) => {
    if (index === 6 || index === 7) return formatHexInteger(value, 2);
    return String(value);
  });
}

function formatReceiptArgsWithHexIntegers() {
  return candidate.receiptArgs.map((value, index) => {
    if (index >= 3 && index <= 7) return formatHexInteger(value, index >= 6 ? 2 : 4);
    return String(value);
  });
}

function formatHexInteger(value: unknown, minimumDigits: number) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) return String(value);
  return `0x${numeric.toString(16).padStart(minimumDigits, "0")}`;
}

function isRetryableCircleExecuteError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;

  const maybeOutput = error as { stdout?: string; stderr?: string; message?: string };
  const message = [maybeOutput.message, maybeOutput.stdout, maybeOutput.stderr]
    .filter(Boolean)
    .join("\n");

  return (
    message.includes("ESTIMATION_ERROR") ||
    message.includes("invalid BigNumberish") ||
    message.includes("invalid argument")
  );
}

function enhanceCircleExecuteError(error: unknown) {
  if (error instanceof Error) {
    error.message = `${error.message}\nCircle wallet execute failed after decimal and hex integer retries. The Arc contract pre-check passed, so this is most likely a Circle CLI estimation/argument encoding issue.`;
    return error;
  }

  return new Error(
    "Circle wallet execute failed after decimal and hex integer retries. The Arc contract pre-check passed, so this is most likely a Circle CLI estimation/argument encoding issue.",
  );
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
