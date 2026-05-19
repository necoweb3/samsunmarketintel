import { existsSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_WINDOWS_CIRCLE = "C:\\Users\\pc\\AppData\\Roaming\\npm\\circle.cmd";

export function resolveCircleCliPath() {
  if (process.env.CIRCLE_CLI_PATH) return process.env.CIRCLE_CLI_PATH;

  if (process.platform === "win32" && existsSync(DEFAULT_WINDOWS_CIRCLE)) {
    return DEFAULT_WINDOWS_CIRCLE;
  }

  const localBinary = join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "circle.cmd" : "circle",
  );
  if (existsSync(localBinary)) return localBinary;

  return "circle";
}
