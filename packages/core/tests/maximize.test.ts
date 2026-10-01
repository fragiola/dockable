import { describe, expect, it } from "vitest";
import { createModel, type LayoutJson, MAIN_LAYOUT } from "../src";

// root row: ts0 (tab a) | nested row r1 (ts1 above ts2)
const json: LayoutJson = {
    version: 1,
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        id: "root",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [{ id: "a", component: "x" }],
            },
            {
                type: "row",
                id: "r1",
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [{ id: "b", component: "x" }],
                    },
                    {
                        type: "tabset",
                        id: "ts2",
                        children: [{ id: "c", component: "x" }],
                    },
                ],
            },
        ],
    },
};

function setup() {
    const model = createModel(structuredClone(json));
    const hidden = (id: string) =>
        model.is("node-hidden-by-maximize", { nodeId: id });
    return { model, hidden };
}

describe('model.is("node-hidden-by-maximize")', () => {
    it("hides nothing while no tabset is maximized", () => {
        const { hidden } = setup();
        for (const id of ["root", "ts0", "r1", "ts1", "ts2"]) {
            expect(hidden(id)).toBe(false);
        }
    });

    it("hides the other tabsets and the rows that do not contain the maximized one", () => {
        const { model, hidden } = setup();
        model.run("tabset.maximize", { tabsetId: "ts0", value: true });
        expect(hidden("ts0")).toBe(false);
        expect(hidden("root")).toBe(false); // the root row is on every path
        expect(hidden("r1")).toBe(true); // a sibling row gives up its space
        expect(hidden("ts1")).toBe(true);
        expect(hidden("ts2")).toBe(true);
    });

    it("keeps the rows on the path to a nested maximized tabset", () => {
        const { model, hidden } = setup();
        model.run("tabset.maximize", { tabsetId: "ts2", value: true });
        expect(hidden("root")).toBe(false);
        expect(hidden("r1")).toBe(false);
        expect(hidden("ts2")).toBe(false);
        expect(hidden("ts1")).toBe(true);
        expect(hidden("ts0")).toBe(true);
    });

    it("never hides tabs, and only reads the node's own layout", () => {
        const { model, hidden } = setup();
        model.run("tabset.maximize", { tabsetId: "ts0", value: true });
        expect(hidden("b")).toBe(false); // a tab: its panel follows the engine's visibility
        // a tabset popped out into a window is in another layout: no maximized tabset there
        model.run("tabset.popout", { tabsetId: "ts1" });
        expect(model.get("layout-id-by-node-id", { nodeId: "ts1" })).not.toBe(
            MAIN_LAYOUT,
        );
        expect(hidden("ts1")).toBe(false);
    });
});
