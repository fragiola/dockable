// The behaviour of each command of the catalogue (design record §5).
import { describe, expect, it } from "vitest";
import type { Model } from "../../src/state/model";
import { createModel } from "../../src/state/model";
import { must, setup, tab, tabsets } from "./harness";

function firstBorder(model: Model) {
    const border = model.state.borders[0];
    if (!border) {
        throw new Error("no border");
    }
    return border;
}

describe("tab commands", () => {
    it("tab.add adds, returns the id, and refuses a taken id", () => {
        const { model, text } = setup(tabsets(["One"]));
        expect(
            model.run("tab.add", {
                id: "n",
                component: "x",
                data: { name: "New" },
                to: "ts0",
            }),
        ).toEqual({
            ok: true,
            value: { tab: "n" },
        });
        expect(text()).toBe("/ts0/t0[One],/ts0/t1[New]*");
        expect(
            model.run("tab.add", { id: "n", component: "x", to: "ts0" }),
        ).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'the id "n" is already in use',
                path: "/id",
            },
        });
        expect(
            model.run("tab.add", { component: "x", to: "nowhere" }),
        ).toMatchObject({
            ok: false,
            error: { code: "not_found", path: "/to" },
        });
    });

    it("tab.add places a tab in a border", () => {
        const { model, text } = setup({
            ...tabsets(["One"]),
            borders: [{ location: "bottom", children: [] }],
        });
        must(
            model.run("tab.add", {
                component: "x",
                data: { name: "Log" },
                to: "border_bottom",
                select: true,
            }),
        );
        expect(text()).toBe("/b/bottom/t0[Log]*,/ts0/t0[One]*");
    });

    it("tab.add and tab.update validate data with the registered schema", () => {
        const model = createModel(tabsets(["One"]), {
            dataSchemas: {
                editor: {
                    type: "object",
                    properties: { path: { type: "string" } },
                    required: ["path"],
                    additionalProperties: false,
                },
            },
        });
        expect(
            model.run("tab.add", {
                component: "editor",
                data: { path: 1 },
                to: "ts0",
            }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                path: "/data/path",
                message: "must be a string",
            },
        });
        const { tab: id } = must(
            model.run("tab.add", {
                component: "editor",
                data: { path: "/a" },
                to: "ts0",
            }),
        );
        expect(
            model.run("tab.update", { tab: id, component: "editor", data: {} }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                path: "/data/path",
                message: "is required",
            },
        });
        must(
            model.run("tab.update", {
                tab: id,
                component: "editor",
                data: { path: "/b" },
            }),
        );
        expect(model.get(id)).toMatchObject({
            component: "editor",
            data: { path: "/b" },
        });
    });

    it("tab.update replaces the data and can switch the component", () => {
        const { model } = setup(tabsets(["One"]));
        must(
            model.run("tab.update", {
                tab: "One",
                component: "other",
                data: { name: "Uno" },
            }),
        );
        expect(model.get("One")).toEqual({
            type: "tab",
            id: "One",
            component: "other",
            data: { name: "Uno" },
        });
        must(model.run("tab.update", { tab: "One", component: "other" }));
        expect(model.get("One")).not.toHaveProperty("data");
    });

    it("tab.close refuses a tab that cannot close (FlexLayout's DELETE_TAB did not)", () => {
        const { model } = setup(tabsets(["One", "Two"]));
        must(model.run("tab.configure", { tab: "One", enableClose: false }));
        expect(model.run("tab.close", { tab: "One" })).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'tab "One" cannot be closed',
                path: "/tab",
            },
        });
        must(
            model.run("layout.configure", {
                defaults: { tab: { enableClose: false } },
            }),
        );
        expect(model.run("tab.close", { tab: "Two" }).ok).toBe(false);
    });

    it("tab.configure sets and clears fields", () => {
        const { model } = setup(tabsets(["One"]));
        must(
            model.run("tab.configure", {
                tab: "One",
                enableDrag: false,
                minWidth: 40,
            }),
        );
        expect(model.get("One")).toMatchObject({
            enableDrag: false,
            minWidth: 40,
        });
        must(model.run("tab.configure", { tab: "One", enableDrag: null }));
        expect(model.get("One")).not.toHaveProperty("enableDrag");
        expect(model.get("One")).toMatchObject({ minWidth: 40 });
    });

    it("tab.popout opens a window with the tab, and refuses what cannot", () => {
        const { model, text } = setup(tabsets(["One", "Two"]));
        expect(model.run("tab.popout", { tab: "One" })).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/tab" },
        });
        must(
            model.run("layout.configure", {
                defaults: { tab: { enablePopout: true } },
            }),
        );
        const rect = { x: 10, y: 20, width: 300, height: 200 };
        const { window } = must(model.run("tab.popout", { tab: "Two", rect }));
        expect(model.windowLayout(window)).toMatchObject({ rect });
        expect(model.layoutOf("Two")).toBe(window);
        expect(text()).toBe("/ts0/t0[One]*,/w0/ts0/t0[Two]*");
        expect(model.activeTabset(window)?.children[0]?.id).toBe("Two");
        expect(model.run("tab.popout", { tab: "Two" })).toMatchObject({
            ok: false,
            error: {
                code: "refused",
                message: 'tab "Two" is already in a window',
            },
        });
    });
});

