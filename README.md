# Samsun Market Intel

Samsun Market Intel is a prediction-market intelligence product built for the Arc Agora hackathon. It solves two core problems:

- **Prediction Market Trader Intelligence:** Analyzes active markets on Polymarket using news, data, social signals, holder flow, orderbook data, and source reliability to produce better "bet / avoid / watch" decisions.
- **Prediction Market Verticals:** Surfaces new market ideas from local agendas in countries like Turkey that are underrepresented on global prediction markets, and turns them into proposals with measurable resolution rules.

In short: the user provides a Polymarket link, a market question, or a news event. Samsun Market Intel now runs as a two-layer analysis product:

1. **Base layer:** OpenDeepSearch -> ROMA review -> CryptoAnalystBench quality check when relevant -> answer.
2. **x402 upgrade layer:** Circle x402 paid services run as a separate evidence pass. BlockRun, Tavily, Exa/Parallel, market-data, social, and other relevant services run first; Perplexity Deep Research runs after that; the combined paid evidence then goes into ROMA review and, when needed, CryptoAnalystBench quality control.

The result explains which outcome makes more sense, what evidence is missing, where the market price looks wrong, how to size a position if one is to be opened, and when to wait instead.

The agent does not place bets automatically. The agent only prepares a manual trade intent; no wallet transaction or bet execution happens without user approval. If desired, this intent can be recorded as a proof/receipt on Arc Testnet.

## Why Is This Needed?

Alpha in prediction markets usually comes from information asymmetry. But looking at a market and simply asking "is YES cheap, is NO expensive?" is not enough. Good analysis needs to read all of the following at once:

- Whether the market is active, resolved, or in draft.
- The difference between venue quote and implied probability.
- Correct outcome selection in multi-outcome markets.
- How fresh the news is and how reliable the sources are.
- X/social hype level.
- Polymarket trade flow, holder concentration, orderbook, and candlestick signals when the paid endpoint returns usable market/outcome identifiers.
- Resolution wording and oracle risk.
- Risk of manipulation, one-sided flow, or low liquidity.
- Kelly-style position sizing.
- The ability to say "there is edge but the data needed for execution is missing."

Samsun Market Intel brings all these layers together in a single research and decision screen.

## What Is Live vs Conditional?

Some signals are always available; others depend on whether the paid provider returns exact market/outcome identifiers.

| Feature | Current status |
| --- | --- |
| Base OpenDeepSearch analysis | Live. Runs before x402 and stays as the baseline. |
| ROMA review | Live as a structured reviewer pattern inside the prompt and UI flow. |
| CryptoAnalystBench quality check | Live for crypto/Web3/stablecoin/onchain-related markets; skipped elsewhere. |
| Kelly-style sizing | Live deterministic sizing when market quote, fair probability, confidence, risk, and the agent wallet / Gateway spendable bankroll are available. If the edge is missing, below threshold, or bankroll is unavailable, stake is `$0`. |
| Holder concentration | Live only when x402 top-holder endpoints return exact holder rows. Otherwise the UI marks "No rows" or "Skipped." |
| Orderbook/candlestick signals | Live only when the market exposes token/condition identifiers accepted by the paid endpoint. Otherwise treated as a data gap. |
| X engagement | Live through paid social search when recent dated posts are returned. It is sentiment/context, not proof. |
| Market Ideas scoring | Live through Serper/source-registry discovery plus an optional primary-model review pass when the model key is configured. |

## Product Scope

| Hackathon area | How the product addresses it |
| --- | --- |
| Finding +EV bets | Analyzes existing Polymarket markets, produces fair probability, calculates edge and sizing. |
| Source reliability | Separately weights OpenDeepSearch, registered sources, X/social, and paid x402 results. |
| Manipulation / flow | Feeds real returned holder, trade, orderbook, candlestick, and X engagement signals into the risk gate; if a paid endpoint cannot return exact rows, the UI marks that as a data gap instead of inventing evidence. |
| Manual execution | Watch / avoid / side intent is staged; there is no automated trading. |
| New verticals | Scans Turkey's news agenda for marketable events. |
| Market creation | Produces question text, resolution criteria, oracle sources, and a proposal draft. |

