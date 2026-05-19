import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import {
  readSentientResearchConfig,
  type SentientResearchConfig,
} from "@/src/product/sentientResearchConfig";

const execFileAsync = promisify(execFile);

export type OpenDeepSearchRuntimeStatus =
  | "ready"
  | "needs_config"
  | "missing_runtime"
  | "error";

export type OpenDeepSearchRuntimeReport = {
  status: OpenDeepSearchRuntimeStatus;
  config: SentientResearchConfig;
  pythonPath: string | null;
  scriptPath: string | null;
  missing: string[];
  updatedAt: string;
};

export type OpenDeepSearchRunResult = {
  status: "ok" | "needs_config" | "missing_runtime" | "error";
  query: string;
  answer: string | null;
  durationMs: number | null;
  sources?: OpenDeepSearchSource[];
  config: SentientResearchConfig;
  runtime: {
    pythonPath: string | null;
    scriptPath: string | null;
  };
  missing: string[];
  error?: string;
  updatedAt: string;
};

export type OpenDeepSearchSource = {
  title: string;
  url: string;
  snippet: string;
  source: "serper";
};

type OpenDeepSearchRunInput = {
  query: string;
  maxSources?: number;
  env?: Record<string, string | undefined>;
};

export function readOpenDeepSearchRuntime(
  env: Record<string, string | undefined> = process.env,
): OpenDeepSearchRuntimeReport {
  const config = readSentientResearchConfig(env);
  const pythonPath = resolvePythonPath();
  const scriptPath = path.join(process.cwd(), "scripts", "run-opendeepsearch.py");
  const missing = [...config.missing];

  if (!pythonPath) missing.push("sentient-opendeepsearch Python runtime");
  if (!existsSync(scriptPath)) missing.push("scripts/run-opendeepsearch.py");

  return {
    status:
      missing.length === 0
        ? "ready"
        : config.status !== "ready"
          ? "needs_config"
          : "missing_runtime",
    config,
    pythonPath,
    scriptPath: existsSync(scriptPath) ? scriptPath : null,
    missing,
    updatedAt: new Date().toISOString(),
  };
}

export async function runOpenDeepSearch({
  query,
  maxSources = 3,
  env = process.env,
}: OpenDeepSearchRunInput): Promise<OpenDeepSearchRunResult> {
  const runtime = readOpenDeepSearchRuntime(env);

  if (runtime.status !== "ready" || !runtime.pythonPath || !runtime.scriptPath) {
    return {
      status: runtime.status === "needs_config" ? "needs_config" : "missing_runtime",
      query,
      answer: null,
      durationMs: null,
      config: runtime.config,
      runtime: {
        pythonPath: runtime.pythonPath,
        scriptPath: runtime.scriptPath,
      },
      missing: runtime.missing,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const { stdout } = await execFileAsync(
      runtime.pythonPath,
      [
        runtime.scriptPath,
        "--query",
        query,
        "--model",
        runtime.config.model.name,
        "--mode",
        runtime.config.mode,
        "--reranker",
        runtime.config.reranker.provider,
        "--search-provider",
        runtime.config.search.provider,
        "--max-sources",
        String(Math.max(1, Math.min(6, maxSources))),
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, ...env },
        maxBuffer: 1024 * 1024 * 4,
        timeout: runtime.config.mode === "pro" ? 180_000 : 90_000,
      },
    );

    const parsed = parseOpenDeepSearchOutput(stdout) as {
      status: "ok";
      answer: string;
      durationMs: number;
    };
    const serperSources = await runSerperSearch({
      query,
      maxSources,
      env,
    });

    return {
      status: "ok",
      query,
      answer: mergeSearchSources(parsed.answer, serperSources),
      durationMs: parsed.durationMs,
      sources: serperSources,
      config: runtime.config,
      runtime: {
        pythonPath: runtime.pythonPath,
        scriptPath: runtime.scriptPath,
      },
      missing: [],
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "error",
      query,
      answer: null,
      durationMs: null,
      config: runtime.config,
      runtime: {
        pythonPath: runtime.pythonPath,
        scriptPath: runtime.scriptPath,
      },
      missing: [],
      error: error instanceof Error ? error.message : "OpenDeepSearch failed.",
      updatedAt: new Date().toISOString(),
    };
  }
}

