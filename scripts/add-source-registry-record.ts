import "dotenv/config";

import { appendSourceRegistryRecord, readSourceRegistry, summarizeSourceRegistry } from "../src/product/sourceRegistry.js";

const options = parseOptions(process.argv.slice(2));

const required = ["name", "type", "coverage", "credibility", "role", "domains", "status", "notes"];
const missing = required.filter((key) => !options[key]);

if (missing.length > 0) {
  throw new Error(`Missing required option(s): ${missing.join(", ")}`);
}

const records = await appendSourceRegistryRecord({
  id: options.id,
  name: options.name,
  type: readOption(options.type, [
    "Official data",
    "Paid data",
    "Newswire",
    "Local press",
    "Social signal",
    "X account",
    "Community report",
  ]),
  coverage: options.coverage,
  credibility: readOption(options.credibility, [
    "Official",
    "High",
    "Medium",
    "Watch",
    "Machine-readable",
    "Weighted",
  ]),
  role: options.role,
  domains: options.domains.split(",").map((value) => value.trim()).filter(Boolean),
  weight: options.weight ? Number(options.weight) : undefined,
  status: readOption(options.status, ["Active", "Needs curation", "Watch"]),
  notes: options.notes,
});
const allRecords = await readSourceRegistry();

console.log(
  JSON.stringify(
    {
      added: records[0],
      customRecords: records.length,
      summary: summarizeSourceRegistry(allRecords),
    },
    null,
    2,
  ),
);

function parseOptions(args: string[]) {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current?.startsWith("--")) continue;
    const key = current.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function readOption<T extends string>(value: string, allowed: T[]): T {
  if (allowed.includes(value as T)) return value as T;
  throw new Error(`Invalid option "${value}". Allowed: ${allowed.join(", ")}`);
}
