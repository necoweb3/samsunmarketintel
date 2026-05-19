import { readFile } from "node:fs/promises";

import {
  appendSourceRegistryRecord,
  readCustomSourceRegistry,
  readSourceRegistry,
  summarizeSourceRegistry,
  type SourceRegistryInput,
  type SourceRegistryRecord,
} from "../src/product/sourceRegistry.js";

type CsvSourceRow = {
  name: string;
  handle: string;
  type: SourceRegistryRecord["type"];
  credibility: SourceRegistryRecord["credibility"];
  status: SourceRegistryRecord["status"];
  coverage: string;
  role: string;
  domains_or_accounts: string;
  notes: string;
};

const options = parseOptions(process.argv.slice(2));
const filePath = options.file;

if (!filePath) {
  throw new Error("Missing --file path/to/sources.csv");
}

const raw = await readFile(filePath, "utf8");
const rows = parseCsv(raw);
const headers = rows[0]?.map((header) => header.trim()) ?? [];
const requiredHeaders = [
  "name",
  "handle",
  "type",
  "credibility",
  "status",
  "coverage",
  "role",
  "domains_or_accounts",
  "notes",
];
const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));

if (missingHeaders.length > 0) {
  throw new Error(`CSV is missing required header(s): ${missingHeaders.join(", ")}`);
}

const sourceInputs = rows
  .slice(1)
  .map((row) => readCsvObject(headers, row))
  .filter((row) => row.name.trim().length > 0)
  .map(mapCsvRowToSourceInput);

for (const source of sourceInputs) {
  await appendSourceRegistryRecord(source);
}

const [records, customRecords] = await Promise.all([
  readSourceRegistry(),
  readCustomSourceRegistry(),
]);

console.log(
  JSON.stringify(
    {
      status: "ok",
      imported: sourceInputs.length,
      customRecords: customRecords.length,
      summary: summarizeSourceRegistry(records),
      importedIds: sourceInputs.map((source) => source.id),
    },
    null,
    2,
  ),
);

function mapCsvRowToSourceInput(row: CsvSourceRow): SourceRegistryInput {
  const domains = row.domains_or_accounts
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const handle = row.handle.trim();

  return {
    id: `turkey-source-${slugify(row.name)}`,
    name: row.name,
    type: readAllowed(row.type, [
      "Official data",
      "Paid data",
      "Newswire",
      "Local press",
      "Social signal",
      "X account",
      "Community report",
    ]),
    coverage: row.coverage,
    credibility: readAllowed(row.credibility, [
      "Official",
      "High",
      "Medium",
      "Watch",
      "Machine-readable",
      "Weighted",
    ]),
    role: row.role,
    domains: handle && !domains.includes(`x.com/${handle.replace(/^@/, "")}`)
      ? [...domains, `x.com/${handle.replace(/^@/, "")}`]
      : domains,
    status: readAllowed(row.status, ["Active", "Needs curation", "Watch"]),
    notes: handle ? `${row.notes} Handle: ${handle}.` : row.notes,
  };
}

function readCsvObject(headers: string[], row: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])) as CsvSourceRow;
}

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

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (current === "\"") {
      if (quoted && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (current === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((current === "\n" || current === "\r") && !quoted) {
      if (current === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += current;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function readAllowed<T extends string>(value: string, allowed: T[]): T {
  const clean = value.trim();
  if (allowed.includes(clean as T)) return clean as T;
  throw new Error(`Invalid CSV value "${value}". Allowed values: ${allowed.join(", ")}`);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
