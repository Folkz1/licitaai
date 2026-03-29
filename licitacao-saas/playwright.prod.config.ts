import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL || "https://licitai.mbest.site";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*prod.*\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});