async function runSerperSearch({
  query,
  maxSources,
  env,
}: {
  query: string;
  maxSources: number;
  env: Record<string, string | undefined>;
}): Promise<OpenDeepSearchSource[]> {
  const apiKey = env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const focusedQuery = buildFocusedSerperQuery(query);
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        q: focusedQuery,
        num: Math.max(3, Math.min(10, maxSources + 2)),
        tbs: "qdr:m",
      }),
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as {
      organic?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
      }>;
      news?: Array<{
        title?: string;
        link?: string;
        snippet?: string;
      }>;
    };
    const results = [...(payload.news ?? []), ...(payload.organic ?? [])];

    return results
      .map((result) => ({
        title: result.title?.trim() ?? "",
        url: result.link?.trim() ?? "",
        snippet: result.snippet?.trim() ?? "",
        source: "serper" as const,
      }))
      .filter((result) => result.title && result.url)
      .slice(0, Math.max(1, Math.min(6, maxSources)));
  } catch {
    return [];
  }
}

function buildFocusedSerperQuery(query: string) {
  const marketMatch =
    query.match(/Prediction market trading analysis for:\s*(.*?)(?:\s+Venue:|\s+Multi-outcome|$)/i) ??
    query.match(/Prediction market design and usefulness analysis for:\s*(.*?)(?:\s+Venue:|\s+Multi-outcome|$)/i) ??
    query.match(/Prediction market research:\s*(.*?)(?:\s+Venue:|\s+Multi-outcome|$)/i);
  const outcomeMatch = query.match(/Multi-outcome\/event market outcomes and venue quotes:\s*(.*?)(?:\s+Market slug:|\s+Find whether|\s+Find recent|$)/i);
  const currentDate = query.match(/Current date:\s*([0-9-]+)/i)?.[1];
  const base = marketMatch?.[1] ?? query;
  const outcomes = outcomeMatch?.[1]
    ?.split(";")
    .slice(0, 5)
    .map((item) => item.replace(/^\s*\d+\.\s*/, "").replace(/:.*$/, "").trim())
    .filter(Boolean)
    .join(" ");

  return [
    base,
    outcomes,
    "latest official news polling forecast legal analysis market odds",
    "-site:facebook.com -site:x.com -site:twitter.com -site:instagram.com",
    currentDate ? `after ${currentDate.slice(0, 7)}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 320);
}

function mergeSearchSources(answer: string, sources: OpenDeepSearchSource[]) {
  if (sources.length === 0) return answer;

  const sourceSummary = sources
    .map((source) => `- ${source.title} (${source.url}): ${source.snippet}`)
    .join("\n");

  if (isThinAnswer(answer)) {
    return `OpenDeepSearch returned a thin answer, so Serper web results were attached for source grounding.\n\nSearch sources:\n${sourceSummary}`;
  }

  return `${answer}\n\nSearch sources:\n${sourceSummary}`;
}

function isThinAnswer(answer: string) {
  const normalized = answer.toLowerCase();
  return (
    normalized.includes("no information available") ||
    normalized.includes("could not be answered") ||
    normalized.includes("insufficient information") ||
    answer.trim().length < 180
  );
}

function resolvePythonPath() {
  const candidates = [
    path.join(process.cwd(), ".venvs", "sentient-opendeepsearch", "Scripts", "python.exe"),
    path.join(process.cwd(), ".venvs", "sentient-opendeepsearch", "bin", "python"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function parseOpenDeepSearchOutput(stdout: string) {
  const trimmed = stdout.trim();
  const jsonLine = trimmed
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.trim().startsWith("{") && line.includes('"status"'));

  if (jsonLine) {
    return JSON.parse(jsonLine);
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  return JSON.parse(trimmed);
}
