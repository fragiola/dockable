import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);
// the playground's port (vite.config.ts reads the same variable)
const PORT = Number(process.env.PLAYGROUND_PORT ?? 5173);

export default defineConfig({
    testDir: "e2e",
    fullyParallel: true,
    forbidOnly: CI,
    retries: CI ? 2 : 0,
    // Native HTML5 drag tests are timing sensitive and flake when too many tests contend for
    // the dev server, so the workers are capped (as in FlexLayout).
    workers: CI ? 1 : 4,
    reporter: CI ? [["line"], ["html", { open: "never" }]] : "line",
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: "on-first-retry",
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    ],
    webServer: {
        command: "pnpm dev",
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !CI,
    },
});
