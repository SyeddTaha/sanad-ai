import { runSyntheticNoticeDemo } from "@/backend/notices/synthetic-notice-demo";

void runSyntheticNoticeDemo().then((scenarios) => {
  for (const result of scenarios) console.log(JSON.stringify(result));
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Synthetic notice demo failed");
  process.exitCode = 1;
});
