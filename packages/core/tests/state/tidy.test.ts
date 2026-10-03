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
        expect(model.get("node-by", { id: "empty" })).toBeUndefined();
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
        expect(model.get("node-by", { id: "r" })).toBeUndefined();
        expect(model.get("node-parent-by", { nodeId: "b" })?.id).toBe(
            model.state.root.id,
        );
        expect(model.get("node-by", { id: "b" })).toMatchObject({
            weight: 40,
        });
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
            model.get("node-by", { id: "b" })?.type === "tabset" &&
                model.get("node-by", { id: "b" }),
        ).toMatchObject({ weight: 25 });
        expect(model.get("node-by", { id: "c" })).toMatchObject({
            weight: 25,
        });
    });

    it("removes an empty tabset", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tab.close", { tabId: "Two" }));
        expect(model.get("node-by", { id: "ts1" })).toBeUndefined();
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
                        closable: false,
                        children: [tab("Three")],
                    },
                ],
            },
        });
        must(kept.run("tab.close", { tabId: "Two" }));
        must(kept.run("tab.close", { tabId: "Three" }));
        expect(kept.get("node-by", { id: "b" })).toMatchObject({
            children: [],
            selected: -1,
        });
        expect(kept.get("node-by", { id: "c" })).toMatchObject({
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

    it("keeps the main layout's last tabset when its last tab closes", () => {
        const { model, text } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tabset.activate", { tabsetId: "ts1" }));
        must(model.run("tab.close", { tabId: "Two" }));
        must(model.run("tab.close", { tabId: "One" }));
        expect(text()).toBe("");
        const [only] = model.state.root.children;
        expect(only).toMatchObject({
            type: "tabset",
            id: "ts0",
            selected: -1,
            children: [],
        });
        expect(model.get("active-tabset")?.id).toBe("ts0");
    });

    it("gives a main layout with no tabset a new one, which becomes active (caplin/FlexLayout#394)", () => {
        // by design: the main layout always has a tabset to drop into
        const { model } = setup({
            version: 1,
            root: { type: "row", id: "root", children: [] },
        });
        const [only] = model.state.root.children;
        expect(only).toMatchObject({
            type: "tabset",
            selected: -1,
            children: [],
        });
        expect(model.get("active-tabset")?.id).toBe(only?.id);
        // and so does one whose last tabset a command removed
        must(model.run("tabset.close", { tabsetId: only?.id ?? "" }));
        const [next] = model.state.root.children;
        expect(next?.type).toBe("tabset");
        expect(next?.id).not.toBe(only?.id);
    });

    it("keeps the JSON's empty tabset, with its id, instead of making a new one (caplin/FlexLayout#291)", () => {
        const json = {
            version: 1 as const,
            root: {
                type: "row" as const,
                children: [
                    { type: "tabset" as const, id: "test", children: [] },
                ],
            },
        };
        const { model } = setup(json);
        expect(model.state.root.children.map((c) => c.id)).toEqual(["test"]);
        expect(model.get("active-tabset")?.id).toBe("test");
        must(
            model.run("tab.add", {
                component: "test",
                label: "Added",
                to: "test",
            }),
        );
        expect(model.get("node-by", { id: "test" })).toMatchObject({
            children: [{ label: "Added" }],
        });
        // layout.load tidies the same way
        must(model.run("layout.load", { layout: json }));
        expect(model.state.root.children.map((c) => c.id)).toEqual(["test"]);
        expect(
            model.can("tab.add", { component: "test", label: "x", to: "test" }),
        ).toBe(true);
    });

    it("keeps only the first of several empty tabsets of the main layout (caplin/FlexLayout#291)", () => {
        const { model } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "row",
                        children: [{ type: "tabset", id: "a", children: [] }],
                    },
                    { type: "tabset", id: "b", children: [] },
                ],
            },
        });
        expect(model.state.root.children.map((c) => c.id)).toEqual(["a"]);
        expect(model.get("node-by", { id: "b" })).toBeUndefined();
    });

    it("keeps the active one of several empty tabsets of the main layout (caplin/FlexLayout#291)", () => {
        const { model } = setup({
            version: 1,
            active: "b",
            root: {
                type: "row",
                children: [
                    { type: "tabset", id: "a", children: [] },
                    { type: "tabset", id: "b", children: [] },
                ],
            },
        });
        expect(model.state.root.children.map((c) => c.id)).toEqual(["b"]);
        expect(model.get("active-tabset")?.id).toBe("b");
    });

    it("does not leave the kept tabset maximized: the only tabset cannot be (caplin/FlexLayout#291)", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tabset.maximize", { tabsetId: "ts1", value: true }));
        must(model.run("tab.close", { tabId: "One" }));
        must(model.run("tab.close", { tabId: "Two" }));
        expect(model.state.root.children.map((c) => c.id)).toEqual(["ts1"]);
        expect(model.get("maximized-tabset")).toBeUndefined();
        expect(model.state.maximized).toBeUndefined();
        // from the JSON too
        const loaded = setup({
            version: 1,
            maximized: "x",
            root: {
                type: "row",
                children: [{ type: "tabset", id: "x", children: [] }],
            },
        }).model;
        expect(loaded.get("maximized-tabset")).toBeUndefined();
    });

    it("still removes the empty tabsets beside a tabset with tabs (caplin/FlexLayout#291)", () => {
        const { model } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    { type: "tabset", id: "empty", children: [] },
                    { type: "tabset", id: "full", children: [tab("One")] },
                ],
            },
        });
        expect(model.state.root.children.map((c) => c.id)).toEqual(["full"]);
    });

    it("removes an empty window", () => {
        const { model } = setup(tabsets(["One", "Two"]));
        must(model.run("tab.configure", { tabId: "Two", poppable: true }));
        const { windowId: window } = must(
            model.run("tab.popout", { tabId: "Two" }),
        );
        expect(model.get("window-by", { id: window })).toBeDefined();
        must(model.run("tab.close", { tabId: "Two" }));
        expect(model.get("window-by", { id: window })).toBeUndefined();
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
