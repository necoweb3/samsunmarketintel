import { NextResponse } from "next/server";
import { createPublicClient, formatEther, http, isAddress } from "viem";
import { arcTestnet } from "viem/chains";

import { analysisReceiptAbi, ARC_TESTNET_CHAIN_ID } from "@/src/arc/analysisReceipt";

export const dynamic = "force-dynamic";

export async function GET() {
  const rpcUrl =
    process.env.ARC_TESTNET_RPC_URL ??
    process.env.ARC_CANTEEN_RPC_URL ??
    process.env.RPC;
  const contractAddress = process.env.ANALYSIS_RECEIPT_CONTRACT;
  const agentWallet =
    process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ?? process.env.CIRCLE_AGENT_WALLET_ADDRESS;

  if (!rpcUrl || !contractAddress || !isAddress(contractAddress)) {
    return NextResponse.json({
      status: "missing_config",
      chainId: ARC_TESTNET_CHAIN_ID,
      contractAddress: contractAddress ?? null,
      agentWallet: agentWallet ?? null,
    });
  }

  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl),
  });

  try {
    const chainId = await client.getChainId();
    if (chainId !== ARC_TESTNET_CHAIN_ID) {
      return NextResponse.json(
        { status: "wrong_chain", expected: ARC_TESTNET_CHAIN_ID, chainId },
        { status: 500 },
      );
    }

    const nextReceiptId = await client.readContract({
      address: contractAddress,
      abi: analysisReceiptAbi,
      functionName: "nextReceiptId",
    });

    const latestReceiptId = nextReceiptId > 0n ? nextReceiptId - 1n : null;
    const [latestReceipt, walletBalance] = await Promise.all([
      latestReceiptId === null
        ? Promise.resolve(null)
        : client.readContract({
            address: contractAddress,
            abi: analysisReceiptAbi,
            functionName: "getReceipt",
            args: [latestReceiptId],
          }),
      agentWallet && isAddress(agentWallet)
        ? client.getBalance({ address: agentWallet })
        : Promise.resolve(null),
    ]);

    const normalizedReceipt = normalizeReceipt(latestReceipt);

    return NextResponse.json(
      {
        status: "ok",
        chainId,
        contractAddress,
        agentWallet: agentWallet ?? null,
        agentWalletBalance: walletBalance === null ? null : formatEther(walletBalance),
        nextReceiptId: nextReceiptId.toString(),
        latestReceiptId: latestReceiptId?.toString() ?? null,
        latestReceipt: normalizedReceipt,
        explorer: {
          contract: `https://testnet.arcscan.app/address/${contractAddress}`,
        },
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
        status: "error",
        message: error instanceof Error ? error.message : "Unknown Arc RPC error",
      },
      { status: 500 },
    );
  }
}

function normalizeReceipt(receipt: unknown) {
  if (receipt === null) return null;

  const value = receipt as {
    agent: string;
    marketIdHash: string;
    sourceHash: string;
    runHash: string;
    marketProbabilityBps: number | bigint;
    agentProbabilityBps: number | bigint;
    edgeBps: number | bigint;
    confidenceBps: number | bigint;
    decision: number;
    riskLevel: number;
    createdAt: number | bigint;
  };

  return {
    agent: value.agent,
    marketIdHash: value.marketIdHash,
    sourceHash: value.sourceHash,
    runHash: value.runHash,
    marketProbabilityBps: Number(value.marketProbabilityBps),
    agentProbabilityBps: Number(value.agentProbabilityBps),
    edgeBps: Number(value.edgeBps),
    confidenceBps: Number(value.confidenceBps),
    decision: Number(value.decision),
    riskLevel: Number(value.riskLevel),
    createdAt: value.createdAt.toString(),
  };
}
