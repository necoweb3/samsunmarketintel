import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  type Abi,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

import { ARC_TESTNET_CHAIN_ID } from "../src/arc/analysisReceipt.js";

const rpcUrl =
  process.env.ARC_TESTNET_RPC_URL ??
  process.env.ARC_CANTEEN_RPC_URL ??
  process.env.RPC;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

if (rpcUrl === undefined || rpcUrl === "") {
  throw new Error("Missing ARC_TESTNET_RPC_URL, ARC_CANTEEN_RPC_URL, or RPC in .env");
}

if (privateKey === undefined || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("Missing DEPLOYER_PRIVATE_KEY in .env. Use a funded Arc Testnet deployer key.");
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(rpcUrl),
});

const chainId = await publicClient.getChainId();
if (chainId !== ARC_TESTNET_CHAIN_ID) {
  throw new Error(`Expected Arc Testnet chain id ${ARC_TESTNET_CHAIN_ID}, got ${chainId}`);
}

const account = privateKeyToAccount(privateKey as Hex);
const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) {
  throw new Error(`Deployer ${account.address} has 0 native USDC on Arc Testnet.`);
}

const artifactPath = resolve(
  "artifacts",
  "contracts",
  "AnalysisReceiptLog.sol",
  "AnalysisReceiptLog.json",
);
const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
  abi: Abi;
  bytecode: Hex;
};

const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(rpcUrl),
});

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  account,
});

const receipt = await publicClient.waitForTransactionReceipt({ hash });

console.log(
  JSON.stringify(
    {
      chainId,
      deployer: account.address,
      deployerNativeUsdcBalanceBefore: formatEther(balance),
      transactionHash: hash,
      contractAddress: receipt.contractAddress,
      explorerUrl: `https://testnet.arcscan.app/tx/${hash}`,
    },
    null,
    2,
  ),
);
