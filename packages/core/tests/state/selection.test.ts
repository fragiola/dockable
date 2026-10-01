// The selection rules of FlexLayout's Utils.ts and the drop methods (design record §9.2).
import { describe, expect, it } from "vitest";
import { must, setup, tab, tabsets } from "./harness";

describe("selection", () => {
    it("close selects the next tab", () => {
        const { model, text } = setup(tabsets(["One", "Two", "Three"]));
        must(model.run("tab.select", { tab: "Two" }));
        must(model.run("tab.close", { tab: "Two" }));
        expect(text()).toBe("/ts0/t0[One],/ts0/t1[Three]*");
        must(model.run("tab.close", { tab: "Three" }));
        expect(text()).toBe("/ts0/t0[One]*");
    });

    it("close before the selected tab keeps it selected", () => {
        const { model, text } = setup(tabsets(["One", "Two", "Three"]));
        must(model.run("tab.select", { tab: "Three" }));
        must(model.run("tab.close", { tab: "One" }));
        expect(text()).toBe("/ts0/t0[Two],/ts0/t1[Three]*");
    });

    it("border close clamps", () => {
        const { model, text } = setup({
            ...tabsets(["Main"]),
            borders: [
                {
                    location: "left",
                    selected: 2,
                    children: [tab("A"), tab("B"), tab("C")],
                },
            ],
        });
        must(model.run("tab.close", { tab: "A" }));
        // the index stays 2 and is clamped to the last tab (FlexLayout's BorderNode.remove)
        expect(text()).toBe("/b/left/t0[B],/b/left/t1[C]*,/ts0/t0[Main]*");
    });

    it("insert selects", () => {
        const { model, text } = setup(tabsets(["One", "Two"], ["Three"]));
        must(model.run("tab.move", { tab: "Three", to: "ts0", index: 1 }));
        expect(text()).toBe("/ts0/t0[One],/ts0/t1[Three]*,/ts0/t2[Two]");
    });

    it("insert keeps the selection", () => {
        const { model, text } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        autoSelectTab: false,
                        children: [tab("One"), tab("Two")],
                    },
                    { type: "tabset", id: "ts1", children: [tab("Three")] },
                ],
            },
        });
        must(model.run("tab.select", { tab: "Two" }));
        must(model.run("tab.move", { tab: "Three", to: "ts0", index: 0 }));
        expect(text()).toBe("/ts0/t0[Three],/ts0/t1[One],/ts0/t2[Two]*");
        must(
            model.run("tab.add", {
                component: "x",
                data: { name: "Four" },
                to: "ts0",
                select: true,
            }),
        );
        expect(text()).toBe(
            "/ts0/t0[Three],/ts0/t1[One],/ts0/t2[Two],/ts0/t3[Four]*",
        );
    });

    it("moving the open border tab closes it", () => {
        const { model, text } = setup({
            ...tabsets(["Main"]),
            borders: [
                {
                    location: "left",
                    selected: 0,
                    children: [tab("A"), tab("B")],
                },
            ],
        });
        must(model.run("tab.move", { tab: "A", to: "ts0" }));
        expect(text()).toBe("/b/left/t0[B],/ts0/t0[Main],/ts0/t1[A]*");
    });

    it("a border selects what it receives while open, not while closed", () => {
        const { model, text } = setup({
            ...tabsets(["One", "Two"]),
            borders: [
                { location: "left", selected: -1, children: [tab("A")] },
                { location: "right", selected: 0, children: [tab("B")] },
            ],
        });
        must(model.run("tab.move", { tab: "One", to: "border_left" }));
        must(model.run("tab.move", { tab: "Two", to: "border_right" }));
        // the emptied tabset is removed and the main layout gets a new empty one
        expect(text()).toBe(
            "/b/left/t0[A],/b/left/t1[One],/b/right/t0[B],/b/right/t1[Two]*",
        );
        expect(model.get("node", { node: "border_left" })).toMatchObject({
            selected: -1,
        });
        expect(model.get("node", { node: "border_right" })).toMatchObject({
            selected: 1,
        });
    });

    it("row edge dock resets the source selection", () => {
        const { model, text } = setup(
            tabsets(["One", "Two", "Three"], ["Four"]),
        );
        must(model.run("tab.select", { tab: "Three" }));
        must(
            model.run("tab.move", {
                tab: "Two",
                to: "root",
                location: "right",
            }),
        );
        // the source tabset selects its first tab, as FlexLayout's RowNode.drop does
        expect(text()).toBe(
            "/ts0/t0[One]*,/ts0/t1[Three],/ts1/t0[Four]*,/ts2/t0[Two]*",
        );
    });

    it("merge keeps the selection", () => {
        const { model, text } = setup(
            tabsets(["One", "Two"], ["Three", "Four"]),
        );
        must(model.run("tab.select", { tab: "Two" }));
        must(model.run("tabset.move", { tabset: "ts1", to: "ts0", index: 0 }));
        expect(text()).toBe(
            "/ts0/t0[Three],/ts0/t1[Four],/ts0/t2[One],/ts0/t3[Two]*",
        );
    });

    it("reorder forward", () => {
        const { model, text } = setup(tabsets(["One", "Two", "Three"]));
        must(model.run("tab.move", { tab: "One", to: "ts0", index: 2 }));
        expect(text()).toBe("/ts0/t0[Two],/ts0/t1[One]*,/ts0/t2[Three]");
    });

    it("select in a border opens it and is idempotent", () => {
        const { model } = setup({
            ...tabsets(["Main"]),
            borders: [{ location: "bottom", children: [tab("A"), tab("B")] }],
        });
        must(model.run("tab.select", { tab: "B" }));
        expect(model.get("node", { node: "border_bottom" })).toMatchObject({
            selected: 1,
        });
        const before = model.state;
        must(model.run("tab.select", { tab: "B" }));
        expect(model.state).toBe(before);
    });
});
