// The docking rules of FlexLayout's TabSetNode.drop and RowNode.drop (design record §9.3) and the
// drop rules the commands enforce (§5.8).
import { describe, expect, it } from "vitest";
import type { LayoutJson } from "../../src/state/json";
import { createModel, type Model } from "../../src/state/model";
import { at, must, setup, tab, tabsets } from "./harness";

function weights(model: Model) {
    return model.state.root.children.map((child) => child.weight);
}

describe("docking", () => {
    it("split along the row", () => {
        const { model, text } = setup(tabsets(["One", "Two"], ["Three"]));
        must(
            model.run("tab.move", { tab: "Two", to: "ts0", location: "right" }),
        );
        expect(text()).toBe("/ts0/t0[One]*,/ts1/t0[Two]*,/ts2/t0[Three]*");
        expect(weights(model)).toEqual([50, 50, 100]);
    });

    it("split across the row", () => {
        const { model, text } = setup(tabsets(["One", "Two"], ["Three"]));
        must(
            model.run("tab.move", {
                tab: "Two",
                to: "ts0",
                location: "bottom",
            }),
        );
        expect(text()).toBe(
            "/r0/ts0/t0[One]*,/r0/ts1/t0[Two]*,/ts1/t0[Three]*",
        );
        const wrapper = model.state.root.children[0];
        expect(wrapper?.type).toBe("row");
        expect(wrapper?.weight).toBe(100);
        expect(
            wrapper?.type === "row" && wrapper.children.map((c) => c.weight),
        ).toEqual([50, 50]);
    });

    it("split on the top edge puts the new tabset first", () => {
        const { model, text } = setup(tabsets(["One", "Two"]));
        must(model.run("tab.move", { tab: "Two", to: "ts0", location: "top" }));
        expect(text()).toBe("/r0/ts0/t0[Two]*,/r0/ts1/t0[One]*");
    });

    it("edge dock along", () => {
        const { model, text } = setup(tabsets(["One", "Two"], ["Three"]));
        must(
            model.run("tab.move", { tab: "Two", to: "root", location: "left" }),
        );
        expect(text()).toBe("/ts0/t0[Two]*,/ts1/t0[One]*,/ts2/t0[Three]*");
        // a third of the row's total weight
        expect(weights(model)[0]).toBeCloseTo(200 / 3);
    });

    it("edge dock across", () => {
        const { model, text } = setup(tabsets(["One", "Two"], ["Three"]));
        must(
            model.run("tab.move", {
                tab: "Two",
                to: "root",
                location: "bottom",
            }),
        );
        expect(text()).toBe(
            "/r0/r0/ts0/t0[One]*,/r0/r0/ts1/t0[Three]*,/r0/ts1/t0[Two]*",
        );
        const outer = model.state.root.children[0];
        expect(
            outer?.type === "row" && outer.children.map((c) => c.weight),
        ).toEqual([75, 25]);
    });

    it("a layout id docks at that layout's root row", () => {
        const { model, text } = setup(tabsets(["One", "Two"]));
        must(
            model.run("tab.add", {
                component: "x",
                data: { name: "New" },
                to: "main",
                location: "right",
            }),
        );
        expect(text()).toBe("/ts0/t0[One]*,/ts0/t1[Two],/ts1/t0[New]*");
    });

    it("a center drop on a row adds a tabset at the index", () => {
        const { model, text } = setup(tabsets(["One"], ["Two"]));
        must(
            model.run("tab.add", {
                component: "x",
                data: { name: "New" },
                to: "root",
                index: 1,
            }),
        );
        expect(text()).toBe("/ts0/t0[One]*,/ts1/t0[New]*,/ts2/t0[Two]*");
    });

    it("drop activates", () => {
        const { model } = setup(tabsets(["One", "Two"], ["Three"]));
        must(model.run("tab.move", { tab: "One", to: "ts1" }));
        expect(model.get("active-tabset")?.id).toBe("ts1");
        must(
            model.run("tab.move", { tab: "Two", to: "ts1", location: "left" }),
        );
        expect(model.get("active-tabset")?.id).toBe(at(model, "/ts0"));
    });

    it("move clears maximize", () => {
        const { model } = setup(tabsets(["One"], ["Two"], ["Three"]));
        must(model.run("tabset.maximize", { tabset: "ts1", value: true }));
        must(
            model.run("tabset.move", {
                tabset: "ts1",
                to: "ts2",
                location: "bottom",
            }),
        );
        expect(model.get("maximized-tabset")).toBeUndefined();
    });

    it("a tabset merges into a tabset", () => {
        const { model, text } = setup(tabsets(["One"], ["Two", "Three"]));
        const result = must(
            model.run("tabset.move", { tabset: "ts1", to: "ts0" }),
        );
        expect(result).toEqual({ tabset: "ts0" });
        expect(text()).toBe("/ts0/t0[One]*,/ts0/t1[Two],/ts0/t2[Three]");
    });
});

