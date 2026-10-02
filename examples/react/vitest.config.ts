import { defineConfig } from "vitest/config";
import { sourceConditions } from "./vite.shared.ts";

export default defineConfig({
    // the packages from their sources, not their dist (the node environment resolves through `ssr`)
    ssr: { resolve: { conditions: sourceConditions("server") } },
    test: {
        name: "examples-react",
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
