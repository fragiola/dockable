import { describe, expect, it } from "vitest";
import { embedBase, frameworkOf, skipReason } from "../e2e/available.ts";

// The shared e2e suite runs against every framework's embed; a spec that opens an example the
// framework does not have is skipped with this reason, never failed (e2e/helpers.ts).
describe("the e2e suite's framework", () => {
    it("comes from EXAMPLES_FRAMEWORK, and a missing or unknown one throws", () => {
        expect(frameworkOf("vue")).toBe("vue");
        expect(() => frameworkOf(undefined)).toThrow(/EXAMPLES_FRAMEWORK/);
        expect(() => frameworkOf("svelte")).toThrow(/react, vue, angular/);
    });

    it("mounts each framework's embed under its own base", () => {
        expect(embedBase("react")).toBe("/dockable/embed/react/");
        expect(embedBase("angular")).toBe("/dockable/embed/angular/");
    });
});

describe("a spec's examples", () => {
    const available = ["hello-layout", "popout"];

    it("run when the framework has every one", () => {
        expect(skipReason("vue", available, ["hello-layout"])).toBeUndefined();
        expect(skipReason("vue", available, [])).toBeUndefined();
    });

    it("skip, naming the missing ones, when it lacks some", () => {
        expect(
            skipReason("vue", available, ["popout", "maximize", "borders"]),
        ).toBe("vue has no maximize, borders example");
    });
});
