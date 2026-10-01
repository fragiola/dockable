// The tidy rules of FlexLayout's RowNode.tidy (design record §9.1).
import { describe, expect, it } from "vitest";
import { createModel } from "../../src/state/model";
import { must, setup, tab, tabsets } from "./harness";

describe("tidy", () => {
    it("removes an empty row", () => {
        const { model } = setup({
            version: 1,
            root: {
                type: "row",
                id: "root",
                children: [
                    { type: "tabset", id: "a", children: [tab("One")] },
                    { type: "tabset", id: "b", children: [tab("Two")] },
                    { type: "row", id: "empty", children: [] },
                ],
            },
        });
        expect(model.get("node", { node: "empty" })).toBeUndefined();
        expect(model.state.root.children.map((c) => c.id)).toEqual(["a", "b"]);
    });

    it("hoists a single child", () => {
        const { model } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    { type: "tabset", id: "a", children: [tab("One")] },
                    {
                        type: "row",
                        id: "r",
                        weight: 40,
                        children: [
                            {
                                type: "tabset",
                                id: "b",
                                weight: 10,
                                children: [tab("Two")],
                            },
                        ],
                    },
                ],
            },
        });
        expect(model.get("node", { node: "r" })).toBeUndefined();
        expect(model.get("parent", { node: "b" })?.id).toBe(
            model.state.root.id,
        );
        expect(model.get("node", { node: "b" })).toMatchObject({ weight: 40 });
    });

    it("scales hoisted weights", () => {
        const { model } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    { type: "tabset", id: "a", children: [tab("One")] },
                    {
                        type: "row",
                        id: "outer",
                        weight: 60,
                        children: [
                            {
                                type: "row",
                                id: "inner",
                                children: [
                                    {
                                        type: "tabset",
                                        id: "b",
                                        weight: 1,
                                        children: [tab("Two")],
                                    },
                                    {
                                        type: "tabset",
                                        id: "c",
                                        weight: 3,
                                        children: [tab("Three")],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
        // outer (one child: the inner row) is replaced by inner's children, scaled to outer's 60
        expect(model.state.root.children.map((c) => [c.id, c.weight])).toEqual([
            ["a", 100],
            ["b", 15],
            ["c", 45],
        ]);
    });

    it("spreads hoisted weights evenly when they sum to zero", () => {
        const { model } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    { type: "tabset", id: "a", children: [tab("One")] },
                    {
                        type: "row",
                        weight: 50,
                        children: [
                            {
                                type: "row",
                                children: [
                                    {
                                        type: "tabset",
                                        id: "b",
                                        weight: 0,
                                        children: [tab("Two")],
                                    },
                                    {
                                        type: "tabset",
                                        id: "c",
                                        weight: 0,
                                        children: [tab("Three")],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
        expect(
            model.get("node", { node: "b" })?.type === "tabset" &&
                model.get("node", { node: "b" }),
        ).toMatchObject({ weight: 25 });
        expect(model.get("node", { node: "c" })).toMatchObject({ weight: 25 });
    });

    it("removes an empty tabset", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tab.close", { tabId: "Two" }));
        expect(model.get("node", { node: "ts1" })).toBeUndefined();
    });

    it("keeps an empty tabset that must stay", () => {
        const kept = createModel({
            version: 1,
            root: {
                type: "row",
                children: [
                    { type: "tabset", id: "a", children: [tab("One")] },
                    {
                        type: "tabset",
                        id: "b",
                        deleteWhenEmpty: false,
                        children: [tab("Two")],
                    },
                    {
                        type: "tabset",
                        id: "c",
                        enableClose: false,
                        children: [tab("Three")],
                    },
                ],
            },
        });
        must(kept.run("tab.close", { tabId: "Two" }));
        must(kept.run("tab.close", { tabId: "Three" }));
        expect(kept.get("node", { node: "b" })).toMatchObject({
            children: [],
            selected: -1,
        });
        expect(kept.get("node", { node: "c" })).toMatchObject({
            children: [],
            selected: -1,
        });
    });

    it("clears the maximize of a removed tabset", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tabset.maximize", { tabsetId: "ts1", value: true }));
        must(model.run("tab.close", { tabId: "Two" }));
        expect(model.get("maximized-tabset")).toBeUndefined();
        expect(model.state.maximized).toBeUndefined();
    });

    it("gives an empty main layout a tabset", () => {
        const { model, text } = setup(tabsets(["One"]));
        must(model.run("tab.close", { tabId: "One" }));
        expect(text()).toBe("");
        const [only] = model.state.root.children;
        expect(only).toMatchObject({
            type: "tabset",
            selected: -1,
            children: [],
        });
        expect(model.get("active-tabset")?.id).toBe(only?.id);
    });

    it("removes an empty window", () => {
        const { model } = setup(tabsets(["One", "Two"]));
        must(model.run("tab.configure", { tabId: "Two", enablePopout: true }));
        const { windowId: window } = must(
            model.run("tab.popout", { tabId: "Two" }),
        );
        expect(model.get("window", { window })).toBeDefined();
        must(model.run("tab.close", { tabId: "Two" }));
        expect(model.get("window", { window })).toBeUndefined();
        expect(model.state.windows).toEqual([]);
    });

    it("clears a dangling active tabset", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tabset.activate", { tabsetId: "ts1" }));
        must(model.run("tab.close", { tabId: "Two" }));
        expect(model.state.active).toBeUndefined();
        expect(model.get("active-tabset")).toBeUndefined();
    });
});
