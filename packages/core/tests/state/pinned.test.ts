// Pinned tabs (design record §9.4): the model enforces the pinned run, and pinned tabs cannot be
// closed or leave their tabset.
import { describe, expect, it } from "vitest";
import { must, setup, tab, tabsets } from "./harness";

describe("pinned tabs", () => {
    it("pinned run", () => {
        const { model, text } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        children: [
                            tab("P1", { pinned: true }),
                            tab("P2", { pinned: true }),
                            tab("A"),
                        ],
                    },
                    { type: "tabset", id: "ts1", children: [tab("B")] },
                ],
            },
        });
        // an unpinned tab never lands inside the pinned run
        must(model.run("tab.move", { tab: "B", to: "ts0", index: 0 }));
        expect(text()).toBe("/ts0/t0[P1],/ts0/t1[P2],/ts0/t2[B]*,/ts0/t3[A]");
        // a pinned tab never leaves it
        must(model.run("tab.move", { tab: "P1", to: "ts0", index: 4 }));
        expect(model.tabs().map((t) => t.id)).toEqual(["P2", "P1", "B", "A"]);
    });

    it("pin moves", () => {
        const { model, text } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        children: [
                            tab("P", { pinned: true }),
                            tab("A"),
                            tab("B"),
                            tab("C"),
                        ],
                    },
                ],
            },
        });
        must(model.run("tab.select", { tab: "B" }));
        must(model.run("tab.pin", { tab: "C", value: true }));
        expect(text()).toBe("/ts0/t0[P],/ts0/t1[C],/ts0/t2[A],/ts0/t3[B]*");
        expect(model.get("C")).toMatchObject({ pinned: true });
    });

    it("unpin moves", () => {
        const { model, text } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        children: [
                            tab("P1", { pinned: true }),
                            tab("P2", { pinned: true }),
                            tab("A"),
                        ],
                    },
                ],
            },
        });
        must(model.run("tab.pin", { tab: "P1", value: false }));
        expect(text()).toBe("/ts0/t0[P2],/ts0/t1[P1]*,/ts0/t2[A]");
        expect(model.get("P1")).not.toHaveProperty("pinned");
    });

    it("cannot be closed, popped out or pinned in a border", () => {
        const { model } = setup({
            ...tabsets(["One", "Two"]),
            defaults: { tab: { enablePopout: true } },
            borders: [{ location: "left", children: [tab("B")] }],
        });
        must(model.run("tab.pin", { tab: "One", value: true }));
        expect(model.run("tab.close", { tab: "One" })).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/tab" },
        });
        expect(model.run("tab.popout", { tab: "One" }).ok).toBe(false);
        expect(model.run("tab.pin", { tab: "B", value: true })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("pinning an already pinned tab changes nothing", () => {
        const { model } = setup(tabsets(["One", "Two"]));
        must(model.run("tab.pin", { tab: "Two", value: true }));
        const before = model.state;
        must(model.run("tab.pin", { tab: "Two", value: true }));
        expect(model.state).toBe(before);
    });
});
