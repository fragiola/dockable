import { describe, expect, it } from "vitest";
import { Actions, type IJsonModel, Model, type Node } from "../src";

// root row: ts0 (tabs a, b) | nested row r1 (ts1 above ts2)
const json: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        id: "root",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [{ type: "tab", id: "a", name: "A" }],
            },
            {
                type: "row",
                id: "r1",
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [{ type: "tab", id: "b", name: "B" }],
                    },
                    {
                        type: "tabset",
                        id: "ts2",
                        children: [{ type: "tab", id: "c", name: "C" }],
                    },
                ],
            },
        ],
    },
};

function setup() {
    const model = Model.fromJson(structuredClone(json));
    const node = (id: string) => model.getNodeById(id) as Node;
    const hidden = (id: string) => model.isHiddenByMaximize(node(id));
    return { model, node, hidden };
}

describe("Model.isHiddenByMaximize", () => {
    it("hides nothing while no tabset is maximized", () => {
        const { hidden } = setup();
        for (const id of ["root", "ts0", "r1", "ts1", "ts2"]) {
            expect(hidden(id)).toBe(false);
        }
    });

    it("hides the other tabsets and the rows that do not contain the maximized one", () => {
        const { model, hidden } = setup();
        model.doAction(Actions.maximizeToggle("ts0"));
        expect(hidden("ts0")).toBe(false);
        expect(hidden("root")).toBe(false); // the root row is on every path
        expect(hidden("r1")).toBe(true); // a sibling row gives up its space
        expect(hidden("ts1")).toBe(true);
        expect(hidden("ts2")).toBe(true);
    });

    it("keeps the rows on the path to a nested maximized tabset", () => {
        const { model, hidden } = setup();
        model.doAction(Actions.maximizeToggle("ts2"));
        expect(hidden("root")).toBe(false);
        expect(hidden("r1")).toBe(false);
        expect(hidden("ts2")).toBe(false);
        expect(hidden("ts1")).toBe(true);
        expect(hidden("ts0")).toBe(true);
    });

    it("never hides tabs, and only reads the node's own layout", () => {
        const { model, node, hidden } = setup();
        model.doAction(Actions.maximizeToggle("ts0"));
        expect(hidden("b")).toBe(false); // a tab: its panel follows isTabPanelVisible
        // a tabset popped out into a window is in another layout: no maximized tabset there
        model.doAction(Actions.popoutTabset("ts1"));
        const ts1 = node("b").getParent() as Node;
        expect(ts1.getLayoutId()).not.toBe(Model.MAIN_LAYOUT_ID);
        expect(model.isHiddenByMaximize(ts1)).toBe(false);
    });
});
