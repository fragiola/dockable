import { describe, expect, it } from "vitest";
import {
    createModel,
    DROP_INDICATOR_PATH,
    getSplitterPath,
    getTabButtonId,
    getTabButtonPath,
    getTabPanelId,
    getTabStripPath,
} from "../src";
import { computePaths, windowPath } from "../src/paths";

// the three-tabs layout from FlexLayout's demo, with the last tabset nested in a column
const model = createModel({
    version: 1,
    root: {
        type: "row",
        id: "root",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [{ id: "one", component: "x", label: "x" }],
            },
            {
                type: "row",
                id: "col",
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [{ id: "two", component: "x", label: "x" }],
                    },
                    {
                        type: "tabset",
                        id: "ts2",
                        children: [
                            { id: "three", component: "x", label: "x" },
                            {
                                id: "four with space",
                                component: "x",
                                label: "x",
                            },
                        ],
                    },
                ],
            },
        ],
    },
    borders: [
        {
            location: "start",
            children: [{ id: "files", component: "x", label: "x" }],
        },
    ],
});
const paths = computePaths(model.state.root, "", model.state.borders);
const path = (id: string) => paths.get(id) ?? "";

describe("data-layout-path helpers", () => {
    it("follow FlexLayout's scheme", () => {
        expect(path("root")).toBe("");
        expect(path("ts0")).toBe("/ts0");
        expect(path("col")).toBe("/r1");
        expect(path("ts2")).toBe("/r1/ts1");
        expect(path("four with space")).toBe("/r1/ts1/t1");
        expect(getTabButtonPath(path("four with space"))).toBe("/r1/ts1/tb1");
        expect(getTabStripPath(path("ts0"))).toBe("/ts0/tabstrip");
        expect(getSplitterPath(path("root"), 1)).toBe("/s0");
        expect(getSplitterPath(path("col"), 1)).toBe("/r1/s0");
        expect(DROP_INDICATOR_PATH).toBe("/outline");
    });

    it("put borders under /border/<location>, and windows under /sublayout<n>", () => {
        expect(path("border_start")).toBe("/border/start");
        expect(path("files")).toBe("/border/start/t0");
        expect(getTabButtonPath(path("files"))).toBe("/border/start/tb0");
        expect(windowPath(1)).toBe("/sublayout1");
        const window = computePaths(model.state.root, windowPath(2));
        expect(window.get("ts0")).toBe("/sublayout2/ts0");
    });

    it("build DOM ids without whitespace", () => {
        expect(getTabButtonId("four with space")).toBe(
            "dockable-tabbutton-four_with_space",
        );
        expect(getTabPanelId("four with space")).toBe(
            "dockable-tab-four_with_space",
        );
    });
});