describe("drop rules", () => {
    const flags = (extra: Record<string, unknown>): LayoutJson => ({
        version: 1,
        root: {
            type: "row",
            id: "root",
            children: [
                {
                    type: "tabset",
                    id: "ts0",
                    children: [tab("One"), tab("Two")],
                },
                {
                    type: "tabset",
                    id: "ts1",
                    children: [tab("Three")],
                    ...extra,
                },
            ],
        },
    });

    it("refuses a center drop on a tabset that takes none", () => {
        const model = createModel(flags({ enableDrop: false }));
        expect(model.run("tab.move", { tab: "One", to: "ts1" })).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'tabset "ts1" does not accept drops',
                path: "/to",
            },
        });
        expect(
            model.run("tab.move", { tab: "One", to: "ts1", location: "left" })
                .ok,
        ).toBe(true);
    });

    it("refuses an edge drop on a tabset that cannot be split", () => {
        const model = createModel(flags({ enableDivide: false }));
        const result = model.run("tab.move", {
            tab: "One",
            to: "ts1",
            location: "top",
        });
        expect(!result.ok && result.error.code).toBe("refused");
        expect(model.run("tab.move", { tab: "One", to: "ts1" }).ok).toBe(true);
    });

    it("refuses a tab that cannot be dragged", () => {
        const model = createModel(tabsets(["One", "Two"], ["Three"]));
        must(model.run("tab.configure", { tab: "One", enableDrag: false }));
        const result = model.run("tab.move", { tab: "One", to: "ts1" });
        expect(!result.ok && result.error).toMatchObject({
            code: "refused",
            path: "/tab",
        });
    });

    it("keeps a pinned tab in its tabset", () => {
        const model = createModel(tabsets(["One", "Two"], ["Three"]));
        must(model.run("tab.pin", { tab: "One", value: true }));
        expect(model.run("tab.move", { tab: "One", to: "ts1" }).ok).toBe(false);
        expect(
            model.run("tab.move", { tab: "One", to: "ts0", location: "right" })
                .ok,
        ).toBe(false);
        expect(
            model.run("tab.move", { tab: "One", to: "ts0", index: 1 }).ok,
        ).toBe(true);
    });

    it("refuses merging a tabset that cannot close or holds pinned tabs", () => {
        const model = createModel(flags({ enableClose: false }));
        expect(model.run("tabset.move", { tabset: "ts1", to: "ts0" }).ok).toBe(
            false,
        );
        expect(
            model.run("tabset.move", {
                tabset: "ts1",
                to: "ts0",
                location: "left",
            }).ok,
        ).toBe(true);
        must(model.run("tab.pin", { tab: "One", value: true }));
        expect(model.run("tabset.move", { tabset: "ts0", to: "ts1" }).ok).toBe(
            false,
        );
    });

    it("refuses moving a tabset into itself", () => {
        const model = createModel(tabsets(["One"], ["Two"]));
        const result = model.run("tabset.move", {
            tabset: "ts0",
            to: "ts0",
            location: "left",
        });
        expect(!result.ok && result.error.message).toBe(
            "a tabset cannot be moved into itself",
        );
    });

    it("refuses a border that takes no drops, an edge on a border, and a tabset on a border", () => {
        const model = createModel({
            ...tabsets(["One"], ["Two"]),
            borders: [
                { location: "left", children: [] },
                { location: "right", enableDrop: false, children: [] },
            ],
        });
        expect(
            model.run("tab.move", { tab: "One", to: "border_right" }).ok,
        ).toBe(false);
        expect(
            model.run("tab.move", {
                tab: "One",
                to: "border_left",
                location: "top",
            }).ok,
        ).toBe(false);
        expect(
            model.run("tabset.move", { tabset: "ts0", to: "border_left" }).ok,
        ).toBe(false);
        expect(
            model.run("tab.move", { tab: "One", to: "border_left" }).ok,
        ).toBe(true);
    });

    it("refuses a tab without popouts in a window", () => {
        const model = createModel({
            ...tabsets(["One", "Two"]),
            defaults: { tab: { enablePopout: true } },
        });
        const { window } = must(model.run("tab.popout", { tab: "One" }));
        must(model.run("tab.configure", { tab: "Two", enablePopout: false }));
        const target = model.get("tabsets", { layout: window })[0]?.id ?? "";
        expect(model.run("tab.move", { tab: "Two", to: target }).ok).toBe(
            false,
        );
        must(model.run("tab.configure", { tab: "Two", enablePopout: null }));
        expect(model.run("tab.move", { tab: "Two", to: target }).ok).toBe(true);
    });

    it("reports a target that is not a container", () => {
        const model = createModel(tabsets(["One", "Two"]));
        expect(model.run("tab.move", { tab: "One", to: "Two" })).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: '"Two" is not a tabset, row, border or layout',
                path: "/to",
            },
        });
    });
});