## Product Modules

### Chat

The Chat screen is the general agent interface. Users can ask things like:

- "Can you analyze this Polymarket market? [Polymarket link]"
- "Which outcome makes more sense in this market? [Polymarket link]"
- "Can this news turn into a prediction market? [Source link]"
- "Is there suspicious flow in this sports/esports match? [Source/Polymarket link]"
- "Which option gives better risk/reward in this multi-outcome market? [Polymarket link]"

The agent's response includes:

- a short decision summary,
- venue price / outcome info,
- agent fair probability,
- confidence breakdown,
- watch integrity score,
- thesis,
- key drivers,
- missing evidence,
- source notes,
- holder flow,
- X engagement,
- evidence used,
- Circle x402 research path,
- manual decision flow.

### Markets

The Markets screen is for loading a Polymarket link directly , an alternative for those who do not want to use the Chat interface. The analysis is identical to the chat analysis.

Flow:

1. User pastes a Polymarket link.
2. The system loads the market title, outcome structure, visual, and available information.
3. User manually triggers Analyze.
4. The initial analysis is done via the base layer: OpenDeepSearch + registered sources + ROMA review + model layer.
5. If desired, the user calls paid data with "Upgrade with Circle x402 research." The UI shows the approved cap and expected service-max cost before the user approves the paid pass.
6. x402 results are processed in a separate upgrade layer: BlockRun/Tavily/Exa/Parallel/market-data/social services first, Perplexity Deep Research second using the first pass as context, then ROMA review and optional CryptoAnalystBench.
7. The previous base analysis is preserved and compared against the x402-upgraded analysis.
8. The agent updates its decision: bet, avoid, watch, or side-specific lean.
9. The user can manually stage an intent.
10. An Arc proof/receipt can be created.

### Market Ideas

I designed the Market Ideas section to address what I see as the biggest gap in prediction markets. The goal is this:

> For example, let's research: which news stories in Turkey today could turn into prediction markets?

The system scans Turkish sources, displays news as cards, and flags only the events that genuinely carry market potential. Signals like "potential high" or "watch" describe the likelihood that a story turns into a market , they do not mean the story is accurate or that an outcome is confirmed.

Example market verticals:

- Turkey macro: TUIK inflation, CBRT interest rate, USD/TRY volatility.
- Legal / political risk: lawsuits, indictments, detention, release, official decision processes.
- Sports and football integrity: match-fixing allegations, disciplinary penalties, referee/federation decisions.
- Regulation: crypto, payment institutions, fintech, banking, and media regulation.
- Corporate / public procurement / sanctions.
- Geopolitical and foreign policy.

If a news story carries market potential, the product:

- explains why it could become a market,
- produces a clear question text,
- suggests resolution criteria,
- lists official or semi-official oracle sources,
- describes disqualifiers and ambiguity risks,
- generates a proposal draft that can be submitted to Polymarket Discord or market request channels.

### Sources

The Sources section is the product's local expertise layer. Users can add sources they trust:

- news websites,
- official institutions,
- court/judiciary announcements,
- data providers such as TUIK, CBRT, BDDK, CMB (Turkish regulatory bodies),
- journalists,
- expert X accounts,
- local media,
- sports/football sources,
- source reliability notes.

These sources are also used for analysis responses: they increase source reliability when analyzing an existing Polymarket market, and provide a "local knowledge advantage" when surfacing new market ideas from the local agenda.

## Turkey Example for the Market Ideas Section

Global prediction markets mostly revolve around US politics, major global geopolitical events, crypto, and popular sports topics. In countries like Turkey , large, news-heavy, with active social media and high betting demand , many local events disappear without ever becoming markets.

<img width="1919" height="954" alt="Screenshot_7" src="https://github.com/user-attachments/assets/02d6e03a-963a-47bf-92ab-a5ca889e5b46" />

The Rasim Ozan Kutahyali case became a useful example to illustrate this gap, because it is a very recent event I wanted to use as a reference.

