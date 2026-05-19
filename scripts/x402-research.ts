import "dotenv/config";

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_WINDOWS_CIRCLE = "C:\\Users\\pc\\AppData\\Roaming\\npm\\circle.cmd";
const DEFAULT_OUT_FILE = ".cache/x402/latest-research-search.json";

type Mode = "inspect" | "estimate" | "pay";
type Provider = "tavily" | "sonar";

const options = parseOptions(process.argv.slice(2));
const provider = readOption<Provider>(options, "provider", "tavily", ["tavily", "sonar"]);
const mode = readOption<Mode>(options, "mode", "estimate", ["inspect", "estimate", "pay"]);
const query =
  options.query?.trim() || "Turkiye enflasyon beklentisi TCMB TUIK Mayis 2026";
const address = options.address || process.env.CIRCLE_MAINNET_AGENT_WALLET_ADDRESS;
const chain = options.chain || process.env.CIRCLE_GATEWAY_CHAIN || "MATIC";
const outFile = options.outFile || DEFAULT_OUT_FILE;
const request = buildRequest(provider, query, options.maxAmount);

if (mode !== "inspect" && !address) {
  throw new Error("Missing CIRCLE_MAINNET_AGENT_WALLET_ADDRESS. Add it to local .env or pass --address.");
}

const cliArgs =
  mode === "inspect"
    ? ["services", "inspect", request.url, "--output", "json"]
    : [
        "services",
        "pay",
        request.url,
        "--address",
        address as string,
        "--chain",
        chain,
        "--method",
        "POST",
        "--header",
        "Content-Type: application/json",
        "--data",
        JSON.stringify(request.body),
        "--max-amount",
        request.maxAmount,
        "--timeout",
        "60",
        "--output",
        "json",
        ...(mode === "estimate" ? ["--estimate"] : []),
      ];

if (mode === "pay") {
  console.error(`About to run a real paid x402 research request. Max amount: ${request.maxAmount} USDC`);
}

try {
  const invocation = buildCircleInvocation(cliArgs);
  const { stdout, stderr } = await execFileAsync(invocation.file, invocation.args, {
    maxBuffer: 1024 * 1024 * 10,
    timeout: 120_000,
    windowsHide: true,
  });

  if (stderr.trim()) {
    console.error(stderr.trim());
  }

  if (mode === "pay") {
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, stdout);
  }

  process.stdout.write(stdout);
} catch (error) {
  if (isExecError(error)) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    process.exit(error.code ?? 1);
  }
  throw error;
}

function buildRequest(providerName: Provider, searchQuery: string, maxAmount?: string) {
  if (providerName === "sonar") {
    return {
      url: "https://api.aisa.one/apis/v2/perplexity/sonar",
      maxAmount: maxAmount || "0.012",
      body: {
        model: "sonar",
        temperature: 0.1,
        max_tokens: 600,
        return_citations: true,
        search_context: "low",
        messages: [
          {
            role: "system",
            content: "You are a prediction-market research analyst. Return concise evidence with citations.",
          },
          {
            role: "user",
            content: searchQuery,
          },
        ],
      },
    };
  }

  return {
    url: "https://api.aisa.one/apis/v2/tavily/search",
    maxAmount: maxAmount || "0.0096",
    body: {
      query: searchQuery,
      topic: "news",
      country: "turkey",
      time_range: "week",
      max_results: 8,
      search_depth: "basic",
      include_answer: false,
      include_usage: true,
      include_raw_content: false,
    },
  };
}

function parseOptions(args: string[]) {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function readOption<T extends string>(
  optionsMap: Record<string, string>,
  key: string,
  fallback: T,
  allowed: T[],
) {
  const value = optionsMap[key] as T | undefined;
  if (!value) return fallback;
  if (allowed.includes(value)) return value;
  throw new Error(`Invalid --${key}: ${value}. Expected one of ${allowed.join(", ")}.`);
}

function buildCircleInvocation(args: string[]) {
  const jsPath = resolveCircleJsPath();
  if (jsPath) {
    return { file: "node", args: [jsPath, ...args] };
  }

  const circlePath = process.env.CIRCLE_CLI_PATH || (process.platform === "win32" ? DEFAULT_WINDOWS_CIRCLE : "circle");
  if (process.platform !== "win32") {
    return { file: circlePath, args };
  }

  return {
    file: "cmd.exe",
    args: ["/d", "/s", "/c", [quoteCmdArg(circlePath), ...args.map(quoteCmdArg)].join(" ")],
  };
}

function resolveCircleJsPath() {
  if (process.env.CIRCLE_CLI_JS_PATH && existsSync(process.env.CIRCLE_CLI_JS_PATH)) {
    return process.env.CIRCLE_CLI_JS_PATH;
  }

  const shimPath = process.env.CIRCLE_CLI_PATH || DEFAULT_WINDOWS_CIRCLE;
  if (existsSync(shimPath)) {
    const fromShim = readCircleShimTarget(shimPath);
    if (fromShim && existsSync(fromShim)) return fromShim;
  }

  const appData = process.env.APPDATA;
  const candidates = [
    appData ? join(appData, "npm", "node_modules", "@circle-fin", "cli", "dist", "index.js") : null,
    appData ? join(appData, "npm", "node_modules", "@circle-fin", "cli", "dist", "cli.js") : null,
    appData ? join(appData, "npm", "node_modules", "@circle-fin", "cli", "index.js") : null,
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function readCircleShimTarget(shimPath: string) {
  try {
    const shim = readFileSync(shimPath, "utf8");
    const match = shim.match(/%dp0%\\(node_modules\\@circle-fin\\cli\\[^"\r\n]+\.js)/i);
    if (!match) return null;
    return join(dirname(shimPath), match[1]);
  } catch {
    return null;
  }
}

function quoteCmdArg(value: string) {
  if (/^[a-zA-Z0-9._:/\\=-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

function isExecError(error: unknown): error is NodeJS.ErrnoException & {
  stdout?: string;
  stderr?: string;
  code?: number;
} {
  return typeof error === "object" && error !== null && ("stdout" in error || "stderr" in error);
}
