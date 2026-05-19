import "dotenv/config";

import { buildCurrentDemoReviewPack } from "../src/product/demoReviewState.js";
import { buildProductReadiness } from "../src/product/productReadiness.js";
import { buildSubmissionPack, renderSubmissionPackMarkdown } from "../src/product/submissionPack.js";

const [reviewPack, readiness] = await Promise.all([
  buildCurrentDemoReviewPack(),
  buildProductReadiness(),
]);
const pack = buildSubmissionPack({ reviewPack, readiness });

console.log(renderSubmissionPackMarkdown(pack));