In May 2026, Euronews and other news sources reported that Rasim Ozan Kutahyali had been detained and arrested as part of an investigation centered in Adana into illegal betting, aggravated fraud, bribery, and money laundering. The Bianet topic tag shows that this same public figure had previously made headlines in other legal and media controversies. These reports do not mean a conviction; they simply show an ongoing legal process that could serve as the basis for market design. This story is already flagged in our infrastructure.

<img width="1919" height="955" alt="Screenshot_8" src="https://github.com/user-attachments/assets/13772042-079e-4865-8c01-178be149b50a" />

Why does this event carry market potential?

- The person is a media figure well known to the Turkish public.
- The event has high viral potential on news sites and social media.
- The legal process has time-bound, measurable stages: indictment, continuation of pre-trial detention, release, filing of charges, first hearing, conviction/acquittal, and so on.
- Global users may not know this person; local users are far more familiar with the subject.
- This creates a local knowledge gap in prediction markets: events widely discussed in Turkey do not turn into markets on global platforms.
- This gap represents both missed user interest and lost potential liquidity.

<img width="1916" height="948" alt="Screenshot_6" src="https://github.com/user-attachments/assets/5e0d2ee4-11e0-47bb-a55d-0bc4c408a49f" />
<img width="1080" height="2146" alt="photo_2026-05-19_22-21-11" src="https://github.com/user-attachments/assets/2d4c654f-c482-4485-ba5b-fadca0522cbf" />


Important principle: the market question must not declare the person guilty. Instead of vague, legally risky questions like "Is he guilty?", the design should use officially verifiable process questions.

Example market questions:

- "Will a Turkish court accept a formal indictment naming Rasim Ozan Kütahyalı before July 31, 2026?"
- "Will Rasim Ozan Kütahyalı remain in pre-trial detention on June 30, 2026?"
- "Will an official indictment in the Adana illegal-betting investigation be accepted before a specified date?"

Example resolution sources:

- relevant courthouse / court announcements,
- prosecutor statements,
- UYAP or official court records if accessible,
- semi-official sources such as Anadolu Agency,
- multiple reliable national news outlets.

When generating a market proposal, the system outputs the following template:

```text
Market title:
Will [official legal event] happen before [date]?

Resolution:
Resolves YES if [specific court/prosecutor action] is officially recorded before [deadline].
Resolves NO otherwise.

Valid sources:
[official court/prosecutor source], [AA], [trusted national outlets].

Disqualifiers:
Rumors, unsourced social media posts, commentary, and non-final legal claims do not count.

Demand signal:
News velocity, X engagement, Google Trends interest, and registered local source coverage.

Risks:
Defamation risk, ambiguity risk, delayed court records, politically charged coverage.
```

### Why Is the Turkey Market Gap So Large?

Discussions around regulated and illegal betting in Turkey point to enormous demand:

- According to Xinhua / Big News Network, Turkish security forces conducted 1,120 operations targeting illegal online betting and gambling between January 1, 2024 and October 6, 2025; assets worth 15.8 billion TRY (346 million USD) were seized, and the legal betting market revenue for 2024 reportedly reached 590.9 billion TRY (12.96 billion USD).
- Hurriyet Daily News reported that 233,000 illegal betting/gambling sites were shut down in 2024, a significant increase from 168,000 the previous year.
- Turkiye Today, citing field research, reported that illegal betting/gambling has reached "1 in 6 people" in Turkey, with a rate of 15.4% in the 18-24 age group and 13%+ in the 25-34 group.

These figures show that there is serious betting interest in Turkey, but a large portion of that interest is not flowing into transparent, measurable, and regulated prediction markets. That is exactly where Samsun Market Intel comes in: by adding local sources, scanning daily and weekly agendas, and turning marketable events into measurable proposals, the goal is to channel this untapped demand into the prediction-market ecosystem.

This approach is not limited to Turkey , it can be applied to any country. The user adds sources from their own country, and the system finds events in that country's news that carry market potential.

## Role of Circle, x402, and Arc

Circle and Arc form the payment, paid-data, and proof backbone of the product.

