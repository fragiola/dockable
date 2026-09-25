import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        name: "docs",
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
