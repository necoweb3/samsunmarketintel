import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

import {
  ANALYSIS_RECEIPT_FUNCTION,
  analysisReceiptAbi,
  ARC_TESTNET_CHAIN_ID,
} from "@/src/arc/analysisReceipt";
import { resolveCircleCliPath } from "@/src/product/circleCli";
import { buildIntentReceiptCandidate } from "@/src/product/intentReceipt";
import { readIntentLedger } from "@/src/product/intentLedger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LATEST_INTENT_RECEIPT_CACHE = ".cache/arc/latest-intent-receipt.json";
const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    const [raw, fileStat] = await Promise.all([
      readFile(LATEST_INTENT_RECEIPT_CACHE, "utf8"),
      stat(LATEST_INTENT_RECEIPT_CACHE),
    ]);

    const receipt = JSON.parse(raw.replace(/^\uFEFF/, "")) as {
      intent?: { side?: string; market?: string };
      transactionHash?: string;
      expectedReceiptId?: string;
    };

    return NextResponse.json(
      {
        status: "ok",
        receipt,
        updatedAt: fileStat.mtime.toISOString(),
        message: receipt.intent?.market
          ? `Latest Arc proof: ${formatIntentSide(receipt.intent)} on ${receipt.intent.market}.`
          : "Latest Arc proof is available.",
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
        status: "empty",
        receipt: null,
        updatedAt: null,
        message:
          error instanceof Error
            ? error.message
            : "No recorded intent receipt cache is available yet.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { intentId?: unknown };
  const intentId = typeof body.intentId === "string" ? body.intentId : undefined;
  const rpcUrl =
    process.env.ARC_TESTNET_RPC_URL ?? process.env.ARC_CANTEEN_RPC_URL ?? process.env.RPC;
  const contractAddress = process.env.ANALYSIS_RECEIPT_CONTRACT;
  const agentWallet =
    process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ?? process.env.CIRCLE_AGENT_WALLET_ADDRESS;

  if (!rpcUrl) {
    return proofError("Missing Arc RPC URL. Set ARC_TESTNET_RPC_URL, ARC_CANTEEN_RPC_URL, or RPC.");
  }

  if (!contractAddress || !isAddress(contractAddress)) {
    return proofError("Missing ANALYSIS_RECEIPT_CONTRACT.");
  }

  if (!agentWallet || !isAddress(agentWallet)) {
    return proofError("Missing ARC_TESTNET_AGENT_WALLET_ADDRESS or CIRCLE_AGENT_WALLET_ADDRESS.");
  }

  const ledger = await readIntentLedger();
  const intent = intentId
    ? ledger.intents.find((item) => item.id === intentId)
    : ledger.intents[0];

  if (!intent) {
    return proofError("No staged intent is available yet.", 404);
  }

  const candidate = buildIntentReceiptCandidate({
    intent,
    contract: contractAddress,
    wallet: agentWallet,
  });
  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  try {
    const chainId = await client.getChainId();
    if (chainId !== ARC_TESTNET_CHAIN_ID) {
      return proofError(`Expected Arc Testnet chain id ${ARC_TESTNET_CHAIN_ID}, got ${chainId}.`);
    }

    const receiptId = await client.readContract({
      address: contractAddress,
      abi: analysisReceiptAbi,
      functionName: "nextReceiptId",
    });
    const output = await recordReceipt({
      chainId,
      client,
      rpcUrl,
      contractAddress,
      agentWallet,
      receiptId,
      intent,
      candidate,
    });

    await mkdir(".cache/arc", { recursive: true });
    await writeFile(LATEST_INTENT_RECEIPT_CACHE, `${stringifyBigInt(output)}\n`);
    const serializableOutput = parseBigIntSafe(output);

    return NextResponse.json(
      {
        status: "ok",
        receipt: serializableOutput,
        updatedAt: new Date().toISOString(),
        message: `Arc proof recorded for ${formatIntentSide(intent)} on ${intent.market}.`,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return proofError(error instanceof Error ? error.message : "Arc proof recording failed.");
  }
}

function formatIntentSide(intent: { side?: string | null; targetOutcome?: string | null }) {
  const side = intent.side ?? "intent";
  return intent.targetOutcome ? `${intent.targetOutcome} ${side}` : side;
}

async function recordReceipt({
  chainId,
  client,
  rpcUrl,
  contractAddress,
  agentWallet,
  receiptId,
  intent,
  candidate,
}: {
  chainId: number;
  client: ReturnType<typeof createPublicClient>;
  rpcUrl: string;
  contractAddress: `0x${string}`;
  agentWallet: `0x${string}`;
  receiptId: bigint;
  intent: Awaited<ReturnType<typeof readIntentLedger>>["intents"][number];
  candidate: ReturnType<typeof buildIntentReceiptCandidate>;
}) {
  try {
    const { stdout, stderr, argumentMode } = await executeCircleWithRetry({
      rpcUrl,
      contractAddress,
      agentWallet,
      receiptArgs: candidate.receiptArgs.map(String),
      rawReceiptArgs: candidate.receiptArgs,
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
    const parsedCircle = parseCircleOutput(stdout);
    const transactionHash = extractTransactionHash(parsedCircle);

    return {
      chainId,
      contractAddress,
      agentWallet,
      recordingMode: "circle-agent-wallet",
      expectedReceiptId: receiptId.toString(),
      nextReceiptId: nextReceiptId.toString(),
      transactionHash,
      intent,
      candidate,
      argumentMode,
      circle: parsedCircle,
      stderr: stderr.trim() || null,
      recordedReceipt,
      explorerUrl: transactionHash
        ? `https://testnet.arcscan.app/tx/${transactionHash}`
        : nextReceiptId > receiptId
          ? `https://testnet.arcscan.app/address/${contractAddress}`
          : undefined,
    };
  } catch (circleError) {
    return recordReceiptWithLocalFallback({
      chainId,
      client,
      rpcUrl,
      contractAddress,
      requestedAgentWallet: agentWallet,
      receiptId,
      intent,
      candidate,
      circleError,
    });
  }
}

async function recordReceiptWithLocalFallback({
  chainId,
  client,
  rpcUrl,
  contractAddress,
  requestedAgentWallet,
  receiptId,
  intent,
  candidate,
  circleError,
}: {
  chainId: number;
  client: ReturnType<typeof createPublicClient>;
  rpcUrl: string;
  contractAddress: `0x${string}`;
  requestedAgentWallet: `0x${string}`;
  receiptId: bigint;
  intent: Awaited<ReturnType<typeof readIntentLedger>>["intents"][number];
  candidate: ReturnType<typeof buildIntentReceiptCandidate>;
  circleError: unknown;
}) {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      `${extractErrorMessage(circleError)}\nLocal Arc fallback is not configured. Set DEPLOYER_PRIVATE_KEY to allow manual proof recording when Circle CLI execution fails.`,
    );
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
  const transactionHash = await walletClient.writeContract({
    account,
    address: contractAddress,
    abi: analysisReceiptAbi,
    functionName: "recordReceipt",
    args: candidate.receiptArgs,
  });
  const transactionReceipt = await client.waitForTransactionReceipt({ hash: transactionHash });
  const nextReceiptId = await client.readContract({
    address: contractAddress,
    abi: analysisReceiptAbi,
    functionName: "nextReceiptId",
  });
  const recordedReceipt = await client.readContract({
    address: contractAddress,
    abi: analysisReceiptAbi,
    functionName: "getReceipt",
    args: [receiptId],
  });

  return {
    chainId,
    contractAddress,
    agentWallet: account.address,
    requestedAgentWallet,
    recordingMode: "local-deployer-fallback-after-circle-cli",
    expectedReceiptId: receiptId.toString(),
    nextReceiptId: nextReceiptId.toString(),
    transactionHash,
    explorerUrl: `https://testnet.arcscan.app/tx/${transactionHash}`,
    intent,
    candidate,
    circleError: extractErrorMessage(circleError),
    transactionReceipt,
    recordedReceipt,
  };
}

function proofError(message: string, status = 500) {
  return NextResponse.json(
    {
      status: "error",
      receipt: null,
      updatedAt: null,
      message,
    },
    { status },
  );
}

async function executeCircleWithRetry({
  rpcUrl,
  contractAddress,
  agentWallet,
  receiptArgs,
  rawReceiptArgs,
}: {
  rpcUrl: string;
  contractAddress: `0x${string}`;
  agentWallet: `0x${string}`;
  receiptArgs: string[];
  rawReceiptArgs: readonly unknown[];
}) {
  const attempts = [
    { mode: "decimal", args: receiptArgs },
    { mode: "hex-uint8-fallback", args: formatReceiptArgsWithHexUint8s(rawReceiptArgs) },
    { mode: "hex-uint-fallback", args: formatReceiptArgsWithHexIntegers(rawReceiptArgs) },
  ];
  let lastError: unknown;
  const tried = new Set<string>();

  for (const attempt of attempts) {
    const fingerprint = attempt.args.join("|");
    if (tried.has(fingerprint)) continue;
    tried.add(fingerprint);

    try {
      return {
        ...(await executeCircle(
          buildCliArgs({
            rpcUrl,
            contractAddress,
            agentWallet,
            receiptArgs: attempt.args,
          }),
        )),
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

function buildCliArgs({
  rpcUrl,
  contractAddress,
  agentWallet,
  receiptArgs,
}: {
  rpcUrl: string;
  contractAddress: string;
  agentWallet: string;
  receiptArgs: string[];
}) {
  return [
    "wallet",
    "execute",
    ANALYSIS_RECEIPT_FUNCTION,
    ...receiptArgs,
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
}

function resolveCirclePath() {
  return resolveCircleCliPath();
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

function formatReceiptArgsWithHexUint8s(receiptArgs: readonly unknown[]) {
  return receiptArgs.map((value, index) => {
    if (index === 6 || index === 7) return formatHexInteger(value, 2);
    return String(value);
  });
}

function formatReceiptArgsWithHexIntegers(receiptArgs: readonly unknown[]) {
  return receiptArgs.map((value, index) => {
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

function parseCircleOutput(stdout: string) {
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return stdout.trim();
  }
}

function extractTransactionHash(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.match(/0x[a-fA-F0-9]{64}/)?.[0];
  }

  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const direct =
    record.transactionHash ??
    record.txHash ??
    record.hash ??
    record.transaction_hash ??
    record.tx_hash;

  if (typeof direct === "string" && /^0x[a-fA-F0-9]{64}$/.test(direct)) {
    return direct;
  }

  for (const nested of Object.values(record)) {
    const nestedHash = extractTransactionHash(nested);
    if (nestedHash) return nestedHash;
  }

  return undefined;
}

function extractErrorMessage(error: unknown) {
  let message: string;

  if (typeof error !== "object" || error === null) {
    message = error instanceof Error ? error.message : "Arc proof recording failed.";
  } else {
    const maybeOutput = error as { stdout?: string; stderr?: string; message?: string };
    message = [maybeOutput.message, maybeOutput.stderr, maybeOutput.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  const redacted = (message || "Arc proof recording failed.")
    .replace(/https:\/\/rpc\.testnet\.arc-node\.thecanteenapp\.com\/v1\/\S+/g, "[arc-canteen-rpc]")
    .replace(/https:\/\/rpc\.testnet\.arc\.network\S*/g, "[arc-testnet-rpc]");

  return redacted.length > 1200 ? `${redacted.slice(0, 1197)}...` : redacted;
}

function stringifyBigInt(value: unknown) {
  return JSON.stringify(
    value,
    (_, nestedValue: unknown) => (typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue),
    2,
  );
}

function parseBigIntSafe<T>(value: T) {
  return JSON.parse(stringifyBigInt(value)) as T;
}
