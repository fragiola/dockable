import { describe, expect, it } from "vitest";
import {
    COMPLETE_FRAMEWORKS,
    embedBase,
    frameworkOf,
    skipOrFail,
    skipReason,
} from "../e2e/available.ts";

// The shared e2e suite runs against every framework's embed; a spec that opens an example the
// framework does not have is skipped with this reason, unless the framework ships every example
// (e2e/helpers.ts).
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

describe("a complete framework", () => {
    const available = ["hello-layout"];

    it("is React or Vue", () => {
        expect(COMPLETE_FRAMEWORKS).toEqual(["react", "vue"]);
    });

    it("fails a spec whose example it lacks, instead of skipping it", () => {
        expect(() => skipOrFail("vue", available, ["popout"])).toThrow(
            /vue has no popout example, but every vue example is required/,
        );
        expect(skipOrFail("vue", available, ["hello-layout"])).toBeUndefined();
    });

    it("leaves the others skipping", () => {
        expect(skipOrFail("angular", available, ["popout"])).toBe(
            "angular has no popout example",
        );
    });
});
