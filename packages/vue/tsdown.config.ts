import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ["src/index.ts"],
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
    // the declarations are built from src only: tsconfig.json also takes in the tests and the
    // configs, which import the repo's scripts/, and their declarations would be written there
    tsconfig: "tsconfig.build.json",
});
