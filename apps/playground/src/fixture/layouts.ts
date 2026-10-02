import type { LayoutJson, TabsetJson } from "@fragiola/dockable-react";
import testAutohideBorders from "../layouts/test_autohide_borders.json";
import testBorderDirection from "../layouts/test_border_direction.json";
import testOverlay from "../layouts/test_overlay.json";
import testThreeTabs from "../layouts/test_three_tabs.json";
import testTwoTabs from "../layouts/test_two_tabs.json";

/**
 * The fixtures' type registry: one component with no data (a tab's label is the text every strip
 * renders), a tabset's optional name (its tab list's accessible name), and a border's tab
 * direction (the `Dockable.Border` prop, kept in the border's data so a command can switch it).
 */
export type Types = {
    tabs: { testing: undefined };
    tabset: { name?: string };
    border: { tabDirection?: "up" | "down" };
};

export type FixtureLayout = LayoutJson<Types>;

/** four tabsets per nested row, for the realtime splitter specs */
const ts = (name: string): TabsetJson<Types> => ({
    type: "tabset",
    weight: 1,
    children: [{ component: "testing", label: name }],
});

const big: FixtureLayout = {
    version: 1,
    root: {
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
const multi: FixtureLayout = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "testing", label: "One" },
                    { component: "testing", label: "Two" },
                    { component: "testing", label: "Three" },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [{ component: "testing", label: "Four" }],
            },
        ],
    },
};

export const layouts: Record<string, FixtureLayout> = {
    multi,
    test_two_tabs: testTwoTabs as FixtureLayout,
    test_three_tabs: testThreeTabs as FixtureLayout,
    big,
    test_overlay: testOverlay as FixtureLayout,
    test_border_direction: testBorderDirection as FixtureLayout,
    test_autohide_borders: testAutohideBorders as FixtureLayout,
};

/** the layout named by the `layout` query parameter (default: test_two_tabs) */
export function layoutFromQuery(fallback = "test_two_tabs"): FixtureLayout {
    const name =
        new URLSearchParams(window.location.search).get("layout") ?? fallback;
    const json = layouts[name];
    if (!json) {
        throw new Error(`unknown layout "${name}"`);
    }
    return structuredClone(json);
}