### Circle Agent Wallet

The agent wallet is a programmatic wallet layer capable of paying for x402 services in USDC. The product can use free or cached sources for basic analysis; when stronger data is needed, x402 paid research is called with user approval.

### Circle x402

x402 allows agents to call paid API services via micropayment. Instead of an API key, monthly subscription, or a separate billing account, the agent makes a small USDC-based payment for the data it needs.

Service types usable via x402 in this project:

- Polymarket markets
- Polymarket trades
- Polymarket top holders
- Polymarket orderbooks
- Polymarket candlesticks
- Matching markets
- BlockRun X/Web/News search
- AIsa Polymarket market data
- AIsa X advanced/community search
- AIsa CoinGecko categories
- Tavily search
- Exa web search
- Perplexity Sonar
- Perplexity Deep Research
- Parallel web search

Each service result is not dumped raw into the final response. The product first checks data usability, provider gaps, data staleness, and relevance. If holder concentration, orderbook, candlestick, or matching-market endpoints do not return usable data for the exact market/outcome, the UI reports that as "skipped" or "data gap." The agent is not allowed to hallucinate those rows.

Current x402 upgrade sequence:

1. Parallel paid context pass: BlockRun market/trade/orderbook/candlestick services, Tavily, Exa, Parallel, AIsa Polymarket, X/social, and CoinGecko when relevant.
2. Deep research pass: Perplexity Deep Research runs after the first paid context pass.
3. ROMA review: paid evidence is reviewed for source quality, relevance, risk, and policy constraints.
4. CryptoAnalystBench quality control: runs only when the market is crypto/Web3/stablecoin/onchain-related.
5. Final answer: the upgraded analysis is shown next to the preserved base-layer result.

### Arc Testnet

Arc is used to record agent decisions and manual intents as proof/receipts. When the agent prepares a trade intent, this does not mean immediate trade execution. If the user wishes, the intent is recorded as a receipt on Arc Testnet.

Arc is valuable here because:

- It uses USDC-native gas.
- Fees are predictable.
- It is EVM-compatible.
- It provides a fast, low-cost proof layer for agent decisions.
- It aligns with a stablecoin-native agent economy.

> While building Samsun Market Intel, I also integrated Sentient's open-source tools. These are:

### OpenDeepSearch

OpenDeepSearch is an open-source web search tool developed by Sentient. It provides fast, lightweight, and configurable search capabilities for AI agents.

In Samsun Market Intel, OpenDeepSearch:

- generates a research query from the user's question or the Polymarket link,
- finds recent news, official sources, and pages relevant to the market,
- uses Jina reranking to surface sources that are genuinely close to the topic, not just keyword matches,
- helps understand the resolution conditions of the market question,
- provides the base evidence layer before x402 paid data arrives.

Why does this matter? In prediction market analysis, timing is critical. A stale news article, the wrong market page, or an irrelevant source can easily mislead the agent. The OpenDeepSearch layer therefore acts as the first-pass freshness and relevance filter. When the user upgrades with x402, paid results are **not** routed back through OpenDeepSearch; they go into the separate x402 upgrade layer.

