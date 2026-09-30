import { describe, expect, it } from "vitest";
import { THEMES } from "../../../examples/react/src/examples/_themes/themes.ts";
import { parseView, sameItem, toSearch, type View } from "../src/view.ts";

const DEFAULTS: View = {
    item: null,
    theme: "light",
    code: false,
    inspect: false,
};

describe("the view in the URL", () => {
    it("defaults to nothing chosen, the first light theme, no panels", () => {
        expect(parseView("")).toEqual(DEFAULTS);
    });

    it("leaves defaults out of the query", () => {
        expect(toSearch(DEFAULTS)).toBe("?");
    });

    it("round-trips every setting", () => {
        const views: View[] = [
            { ...DEFAULTS, item: { kind: "example", id: "hello-layout" } },
            {
                item: { kind: "example", id: "popout" },
                theme: "terminal",
                code: true,
                inspect: false,
            },
            {
                item: { kind: "scenario", id: "api/actions" },
                theme: "dark",
                code: false,
                inspect: true,
            },
            ...THEMES.map((t) => ({ ...DEFAULTS, theme: t.name })),
        ];
        for (const view of views) {
            expect(parseView(toSearch(view))).toEqual(view);
        }
    });

    it("falls back on unknown values instead of applying them", () => {
        expect(parseView("?theme=sepia&code=yes&inspect=true&nope=1")).toEqual(
            DEFAULTS,
        );
    });

    it("compares entries by kind and id", () => {
        const a = { kind: "example" as const, id: "a" };
        expect(sameItem(a, { kind: "example", id: "a" })).toBe(true);
        expect(sameItem(a, { kind: "example", id: "b" })).toBe(false);
        expect(sameItem(null, null)).toBe(true);
        expect(sameItem(a, null)).toBe(false);
    });
});
