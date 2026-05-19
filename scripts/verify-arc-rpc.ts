import "dotenv/config";
import { createPublicClient, formatEther, http, isAddress } from "viem";

import { ARC_TESTNET_CHAIN_ID } from "../src/arc/analysisReceipt.js";

const rpcUrl =
  process.env.ARC_TESTNET_RPC_URL ??
  process.env.ARC_CANTEEN_RPC_URL ??
  process.env.RPC;

if (rpcUrl === undefined || rpcUrl === "") {
  throw new Error("Missing ARC_TESTNET_RPC_URL, ARC_CANTEEN_RPC_URL, or RPC in .env");
}

const client = createPublicClient({
  transport: http(rpcUrl),
});

const chainId = await client.getChainId();
if (chainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`Expected Arc Testnet chain id ${ARC_TESTNET_CHAIN_ID}, got ${chainId}`);
}

const blockNumber = await client.getBlockNumber();
const walletAddress =
  process.env.ARC_TESTNET_AGENT_WALLET_ADDRESS ?? process.env.CIRCLE_AGENT_WALLET_ADDRESS;

const result: Record<string, unknown> = {
  chainId,
  blockNumber: blockNumber.toString(),
};

if (walletAddress !== undefined && isAddress(walletAddress)) {
  const balance = await client.getBalance({ address: walletAddress });
  result.agentWallet = walletAddress;
  result.nativeUsdcBalance = formatEther(balance);
}

console.log(JSON.stringify(result, null, 2));
