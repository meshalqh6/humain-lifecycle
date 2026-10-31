import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve("..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
if (!env.TEST_DATABASE_URL?.endsWith("/humain_test"))
  throw new Error("Browser tests require isolated humain_test database");
export default defineConfig({
  testDir: "e2e",
  timeout: 45000,
  expect: { timeout: 10000 },
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "../docs/browser-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5180",
    ...devices["Desktop Chrome"],
    channel: "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "..\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001",
      cwd: resolve(root, "backend"),
      url: "http://127.0.0.1:8001/api/health",
      reuseExistingServer: false,
      env: { DATABASE_URL: env.TEST_DATABASE_URL, SCHEDULER_ENABLED: "false" },
    },
    {
      command: "npm run dev -- --port 5180",
      url: "http://127.0.0.1:5180",
      reuseExistingServer: false,
      env: { VITE_API_TARGET: "http://127.0.0.1:8001" },
    },
  ],
});
