import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);

/** The e2e suite runs against the static export served under the Pages base
 * path, i.e. what gets deployed, not `next dev`. Build it first with
 * `NEXT_PUBLIC_BASE_PATH=/dockable pnpm --filter docs... build`. */
export const BASE_PATH = "/dockable";
const PORT = Number(process.env.DOCS_E2E_PORT ?? 4310);

export default defineConfig({
    testDir: "e2e",
    globalSetup: "./e2e/global-setup.ts",
    fullyParallel: true,
    forbidOnly: CI,
    retries: CI ? 2 : 0,
    // native HTML5 drags are timing sensitive (see the playground config)
    workers: CI ? 2 : 4,
    reporter: CI ? [["line"], ["html", { open: "never" }]] : "line",
    use: {
        baseURL: `http://localhost:${PORT}${BASE_PATH}/`,
        trace: "on-first-retry",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: {
        command: `node scripts/serve-static.ts ${PORT}`,
        env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
        url: `http://localhost:${PORT}${BASE_PATH}/`,
        reuseExistingServer: !CI,
    },
});
