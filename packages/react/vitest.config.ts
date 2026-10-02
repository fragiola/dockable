import { defaultClientConditions } from "vite";
import { defineProject } from "vitest/config";

export default defineProject({
    // The core from its sources (the `@fragiola/source` export condition), not its dist.
    // Setting `conditions` replaces Vite's defaults, so they are spread back.
    resolve: { conditions: ["@fragiola/source", ...defaultClientConditions] },
    test: {
        name: "react",
        environment: "jsdom",
        include: ["tests/**/*.test.{ts,tsx}"],
        setupFiles: ["tests/setup.ts"],
    },
});
