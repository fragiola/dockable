import type { IJsonModel } from "@fragiola/dockable";
import testAutohideBorders from "../layouts/test_autohide_borders.json";
import testBorderDirection from "../layouts/test_border_direction.json";
import testOverlay from "../layouts/test_overlay.json";
import testThreeTabs from "../layouts/test_three_tabs.json";
import testTwoTabs from "../layouts/test_two_tabs.json";

/** four tabsets per nested row, for the realtime splitter specs */
const ts = (name: string) => ({
    type: "tabset" as const,
    weight: 1,
    children: [{ type: "tab" as const, name, component: "testing" }],
});

const big: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "row",
                weight: 1,
                children: [ts("A"), ts("B"), ts("C"), ts("D")],
            },
            {
                type: "row",
                weight: 1,
                children: [ts("E"), ts("F"), ts("G"), ts("H")],
            },
        ],
    },
};

/** a tabset with three tabs next to a tabset with one, for keyboard navigation */
const multi: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "One", component: "testing" },
                    { type: "tab", name: "Two", component: "testing" },
                    { type: "tab", name: "Three", component: "testing" },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [{ type: "tab", name: "Four", component: "testing" }],
            },
        ],
    },
};

export const layouts: Record<string, IJsonModel> = {
    multi,
    test_two_tabs: testTwoTabs as IJsonModel,
    test_three_tabs: testThreeTabs as IJsonModel,
    big,
    test_overlay: testOverlay as IJsonModel,
    test_border_direction: testBorderDirection as IJsonModel,
    test_autohide_borders: testAutohideBorders as IJsonModel,
};

/** the layout named by the `layout` query parameter (default: test_two_tabs) */
export function layoutFromQuery(fallback = "test_two_tabs"): IJsonModel {
    const name =
        new URLSearchParams(window.location.search).get("layout") ?? fallback;
    const json = layouts[name];
    if (!json) {
        throw new Error(`unknown layout "${name}"`);
    }
    return structuredClone(json);
}
