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
                label: "New",
                data: { name: "New" },
                to: "ts0",
            }),
        ).toEqual({
            ok: true,
            value: { tabId: "n" },
        });
        expect(text()).toBe("/ts0/t0[One],/ts0/t1[New]*");
        expect(
            model.run("tab.add", {
                id: "n",
                component: "x",
                label: "x",
                to: "ts0",
            }),
        ).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'the id "n" is already in use',
                path: "/id",
            },
        });
        expect(
            model.run("tab.add", { component: "x", label: "x", to: "nowhere" }),
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
                label: "Log",
                data: { name: "Log" },
                to: "border_bottom",
                select: true,
            }),
        );
        expect(text()).toBe("/b/bottom/t0[Log]*,/ts0/t0[One]*");
    });

    it("tab.add requires a string label", () => {
        const { model } = setup(tabsets(["One"]));
        expect(
            model.dispatch({
                command: "tab.add",
                payload: { component: "x", to: "ts0" },
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/payload/label" },
        });
        expect(
            model.dispatch({
                command: "tab.add",
                payload: { component: "x", label: 1, to: "ts0" },
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/payload/label" },
        });
    });

    it("tab.add and tab.set-data validate data with the registered schema", () => {
        const model = createModel(tabsets(["One"]), {
            dataSchemas: {
                editor: {
                    type: "object",
                    properties: {
                        path: { type: "string" },
                        dirty: { type: "boolean" },
                    },
                    required: ["path"],
                    additionalProperties: false,
                },
            },
        });
        expect(
            model.run("tab.add", {
                component: "editor",
                label: "a.ts",
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
        const { tabId: id } = must(
            model.run("tab.add", {
                component: "editor",
                label: "a.ts",
                data: { path: "/a" },
                to: "ts0",
            }),
        );
        // a switch replaces the data whole: without `path` it is incomplete
        expect(
            model.run("tab.set-data", {
                tabId: id,
                component: "editor",
                data: {},
            }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                path: "/data/path",
                message: "is required",
            },
        });
        // a patch is validated once merged: the kept keys count
        must(model.run("tab.set-data", { tabId: id, data: { dirty: true } }));
        expect(
            model.run("tab.set-data", { tabId: id, data: { path: 2 } }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/data/path" },
        });
        expect(
            model.run("tab.set-data", { tabId: id, data: { extra: 1 } }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/data/extra" },
        });
        expect(model.get("node-by", { id })).toMatchObject({
            component: "editor",
            label: "a.ts",
            data: { path: "/a", dirty: true },
        });
    });

    it("tab.set-data merges a patch into the data, keeping the other keys", () => {
        const { model } = setup(tabsets(["One"]));
        must(
            model.run("tab.set-data", {
                tabId: "One",
                data: { seed: 3, kind: "area" },
            }),
        );
        must(model.run("tab.set-data", { tabId: "One", data: { seed: 4 } }));
        expect(model.get("node-by", { id: "One" })).toEqual({
            type: "tab",
            id: "One",
            component: "test",
            label: "One",
            data: { seed: 4, kind: "area" },
        });
        // an empty patch, or an undefined value, changes nothing
        must(model.run("tab.set-data", { tabId: "One", data: {} }));
        must(
            model.run("tab.set-data", {
                tabId: "One",
                data: { seed: undefined },
            }),
        );
        expect(model.get("node-by", { id: "One" })).toMatchObject({
            data: { seed: 4, kind: "area" },
        });
    });

    it("tab.set-data keeps a JSON `__proto__` key an own key, never a prototype", () => {
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
        const { tabId } = must(
            model.run("tab.add", {
                component: "editor",
                label: "a.ts",
                data: { path: "/a" },
                to: "ts0",
            }),
        );
        // untrusted input: the key is data, refused by the schema like any unknown key
        expect(
            model.dispatch(
                JSON.parse(
                    `{"command":"tab.set-data","payload":{"tabId":"${tabId}","data":{"__proto__":{"path":"/x"}}}}`,
                ),
            ),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/payload/data/__proto__" },
        });
        // without a schema it is kept as an own key: nothing is inherited
        must(
            model.dispatch(
                JSON.parse(
                    '{"command":"tab.set-data","payload":{"tabId":"One","data":{"__proto__":{"seed":1}}}}',
                ),
            ),
        );
        const node = model.get("node-by", { id: "One" });
        const data = node?.type === "tab" ? node.data : undefined;
        expect(Object.getPrototypeOf(data)).toBe(Object.prototype);
        expect(Object.keys(data ?? {})).toEqual(["__proto__"]);
    });

    it("tab.set-data with a component switches it and replaces the data", () => {
        const { model } = setup(tabsets(["One"]));
        must(
            model.run("tab.set-data", {
                tabId: "One",
                component: "other",
                data: { seed: 1 },
            }),
        );
        expect(model.get("node-by", { id: "One" })).toEqual({
            type: "tab",
            id: "One",
            component: "other",
            label: "One",
            data: { seed: 1 },
        });
        must(model.run("tab.set-data", { tabId: "One", component: "other" }));
        expect(model.get("node-by", { id: "One" })).not.toHaveProperty("data");
        // a tab without data takes a patch as its first keys
        must(model.run("tab.set-data", { tabId: "One", data: { seed: 2 } }));
        expect(model.get("node-by", { id: "One" })).toMatchObject({
            data: { seed: 2 },
        });
    });

    it("tab.set-data refuses a patch that is not an object, or onto data that is not one", () => {
        const { model } = setup(tabsets(["One"]));
        // untyped input: a patch that is not an object fails the payload schema
        for (const data of [[1], "x", null]) {
            expect(
                model.dispatch({
                    command: "tab.set-data",
                    payload: { tabId: "One", data },
                }),
            ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        }
        must(
            model.run("tab.set-data", {
                tabId: "One",
                component: "test",
                data: "plain",
            }),
        );
        expect(
            model.run("tab.set-data", { tabId: "One", data: { a: 1 } }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/data" },
        });
        expect(model.get("node-by", { id: "One" })).toMatchObject({
            data: "plain",
        });
        expect(
            model.run("tab.set-data", { tabId: "nope", data: {} }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
    });

    it("tab.close refuses a tab that cannot close (FlexLayout's DELETE_TAB did not)", () => {
        const { model } = setup(tabsets(["One", "Two"]));
        must(model.run("tab.configure", { tabId: "One", enableClose: false }));
        expect(model.run("tab.close", { tabId: "One" })).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'tab "One" cannot be closed',
                path: "/tabId",
            },
        });
        must(
            model.run("layout.configure", {
                defaults: { tab: { enableClose: false } },
            }),
        );
        expect(model.run("tab.close", { tabId: "Two" }).ok).toBe(false);
    });

    it("tab.configure sets and clears fields", () => {
        const { model } = setup(tabsets(["One"]));
        must(
            model.run("tab.configure", {
                tabId: "One",
                enableDrag: false,
                minWidth: 40,
            }),
        );
        expect(model.get("node-by", { id: "One" })).toMatchObject({
            enableDrag: false,
            minWidth: 40,
        });
        must(model.run("tab.configure", { tabId: "One", enableDrag: null }));
        expect(model.get("node-by", { id: "One" })).not.toHaveProperty(
            "enableDrag",
        );
        expect(model.get("node-by", { id: "One" })).toMatchObject({
            minWidth: 40,
        });
    });

    it("tab.configure renames a tab and leaves its data alone", () => {
        const { model, text } = setup(tabsets(["One"]));
        must(model.run("tab.set-data", { tabId: "One", data: { seed: 1 } }));
        must(model.run("tab.configure", { tabId: "One", label: "Uno" }));
        expect(model.get("node-by", { id: "One" })).toMatchObject({
            label: "Uno",
            data: { seed: 1 },
        });
        expect(text()).toBe("/ts0/t0[Uno]*");
        // any string is a label: refusing an empty one is the app's choice
        must(model.run("tab.configure", { tabId: "One", label: "" }));
        expect(model.get("node-by", { id: "One" })).toMatchObject({
            label: "",
        });
        // a tab always has a label: it cannot be removed
        expect(
            model.run("tab.configure", {
                tabId: "One",
                // @ts-expect-error the label is not nullable
                label: null,
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/label" },
        });
    });

    it("tab.popout opens a window with the tab, and refuses what cannot", () => {
        const { model, text } = setup(tabsets(["One", "Two"]));
        expect(model.run("tab.popout", { tabId: "One" })).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/tabId" },
        });
        must(
            model.run("layout.configure", {
                defaults: { tab: { enablePopout: true } },
            }),
        );
        const rect = { x: 10, y: 20, width: 300, height: 200 };
        const { windowId: window } = must(
            model.run("tab.popout", { tabId: "Two", rect }),
        );
        expect(model.get("window-by", { id: window })).toMatchObject({
            rect,
        });
        expect(model.get("layout-id-by", { nodeId: "Two" })).toBe(window);
        expect(text()).toBe("/ts0/t0[One]*,/w0/ts0/t0[Two]*");
        expect(
            model.get("active-tabset", { layoutId: window })?.children[0]?.id,
        ).toBe("Two");
        expect(model.run("tab.popout", { tabId: "Two" })).toMatchObject({
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
        must(model.run("tabset.activate", { tabsetId: "ts1" }));
        expect(model.get("active-tabset")?.id).toBe("ts1");
        expect(model.run("tabset.activate", { tabsetId: "One" })).toMatchObject(
            {
                ok: false,
                error: { code: "not_found", path: "/tabsetId" },
            },
        );
    });

    it("tabset.maximize is idempotent and enforces enableMaximize (FlexLayout's toggle did not)", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("tabset.maximize", { tabsetId: "ts1", value: true }));
        must(model.run("tabset.maximize", { tabsetId: "ts1", value: true }));
        expect(model.get("maximized-tabset")?.id).toBe("ts1");
        expect(model.get("active-tabset")?.id).toBe("ts1");
        must(model.run("tabset.maximize", { tabsetId: "ts1", value: false }));
        expect(model.get("maximized-tabset")).toBeUndefined();
        must(
            model.run("tabset.configure", {
                tabsetId: "ts0",
                enableMaximize: false,
            }),
        );
        expect(
            model.run("tabset.maximize", { tabsetId: "ts0", value: true }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("tabset.maximize refuses the only tabset of its layout", () => {
        const { model } = setup(tabsets(["One"]));
        expect(
            model.run("tabset.maximize", { tabsetId: "ts0", value: true }),
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
        expect(must(model.run("tabset.close", { tabsetId: "ts0" }))).toEqual({
            closedTabIds: ["A", "B"],
        });
        expect(text()).toBe("/ts0/t0[P]*,/ts1/t0[C]*,/ts1/t1[D]");
        must(model.run("tabset.close", { tabsetId: "ts1" }));
        expect(model.get("node-by", { id: "ts1" })).toBeUndefined();
        must(
            model.run("tabset.configure", {
                tabsetId: "ts0",
                enableClose: false,
            }),
        );
        expect(model.run("tabset.close", { tabsetId: "ts0" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("tabset.popout moves a whole tabset into a window", () => {
        const { model, text } = setup({
            ...tabsets(["One"], ["Two", "Three"]),
            defaults: { tab: { enablePopout: true } },
        });
        const { windowId: window } = must(
            model.run("tabset.popout", { tabsetId: "ts1" }),
        );
        expect(text()).toBe("/ts0/t0[One]*,/w0/ts0/t0[Two]*,/w0/ts0/t1[Three]");
        expect(model.get("layout-id-by", { nodeId: "ts1" })).toBe(window);
        expect(model.get("active-tabset", { layoutId: window })?.id).toBe(
            "ts1",
        );
    });

    it("tabset.configure sets flags and data", () => {
        const { model } = setup(tabsets(["One"]));
        must(
            model.run("tabset.configure", {
                tabsetId: "ts0",
                data: { name: "Editors" },
                minHeight: 50,
            }),
        );
        expect(model.get("node-by", { id: "ts0" })).toMatchObject({
            data: { name: "Editors" },
            minHeight: 50,
        });
        must(model.run("tabset.configure", { tabsetId: "ts0", data: null }));
        expect(model.get("node-by", { id: "ts0" })).not.toHaveProperty("data");
    });
});

describe("row commands", () => {
    it("row.resize sets one weight per child", () => {
        const { model } = setup(tabsets(["One"], ["Two"]));
        must(model.run("row.resize", { rowId: "root", weights: [30, 70] }));
        expect(model.state.root.children.map((c) => c.weight)).toEqual([
            30, 70,
        ]);
        expect(
            model.run("row.resize", { rowId: "root", weights: [30] }),
        ).toEqual({
            ok: false,
            error: {
                code: "invalid_payload",
                message: 'row "root" has 2 children, not 1',
                path: "/weights",
            },
        });
        expect(
            model.run("row.resize", { rowId: "root", weights: [0, 1] }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/weights/0" },
        });
    });

    it("row.configure sets and removes data", () => {
        const { model } = setup(tabsets(["One"]));
        must(model.run("row.configure", { rowId: "root", data: { tone: 1 } }));
        expect(model.state.root.data).toEqual({ tone: 1 });
        must(model.run("row.configure", { rowId: "root", data: null }));
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
                    borderId: "border_left",
                    size: 500,
                }),
            ),
        ).toEqual({
            borderId: "border_left",
            size: 300,
        });
        expect(model.get("node-by", { id: "border_left" })).toMatchObject({
            size: 300,
        });
        expect(
            model.get("border-settings-by", {
                borderId: firstBorder(model).id,
            })?.size,
        ).toBe(300);
    });

    it("border.resize sets the selected tab's own size when it has one", () => {
        const { model } = withBorder();
        must(model.run("tab.select", { tabId: "B" }));
        expect(
            model.get("border-settings-by", {
                borderId: firstBorder(model).id,
            })?.size,
        ).toBe(250);
        must(
            model.run("border.resize", { borderId: "border_left", size: 120 }),
        );
        expect(model.get("node-by", { id: "B" })).toMatchObject({
            borderWidth: 120,
        });
        expect(model.get("node-by", { id: "border_left" })).toMatchObject({
            size: 150,
        });
    });

    it("border.configure opens, closes and switches the mode", () => {
        const { model } = withBorder();
        must(
            model.run("border.configure", {
                borderId: "border_left",
                open: true,
                mode: "overlay",
            }),
        );
        expect(model.get("node-by", { id: "border_left" })).toMatchObject({
            selected: 0,
            mode: "overlay",
        });
        must(
            model.run("border.configure", {
                borderId: "border_left",
                open: false,
                mode: null,
            }),
        );
        expect(model.get("node-by", { id: "border_left" })).toMatchObject({
            selected: -1,
        });
        expect(model.get("node-by", { id: "border_left" })).not.toHaveProperty(
            "mode",
        );
        expect(
            model.get("border-settings-by", {
                borderId: firstBorder(model).id,
            })?.mode,
        ).toBe("docked");
    });

    it("border.configure refuses to open an empty border", () => {
        const { model } = setup({
            ...tabsets(["Main"]),
            borders: [{ location: "right", children: [] }],
        });
        expect(
            model.run("border.configure", {
                borderId: "border_right",
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
        const { windowId: window } = must(
            context.model.run("tab.popout", { tabId: "Two" }),
        );
        must(
            context.model.run("tab.add", {
                component: "x",
                label: "Four",
                data: { name: "Four" },
                to: window,
            }),
        );
        return { ...context, window };
    };

    it("window.close docks its tabs into the active tabset", () => {
        const { model, text, window } = withWindow();
        must(model.run("tabset.activate", { tabsetId: "ts1" }));
        expect(must(model.run("window.close", { windowId: window }))).toEqual({
            tabIds: [
                "Two",
                model
                    .get("all-tabs")
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
        must(model.run("tab.close", { tabId: "Three" }));
        expect(model.get("active-tabset")).toBeUndefined();
        must(model.run("window.close", { windowId: window }));
        expect(text()).toBe("/ts0/t0[One],/ts0/t1[Two],/ts0/t2[Four]*");
    });

    it("window.configure records the rect", () => {
        const { model, window } = withWindow();
        const rect = { x: 1, y: 2, width: 3, height: 4 };
        must(
            model.run(
                "window.configure",
                { windowId: window, rect },
                { transient: true },
            ),
        );
        expect(model.get("window-by", { id: window })?.rect).toEqual(rect);
        expect(
            model.run("window.configure", { windowId: "main", rect }),
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
        expect(model.get("layout-settings")).toEqual({
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
                tabId: "Two",
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
        expect(result).toEqual({
            addedNodeIds: ["Three"],
            removedNodeIds: ["One"],
        });
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
                            label: "New",
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
                                    payload: { tabId: "One" },
                                },
                            ],
                        },
                    },
                    { command: "tab.close", payload: { tabId: "Two" } },
                ],
            }),
        );
        expect(result).toEqual({
            results: [{ tabId: "n" }, { tabId: "One" }, { tabId: "Two" }],
        });
        expect(text()).toBe("/ts0/t0[One]*,/ts0/t1[New]");
        expect(events).toEqual(["batch"]);
    });
});
