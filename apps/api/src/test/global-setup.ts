import { execFileSync } from "node:child_process";

import { dropRunDatabases, resetTemplateDatabase, resolveWorkerDbConfig } from "./worker-db.js";

export default async function globalSetup(): Promise<() => Promise<void>> {
  const baseUrl = process.env.DATABASE_URL;
  if (baseUrl === undefined) throw new Error("DATABASE_URL is not set for the test run");

  const runId = String(process.pid);
  process.env.TEST_RUN_ID = runId;

  const config = resolveWorkerDbConfig({ rawBaseUrl: baseUrl, rawRunId: runId });
  await resetTemplateDatabase(config);

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: config.templateUrl },
    shell: true,
    stdio: "inherit",
  });

  return async () => {
    await dropRunDatabases(config);
  };
}