describe("tabset commands", () => {
    it("tabset.activate", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tabset.activate", { tabset: "ts1" }));
        expect(model.activeTabset()?.id).toBe("ts1");
        expect(model.run("tabset.activate", { tabset: "One" })).toMatchObject({
            ok: false,
            error: { code: "not_found", path: "/tabset" },
        });
    });

    it("tabset.maximize is idempotent and enforces enableMaximize (FlexLayout's toggle did not)", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tabset.maximize", { tabset: "ts1", value: true }));
        must(model.run("tabset.maximize", { tabset: "ts1", value: true }));
        expect(model.maximizedTabset()?.id).toBe("ts1");
        expect(model.activeTabset()?.id).toBe("ts1");
        must(model.run("tabset.maximize", { tabset: "ts1", value: false }));
        expect(model.maximizedTabset()).toBeUndefined();
        must(
            model.run("tabset.configure", {
                tabset: "ts0",
                enableMaximize: false,
            }),
        );
        expect(
            model.run("tabset.maximize", { tabset: "ts0", value: true }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("tabset.maximize refuses the only tabset of its layout", () => {
        const { model } = setup(tabsets(["One"]));
        expect(
            model.run("tabset.maximize", { tabset: "ts0", value: true }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "refused",
                message: 'tabset "ts0" is the only tabset of its layout',
            },
        });
    });

    it("tabset.close closes its closable tabs and removes it once empty", () => {
        const { model, text } = setup({
            version: 1,
            root: {
                type: "row",
                id: "root",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        children: [
                            tab("A"),
                            tab("P", { pinned: true }),
                            tab("B"),
                        ],
                    },
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [tab("C"), tab("D")],
                    },
                ],
            },
        });
        expect(must(model.run("tabset.close", { tabset: "ts0" }))).toEqual({
            closed: ["A", "B"],
        });
        expect(text()).toBe("/ts0/t0[P]*,/ts1/t0[C]*,/ts1/t1[D]");
        must(model.run("tabset.close", { tabset: "ts1" }));
        expect(model.get("ts1")).toBeUndefined();
        must(
            model.run("tabset.configure", {
                tabset: "ts0",
                enableClose: false,
            }),
        );
        expect(model.run("tabset.close", { tabset: "ts0" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("tabset.popout moves a whole tabset into a window", () => {
        const { model, text } = setup({
            ...tabsets(["One"], ["Two", "Three"]),
            defaults: { tab: { enablePopout: true } },
        });
        const { window } = must(model.run("tabset.popout", { tabset: "ts1" }));
        expect(text()).toBe("/ts0/t0[One]*,/w0/ts0/t0[Two]*,/w0/ts0/t1[Three]");
        expect(model.layoutOf("ts1")).toBe(window);
        expect(model.activeTabset(window)?.id).toBe("ts1");
    });

    it("tabset.configure sets flags and data", () => {
        const { model } = setup(tabsets(["One"]));
        must(
            model.run("tabset.configure", {
                tabset: "ts0",
                data: { name: "Editors" },
                minHeight: 50,
            }),
        );
        expect(model.get("ts0")).toMatchObject({
            data: { name: "Editors" },
            minHeight: 50,
        });
        must(model.run("tabset.configure", { tabset: "ts0", data: null }));
        expect(model.get("ts0")).not.toHaveProperty("data");
    });
});

describe("row commands", () => {
    it("row.resize sets one weight per child", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("row.resize", { row: "root", weights: [30, 70] }));
        expect(model.state.root.children.map((c) => c.weight)).toEqual([
            30, 70,
        ]);
        expect(model.run("row.resize", { row: "root", weights: [30] })).toEqual(
            {
                ok: false,
                error: {
                    code: "invalid_payload",
                    message: 'row "root" has 2 children, not 1',
                    path: "/weights",
                },
            },
        );
        expect(
            model.run("row.resize", { row: "root", weights: [0, 1] }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/weights/0" },
        });
    });

    it("row.configure sets and removes data", () => {
        const { model } = setup(tabsets(["One"]));
        must(model.run("row.configure", { row: "root", data: { tone: 1 } }));
        expect(model.state.root.data).toEqual({ tone: 1 });
        must(model.run("row.configure", { row: "root", data: null }));
        expect(model.state.root).not.toHaveProperty("data");
    });
});

describe("border commands", () => {
    const withBorder = () =>
        setup({
            ...tabsets(["Main"]),
            borders: [
                {
                    location: "left",
                    size: 150,
                    minSize: 100,
                    maxSize: 300,
                    children: [tab("A"), tab("B", { borderWidth: 250 })],
                },
            ],
        });

    it("border.resize sets the border's size, clamped", () => {
        const { model } = withBorder();
        expect(
            must(
                model.run("border.resize", {
                    border: "border_left",
                    size: 500,
                }),
            ),
        ).toEqual({
            border: "border_left",
            size: 300,
        });
        expect(model.get("border_left")).toMatchObject({ size: 300 });
        expect(model.resolve(firstBorder(model)).size).toBe(300);
    });

    it("border.resize sets the selected tab's own size when it has one", () => {
        const { model } = withBorder();
        must(model.run("tab.select", { tab: "B" }));
        expect(model.resolve(firstBorder(model)).size).toBe(250);
        must(model.run("border.resize", { border: "border_left", size: 120 }));
        expect(model.get("B")).toMatchObject({ borderWidth: 120 });
        expect(model.get("border_left")).toMatchObject({ size: 150 });
    });

    it("border.configure opens, closes and switches the mode", () => {
        const { model } = withBorder();
        must(
            model.run("border.configure", {
                border: "border_left",
                open: true,
                mode: "overlay",
            }),
        );
        expect(model.get("border_left")).toMatchObject({
            selected: 0,
            mode: "overlay",
        });
        must(
            model.run("border.configure", {
                border: "border_left",
                open: false,
                mode: null,
            }),
        );
        expect(model.get("border_left")).toMatchObject({ selected: -1 });
        expect(model.get("border_left")).not.toHaveProperty("mode");
        expect(model.resolve(firstBorder(model)).mode).toBe("docked");
    });

    it("border.configure refuses to open an empty border", () => {
        const { model } = setup({
            ...tabsets(["Main"]),
            borders: [{ location: "right", children: [] }],
        });
        expect(
            model.run("border.configure", {
                border: "border_right",
                open: true,
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/open" },
        });
    });
});

describe("window commands", () => {
    const withWindow = () => {
        const context = setup({
            ...tabsets(["One", "Two"], ["Three"]),
            defaults: { tab: { enablePopout: true } },
        });
        const { window } = must(
            context.model.run("tab.popout", { tab: "Two" }),
        );
        must(
            context.model.run("tab.add", {
                component: "x",
                data: { name: "Four" },
                to: window,
            }),
        );
        return { ...context, window };
    };

    it("window.close docks its tabs into the active tabset", () => {
        const { model, text, window } = withWindow();
        must(model.run("tabset.activate", { tabset: "ts1" }));
        expect(must(model.run("window.close", { window }))).toEqual({
            tabs: [
                "Two",
                model
                    .tabs()
                    .find(
                        (t) =>
                            t.data &&
                            (t.data as { name: string }).name === "Four",
                    )?.id,
            ],
        });
        expect(model.state.windows).toEqual([]);
        expect(text()).toBe(
            "/ts0/t0[One]*,/ts1/t0[Three],/ts1/t1[Two],/ts1/t2[Four]*",
        );
    });

    it("window.close falls back to the first tabset", () => {
        const { model, text, window } = withWindow();
        must(model.run("tab.close", { tab: "Three" }));
        expect(model.activeTabset()).toBeUndefined();
        must(model.run("window.close", { window }));
        expect(text()).toBe("/ts0/t0[One],/ts0/t1[Two],/ts0/t2[Four]*");
    });

    it("window.configure records the rect", () => {
        const { model, window } = withWindow();
        const rect = { x: 1, y: 2, width: 3, height: 4 };
        must(
            model.run(
                "window.configure",
                { window, rect },
                { transient: true },
            ),
        );
        expect(model.windowLayout(window)?.rect).toEqual(rect);
        expect(
            model.run("window.configure", { window: "main", rect }),
        ).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
    });
});

describe("layout commands", () => {
    it("layout.configure merges defaults, and null removes", () => {
        const { model } = setup(tabsets(["One"]));
        must(
            model.run("layout.configure", {
                defaults: {
                    tab: { enablePopout: true },
                    layout: { edgeDockMargin: 4 },
                },
            }),
        );
        must(
            model.run("layout.configure", {
                defaults: { tab: { enableDrag: false } },
            }),
        );
        expect(model.state.defaults).toEqual({
            tab: { enablePopout: true, enableDrag: false },
            layout: { edgeDockMargin: 4 },
        });
        expect(model.resolveLayout()).toEqual({
            rootOrientation: "horizontal",
            edgeDock: true,
            edgeDockMargin: 4,
            edgeDockLength: 100,
        });
        must(
            model.run("layout.configure", {
                defaults: { tab: { enablePopout: null }, layout: null },
            }),
        );
        expect(model.state.defaults).toEqual({ tab: { enableDrag: false } });
    });

    it("layout.configure changes the root orientation", () => {
        const { model, text } = setup(tabsets(["One", "Two"]));
        must(
            model.run("layout.configure", {
                defaults: { layout: { rootOrientation: "vertical" } },
            }),
        );
        // a vertical root: a bottom drop is along the row
        must(
            model.run("tab.move", {
                tab: "Two",
                to: "ts0",
                location: "bottom",
            }),
        );
        expect(text()).toBe("/ts0/t0[One]*,/ts1/t0[Two]*");
    });

    it("layout.load replaces the state and reports the ids added and removed", () => {
        const { model, text } = setup(tabsets(["One", "Two"]));
        const result = must(
            model.run("layout.load", {
                layout: {
                    version: 1,
                    root: {
                        type: "row",
                        id: "root",
                        children: [
                            {
                                type: "tabset",
                                id: "ts0",
                                children: [tab("Two"), tab("Three")],
                            },
                        ],
                    },
                },
            }),
        );
        expect(result).toEqual({ added: ["Three"], removed: ["One"] });
        expect(text()).toBe("/ts0/t0[Two]*,/ts0/t1[Three]");
    });

    it("layout.load reports every problem under /layout", () => {
        const { model } = setup(tabsets(["One"]));
        const before = model.state;
        const result = model.run("layout.load", {
            layout: {
                version: 1,
                root: {
                    type: "row",
                    children: [{ type: "tabset", weight: -2 }],
                },
            },
        } as never);
        expect(result).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                path: "/layout/root/children/0/weight",
            },
        });
        expect(model.state).toBe(before);
    });
});

describe("batch", () => {
    it("runs its commands in order as one step and returns their values", () => {
        const { model, text } = setup(tabsets(["One", "Two"]));
        const events: unknown[] = [];
        model.subscribe((event) => events.push(event.command));
        const result = must(
            model.run("batch", {
                commands: [
                    {
                        command: "tab.add",
                        payload: {
                            id: "n",
                            component: "x",
                            data: { name: "New" },
                            to: "ts0",
                        },
                    },
                    {
                        command: "batch",
                        payload: {
                            commands: [
                                {
                                    command: "tab.select",
                                    payload: { tab: "One" },
                                },
                            ],
                        },
                    },
                    { command: "tab.close", payload: { tab: "Two" } },
                ],
            }),
        );
        expect(result).toEqual({
            results: [{ tab: "n" }, { tab: "One" }, { tab: "Two" }],
        });
        expect(text()).toBe("/ts0/t0[One]*,/ts0/t1[New]");
        expect(events).toEqual(["batch"]);
    });
});
