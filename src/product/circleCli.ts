import { existsSync } from "node:fs";
import { join } from "node:path";

export function resolveCircleCliPath() {
  return process.env.CIRCLE_CLI_PATH ?? "circle";
}

export function buildCircleCliInvocation(args: string[]) {
  const jsPath = resolveCircleCliJsPath();
  if (jsPath) {
    return { file: "node", args: [jsPath, ...args], shell: false };
  }

  const circlePath = resolveCircleCliPath();
  return {
    file: circlePath,
    args,
    shell: process.platform === "win32",
  };
}

function resolveCircleCliJsPath() {
  if (process.env.CIRCLE_CLI_JS_PATH && existsSync(process.env.CIRCLE_CLI_JS_PATH)) {
    return process.env.CIRCLE_CLI_JS_PATH;
  }

  const candidates = [
    join(process.cwd(), "node_modules", "@circle-fin", "cli", "dist", "index.js"),
    join(process.cwd(), "node_modules", "@circle-fin", "cli", "bin", "circle.js"),
    process.env.APPDATA
      ? join(process.env.APPDATA, "npm", "node_modules", "@circle-fin", "cli", "dist", "index.js")
      : null,
    process.env.APPDATA
      ? join(process.env.APPDATA, "npm", "node_modules", "@circle-fin", "cli", "bin", "circle.js")
      : null,
  ];

  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null;
}
