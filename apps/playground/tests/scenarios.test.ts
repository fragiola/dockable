import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    AREAS,
    entries,
    scenarioPath,
    scenarioTitle,
    sections,
} from "../src/catalog.ts";

// ─── The scenario convention ────────────────────────────────────────────────
// src/scenarios/<area>/<id>.tsx, default export only. The sidebar reads everything from the path,
// and a module that exports anything beside its component loses Fast Refresh (a full reload on
// every save). So the convention is the whole contract, and this file enforces it.

const SCENARIOS = resolve(import.meta.dirname, "../src/scenarios");
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*\.tsx$/;

async function scenarioFiles() {
    const found: { area: string; file: string }[] = [];
    for (const area of await readdir(SCENARIOS, { withFileTypes: true })) {
        expect(
            area.isDirectory(),
            `${area.name}: a scenario lives in an area's directory, src/scenarios/<area>/<id>.tsx`,
        ).toBe(true);
        for (const file of await readdir(join(SCENARIOS, area.name))) {
            found.push({ area: area.name, file });
        }
    }
    return found;
}

describe("src/scenarios", () => {
    it("has one directory per area, named as in AREAS", async () => {
        const areas: string[] = AREAS.map((a) => a.key);
        for (const dir of await readdir(SCENARIOS)) {
            expect(areas, `${dir} is not an area`).toContain(dir);
        }
    });

    it("names every scenario <kebab-id>.tsx", async () => {
        for (const { area, file } of await scenarioFiles()) {
            expect(file, `${area}/${file}`).toMatch(KEBAB);
        }
    });

    it("exports a component as default, and nothing else", async () => {
        for (const { area, file } of await scenarioFiles()) {
            const module: Record<string, unknown> = await import(
                join(SCENARIOS, area, file)
            );
            expect(Object.keys(module), `${area}/${file}`).toEqual(["default"]);
            expect(typeof module.default, `${area}/${file}`).toBe("function");
        }
    });

    it("lists every scenario in the catalog, grouped by area in AREAS order", async () => {
        const files = (await scenarioFiles())
            .map(({ area, file }) => `${area}/${file.slice(0, -4)}`)
            .sort();
        const listed = entries
            .filter((e) => e.kind === "scenario")
            .map((e) => e.id)
            .sort();
        expect(listed).toEqual(files);

        const section = sections.find((s) => s.kind === "scenario");
        const groups = section?.groups.map((g) => g.key) ?? [];
        expect(groups).toEqual(
            AREAS.map((a) => a.key).filter((key) => groups.includes(key)),
        );
    });

    it("shows a scenario's own file in the source panel", async () => {
        for (const entry of entries.filter((e) => e.kind === "scenario")) {
            expect(entry.files.map((f) => f.path)).toEqual([
                `apps/playground/src/scenarios/${entry.id}.tsx`,
            ]);
            expect(await entry.files[0]?.load()).toContain("export default");
        }
    });
});

describe("scenario paths", () => {
    it("reads area and id from the path", () => {
        expect(
            scenarioPath("./scenarios/drag/drop-indicator-motion.tsx"),
        ).toEqual({ area: "drag", id: "drop-indicator-motion" });
        expect(scenarioPath("./scenarios/loose.tsx")).toBeUndefined();
        expect(scenarioPath("./scenarios/api/deep/x.tsx")).toBeUndefined();
    });

    it("titles a scenario from its id", () => {
        expect(scenarioTitle("drop-indicator-motion")).toBe(
            "Drop indicator motion",
        );
        expect(scenarioTitle("commands")).toBe("Commands");
    });
});
