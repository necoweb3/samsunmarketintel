import "dotenv/config";
import { defineConfig } from "hardhat/config";

const arcRpcUrl =
  process.env.ARC_TESTNET_RPC_URL ??
  process.env.ARC_CANTEEN_RPC_URL ??
  "https://rpc.testnet.arc.network";

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

export default defineConfig({
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    arcTestnet: {
      type: "http",
      chainType: "l1",
      url: arcRpcUrl,
      accounts: deployerPrivateKey === undefined || deployerPrivateKey === "" ? [] : [deployerPrivateKey],
    },
  },
});
