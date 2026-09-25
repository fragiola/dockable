import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Fails early, with the fix, when out/ is missing or was built without the
// base path the suite serves it under.
export default function globalSetup() {
    const index = join(import.meta.dirname, "../out/index.html");
    if (!existsSync(index)) {
        throw new Error(
            "apps/docs/out is missing: run `NEXT_PUBLIC_BASE_PATH=/dockable pnpm --filter docs... build` first",
        );
    }
    if (!readFileSync(index, "utf-8").includes("/dockable/_next/")) {
        throw new Error(
            "apps/docs/out was built without the base path: rebuild with NEXT_PUBLIC_BASE_PATH=/dockable",
        );
    }
}
