import { defineConfig } from "vitest/config";
import {
    examplesResolve,
    sourceConditions,
} from "../../examples/react/vite.shared.ts";

export default defineConfig({
    resolve: examplesResolve("serve"),
    // the node environment resolves through `ssr`: the packages from their sources there too
    ssr: { resolve: { conditions: sourceConditions("server") } },
    test: {
        name: "playground",
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