Source: [sentient-agi/OpenDeepSearch](https://github.com/sentient-agi/OpenDeepSearch)

### ROMA

ROMA stands for "Recursive Open Meta-Agent." It addresses the fact that LLM agents struggle with limited context and sequential reasoning on complex tasks, and uses hierarchical decomposition of tasks into sub-problems with parallel solving and aggregation logic.

Samsun Market Intel uses ROMA not as a fully autonomous swarm, but as a decomposition/review pattern that improves decision quality:

- **Researcher:** Collects evidence relevant to the topic.
- **Source verifier:** Checks the freshness, reliability, and relevance of sources.
- **Risk reviewer:** Flags risks such as manipulation, low liquidity, one-sided flow, and resolution ambiguity.
- **Policy reviewer:** Enforces the rule that the agent must not trade automatically and that manual approval is required.
- **Oracle-source checker:** Examines how the market resolves and which sources will be valid for resolution.

This structure is used to avoid blindly trusting a single model response. In prediction markets, a good answer is not just "buy YES" or "buy NO" , a good answer also addresses "with what evidence, with what missing data, with what risk, and under what conditions would my view change?"

![ROMA](https://github.com/sentient-agi/ROMA/raw/main/assets/roma_run.gif)

Source: [sentient-agi/ROMA](https://github.com/sentient-agi/ROMA)

### CryptoAnalystBench

CryptoAnalystBench is a benchmark developed to measure the quality of long-form analytical responses in the crypto/Web3 space. It specifically divides crypto analysis tasks into two areas:

- causal reasoning,
- time-series analysis.

Samsun Market Intel uses this as a quality-control layer for prediction markets that involve crypto or Web3. For example, in markets involving Bitcoin, stablecoins, tokens, onchain activity, or crypto narratives, the agent's response is checked along these dimensions:

- is it genuinely relevant to the topic,
- does it use current data,
- is it superficial or does it explain the mechanism,
- are the data and claims internally consistent,
- is it overconfident,
- is there a risk of stale data or misinterpreting quotes/prices?

<img width="1499" height="1038" alt="image" src="https://github.com/user-attachments/assets/dc041fc5-1565-427f-961d-2add18f21c6e" />

Source: [sentient-agi/CryptoAnalystBench](https://github.com/sentient-agi/CryptoAnalystBench)

## Model and Provider Selection

Primary model:

- `openrouter/google/gemini-3.1-pro-preview-customtools`

Search / rerank:

- Serper: current web/news discovery.
- Jina: semantic reranking.
- OpenDeepSearch: search orchestration.

Paid data:

- Circle x402 marketplace services. https://agents.circle.com/services

Proof:

- Arc Testnet receipt contract.

## Average Analysis Cost

Cost varies depending on the selected service bundle, x402 provider prices, and model token usage. The UI shows the x402 approved cap before the user starts the paid pass.

Observed practical ranges:

- Base analysis: OpenRouter + Serper/Jina. This is usually a small model/search cost and does not use x402.
- x402 upgrade approved cap: `6.00 USDC`.
- Current service-max estimate for the configured paid bundle: about `4.95 USDC`.
- Recent local demo receipts that included parseable x402 payment amounts ranged roughly from `$0.07` to `$0.40` per upgrade, with an average around `$0.16` across local cached runs. This is lower than the approved cap because providers often charge below the max amount and some exact-market endpoints are skipped when the market does not expose the needed condition/token identifiers.

x402 calls in the product run with manual approval. Before the paid pass starts, the backend checks Circle Gateway spendable balance and blocks the upgrade if the balance is too low. Position sizing uses the live agent bankroll from Gateway/wallet balance when available; it no longer assumes a fixed `100 USDC` bankroll.

## Setup

### 1. Node.js and npm

Node.js 20+ is recommended.

Check:

```powershell
node -v
npm -v
```

Install dependencies:

```powershell
npm install
```

### 2. Circle CLI Setup

Circle CLI is used for agent wallet, x402 services, Gateway balance, and contract execution.

Install:

```powershell
npm install -g @circle-fin/cli
```

Check:

```powershell
circle --version
circle --help
```

Check Circle CLI Terms:

```powershell
circle terms show
```

Read the terms screen and if you accept:

```powershell
circle terms accept
```

Agent wallet login flow:

```powershell
circle wallet status
circle wallet login <email> --type agent --init
```

The CLI gives you a request id and sends an email OTP. Once the OTP arrives:

```powershell
circle wallet login --type agent --request <request-id> --otp <otp-code>
circle wallet status
```

Agent wallet list:

```powershell
circle wallet list --chain BASE --type agent --output json
```

If there is no agent wallet:

```powershell
circle wallet create --output json
circle wallet list --chain BASE --type agent --output json
```

Balance check:

```powershell
circle wallet balance --address <agent-wallet-address> --chain BASE --output json
circle gateway balance --address <agent-wallet-address> --chain BASE --output json
```

Discover x402 services:

```powershell
circle services search polymarket --limit 10
circle services search search --limit 10
circle services inspect <service-url-or-id>
```

Circle CLI commands may update frequently. Use the relevant `--help` output for any command you are unsure about:

```powershell
circle wallet --help
circle services --help
circle gateway --help
```

### 3. Arc Canteen CLI Setup

Arc Canteen CLI is used for the RPC and builder context flow.

If `uv` is not installed yet:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

After opening a new terminal:

```powershell
uv --version
uv tool install git+https://github.com/the-canteen-dev/ARC-cli
```

Login:

```powershell
arc-canteen login
```

RPC and profile check:

```powershell
arc-canteen status
arc-canteen rpc-url
```

Arc Testnet details:

```text
Chain ID: 5042002
RPC: https://rpc.testnet.arc.network
Explorer: https://testnet.arcscan.app
USDC ERC-20: 0x3600000000000000000000000000000000000000
```

### 4. Environment File

Create `.env` from `.env.example`:

```powershell
Copy-Item .env.example .env
```

Main variables:

```env
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_CANTEEN_RPC_URL=
ARC_TESTNET_CHAIN_ID=5042002
ARC_TESTNET_EXPLORER=https://testnet.arcscan.app
ARC_TESTNET_AGENT_WALLET_ADDRESS=

CIRCLE_AGENT_WALLET_ADDRESS=
CIRCLE_MAINNET_AGENT_WALLET_ADDRESS=
CIRCLE_BLOCKCHAIN=ARC-TESTNET
CIRCLE_GATEWAY_CHAIN=MATIC

ANALYSIS_RECEIPT_CONTRACT=

PRIMARY_MODEL_ID=openrouter/google/gemini-3.1-pro-preview-customtools
PRIMARY_MODEL_PROVIDER=openrouter
PRIMARY_MODEL_MAX_OUTPUT_TOKENS=8192
OPENROUTER_API_KEY=

SERPER_API_KEY=
JINA_API_KEY=
OPENDEEPSEARCH_SEARCH_PROVIDER=serper
OPENDEEPSEARCH_RERANKER=jina
OPENDEEPSEARCH_MODE=pro
```

## What Does the Project Solve, in Brief?

Samsun Market Intel creates value on three levels:

1. **For the trader:** Better research, better risk reading, and more disciplined sizing on existing Polymarket markets.
2. **For the market creator:** New prediction market ideas from local news, with clear resolution and oracle design.
3. **For the agent economy:** A working example of an economic agent that can consume paid data via x402, leave proofs on Arc, and enforces a manual safety gate.

## Resources

- [Agora Agents Hackathon](https://agora.thecanteenapp.com/)
- [Circle Agent Services](https://agents.circle.com/services)
- [Circle Developers](https://developers.circle.com/)
- [Arc Docs](https://docs.arc.io/)
- [OpenDeepSearch GitHub](https://github.com/sentient-agi/OpenDeepSearch)
- [ROMA GitHub](https://github.com/sentient-agi/ROMA)
- [CryptoAnalystBench GitHub](https://github.com/sentient-agi/CryptoAnalystBench)
- [Euronews: Illegal betting operation / Rasim Ozan Kütahyalı](https://tr.euronews.com/2026/05/18/yasa-disi-bahis-operasyonu-rasim-ozan-kutahyali-tutuklandi)
- [Bianet Rasim Ozan Kütahyalı tag](https://bianet.org/etiket/rasim-ozan-kutahyali-9537)
- [Hürriyet Daily News: 233,000 illegal betting websites closed in 2024](https://www.hurriyetdailynews.com/authorities-close-233-000-illegal-betting-websites-in-2024-205103)
- [Big News Network / Xinhua: Türkiye illegal betting crackdown and 590.9B TL legal betting market](https://www.bignewsnetwork.com/news/278639918/trkiye-seizes-assets-worth-379-mln-usd-in-online-betting-crackdown-in-2024-2025)
- [Türkiye Today: Illegal betting reaches 1 in 6 people in Türkiye](https://www.turkiyetoday.com/nation/illegal-betting-reaches-1-in-6-people-in-turkiye-survey-finds-3211592)
