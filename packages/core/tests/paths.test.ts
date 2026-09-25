import { describe, expect, it } from "vitest";
import {
    DROP_INDICATOR_PATH,
    getNodePath,
    getSplitterPath,
    getTabButtonId,
    getTabButtonPath,
    getTabPanelId,
    getTabPanelPath,
    getTabStripPath,
    Model,
    type RowNode,
    type TabNode,
    type TabSetNode,
} from "../src";

// the three-tabs layout from FlexLayout's demo, with the last tabset nested in a column
const model = Model.fromJson({
    global: {},
    layout: {
        type: "row",
        id: "root",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [{ type: "tab", id: "one", name: "One" }],
            },
            {
                type: "row",
                id: "col",
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [{ type: "tab", id: "two", name: "Two" }],
                    },
                    {
                        type: "tabset",
                        id: "ts2",
                        children: [
                            { type: "tab", id: "three", name: "Three" },
                            {
                                type: "tab",
                                id: "four with space",
                                name: "Four",
                            },
                        ],
                    },
                ],
            },
        ],
    },
});
model.getRootRow()?.setPaths("");

const get = <T>(id: string) => model.getNodeById(id) as unknown as T;

describe("data-layout-path helpers", () => {
    it("follow FlexLayout's scheme", () => {
        expect(getNodePath(get<TabSetNode>("ts0"))).toBe("/ts0");
        expect(getNodePath(get<RowNode>("col"))).toBe("/r1");
        expect(getNodePath(get<TabSetNode>("ts2"))).toBe("/r1/ts1");
        expect(getTabPanelPath(get<TabNode>("four with space"))).toBe(
            "/r1/ts1/t1",
        );
        expect(getTabButtonPath(get<TabNode>("four with space"))).toBe(
            "/r1/ts1/tb1",
        );
        expect(getTabStripPath(get<TabSetNode>("ts0"))).toBe("/ts0/tabstrip");
        expect(getSplitterPath(get<RowNode>("root"), 1)).toBe("/s0");
        expect(getSplitterPath(get<RowNode>("col"), 1)).toBe("/r1/s0");
        expect(DROP_INDICATOR_PATH).toBe("/outline");
    });

    it("build DOM ids without whitespace", () => {
        expect(getTabButtonId(get<TabNode>("four with space"))).toBe(
            "dockable-tabbutton-four_with_space",
        );
        expect(getTabPanelId(get<TabNode>("four with space"))).toBe(
            "dockable-tab-four_with_space",
        );
    });
});
