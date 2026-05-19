# Agent Notes

This repo is for the Arc Agora hackathon. Use the local Circle skills in `.agents/skills` when working on Arc, USDC, Gateway, x402, or Circle wallet flows.

Prefer these local references before browsing:

- `C:\Users\pc\.arc-canteen\context\AGENTS.md`
- `C:\Users\pc\.arc-canteen\context\docs\docs.arc.network\llms.txt`
- `C:\Users\pc\.arc-canteen\context\docs\developers.circle.com\llms.txt`
- `C:\Users\pc\.arc-canteen\context\samples\arc-escrow`
- `C:\Users\pc\.arc-canteen\context\samples\arc-multichain-wallet`
- `C:\Users\pc\.arc-canteen\context\samples\arc-commerce`

Arc Testnet:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- USDC ERC-20: `0x3600000000000000000000000000000000000000`

Security rules:

- Do not hardcode or commit secrets.
- Do not pass private keys in CLI flags for anything beyond local throwaway testing.
- Verify chain ID `5042002` before Arc transactions.
- Use 6 decimals for ERC-20 USDC amounts and 18 decimals for native gas accounting.
- For autonomous agent payments, use explicit budgets, allowlists, and transaction logs.

