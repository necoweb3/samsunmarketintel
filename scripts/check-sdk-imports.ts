const modules = [
  "@circle-fin/app-kit",
  "@circle-fin/adapter-viem-v2",
  "@circle-fin/adapter-ethers-v6",
  "@circle-fin/adapter-solana-kit",
  "@circle-fin/adapter-circle-wallets",
  "@circle-fin/bridge-kit",
  "@circle-fin/swap-kit",
  "@circle-fin/unified-balance-kit",
  "@circle-fin/developer-controlled-wallets",
  "@circle-fin/modular-wallets-core",
  "@circle-fin/smart-contract-platform",
  "@circle-fin/user-controlled-wallets",
  "@circle-fin/x402-batching",
  "@x402/core",
  "@x402/evm",
  "viem",
  "wagmi",
  "ethers",
  "@solana/kit",
  "@solana/web3.js",
  "@langchain/core",
  "@langchain/openai",
  "deepagents",
  "openai",
  "zod"
];

for (const moduleName of modules) {
  await import(moduleName);
}

console.log(`Resolved ${modules.length} Arc/Circle agent SDK packages.`);

export {};
