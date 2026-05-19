import { turkeyStarterSources } from "../src/product/starterSources.js";
import {
  appendSourceRegistryRecord,
  readSourceRegistry,
  summarizeSourceRegistry,
} from "../src/product/sourceRegistry.js";

let customRecordCount = 0;

for (const source of turkeyStarterSources) {
  const customRecords = await appendSourceRegistryRecord(source);
  customRecordCount = customRecords.length;
}

const records = await readSourceRegistry();

console.log(
  JSON.stringify(
    {
      status: "ok",
      seeded: turkeyStarterSources.map((source) => source.id),
      customRecords: customRecordCount,
      summary: summarizeSourceRegistry(records),
    },
    null,
    2,
  ),
);
