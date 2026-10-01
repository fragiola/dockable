import { describe, expect, it } from "vitest";
import { createModel, type LayoutJson, MAIN_LAYOUT } from "../../src";
import { MODEL_GET_KEYS, MODEL_IS_KEYS } from "../../src/state/queries";
import { must } from "./harness";

// root: ts0 (a, b; b selected) | r1 (ts1 (c, pinned) above ts2 (empty)); a left border (d, open);
// a window w0 holding ts3 (e)
const json: LayoutJson = {
    version: 1,
    defaults: { border: { mode: "overlay" }, tab: { enableClose: false } },
    root: {
        type: "row",
        id: "root",
        children: [
            {
                type: "tabset",
                id: "ts0",
                selected: 1,
                children: [
                    { id: "a", component: "x" },
                    { id: "b", component: "x", enableClose: true },
                ],
            },
            {
                type: "row",
                id: "r1",
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [{ id: "c", component: "x", pinned: true }],
                    },
                    {
                        type: "tabset",
                        id: "ts2",
                        enableClose: false,
                        children: [],
                    },
                ],
            },
        ],
    },
    borders: [
        {
            id: "left",
            location: "left",
            selected: 0,
            size: 220,
            children: [{ id: "d", component: "x" }],
        },
    ],
    windows: [
        {
            id: "w0",
            rect: { x: 0, y: 0, width: 400, height: 300 },
            root: {
                type: "row",
                id: "wroot",
                children: [
                    {
                        type: "tabset",
                        id: "ts3",
                        children: [{ id: "e", component: "x" }],
                    },
                ],
            },
        },
    ],
    active: "ts1",
};

const model = () => createModel(structuredClone(json));
const ids = (nodes: readonly { id: string }[]) => nodes.map((n) => n.id);

describe("model.get", () => {
    it("node: a node by id, undefined when unknown", () => {
        const m = model();
        expect(m.get("node", { node: "a" })).toMatchObject({
            type: "tab",
            id: "a",
        });
        expect(m.get("node", { node: "nope" })).toBeUndefined();
    });

    it("parent: a tab's tabset or border, a tabset's row; none for a root", () => {
        const m = model();
        expect(m.get("parent", { node: "a" })?.id).toBe("ts0");
        expect(m.get("parent", { node: "d" })?.id).toBe("left");
        expect(m.get("parent", { node: "ts1" })?.id).toBe("r1");
        expect(m.get("parent", { node: "root" })).toBeUndefined();
        expect(m.get("parent", { node: "nope" })).toBeUndefined();
    });

    it("layout-id: main for the main layout and its borders, the window's id in a window", () => {
        const m = model();
        expect(m.get("layout-id", { node: "a" })).toBe(MAIN_LAYOUT);
        expect(m.get("layout-id", { node: "d" })).toBe(MAIN_LAYOUT);
        expect(m.get("layout-id", { node: "e" })).toBe("w0");
        expect(m.get("layout-id", { node: "nope" })).toBeUndefined();
    });

    it("root-row: the main layout's by default, a window's by id", () => {
        const m = model();
        expect(m.get("root-row")?.id).toBe("root");
        expect(m.get("root-row", { layout: "w0" })?.id).toBe("wroot");
        expect(m.get("root-row", { layout: "nope" })).toBeUndefined();
    });

    it("window: a popout window's layout", () => {
        const m = model();
        expect(m.get("window", { window: "w0" })?.root.id).toBe("wroot");
        expect(m.get("window", { window: "nope" })).toBeUndefined();
    });

    it("tabs: every tab without a layout, a layout's (main with its borders) with one", () => {
        const m = model();
        expect(ids(m.get("tabs"))).toEqual(["a", "b", "c", "d", "e"]);
        expect(ids(m.get("tabs", { layout: MAIN_LAYOUT }))).toEqual([
            "a",
            "b",
            "c",
            "d",
        ]);
        expect(ids(m.get("tabs", { layout: "w0" }))).toEqual(["e"]);
    });

    it("tabsets: a layout's, in tree order (main by default)", () => {
        const m = model();
        expect(ids(m.get("tabsets"))).toEqual(["ts0", "ts1", "ts2"]);
        expect(ids(m.get("tabsets", { layout: "w0" }))).toEqual(["ts3"]);
        expect(m.get("tabsets", { layout: "nope" })).toEqual([]);
    });

    it("selected-tab: a tabset's or a border's, undefined when none or not a container", () => {
        const m = model();
        expect(m.get("selected-tab", { container: "ts0" })?.id).toBe("b");
        expect(m.get("selected-tab", { container: "left" })?.id).toBe("d");
        expect(m.get("selected-tab", { container: "ts2" })).toBeUndefined();
        expect(m.get("selected-tab", { container: "a" })).toBeUndefined();
    });

    it("active-tabset and maximized-tabset: a layout's (main by default)", () => {
        const m = model();
        expect(m.get("active-tabset")?.id).toBe("ts1");
        expect(m.get("maximized-tabset")).toBeUndefined();
        must(m.run("tabset.maximize", { tabsetId: "ts0", value: true }));
        expect(m.get("maximized-tabset")?.id).toBe("ts0");
        must(m.run("tabset.activate", { tabsetId: "ts3" }));
        expect(m.get("active-tabset", { layout: "w0" })?.id).toBe("ts3");
        expect(m.get("maximized-tabset", { layout: "w0" })).toBeUndefined();
    });

    it("tab-, tabset- and border-settings: the node's own value, else the default", () => {
        const m = model();
        expect(m.get("tab-settings", { tab: "a" })?.enableClose).toBe(false);
        expect(m.get("tab-settings", { tab: "b" })?.enableClose).toBe(true);
        expect(m.get("tabset-settings", { tabset: "ts2" })?.enableClose).toBe(
            false,
        );
        expect(m.get("border-settings", { border: "left" })).toMatchObject({
            mode: "overlay",
            size: 220,
        });
        // a node of another kind has no such settings
        expect(m.get("tab-settings", { tab: "ts0" })).toBeUndefined();
        expect(m.get("tabset-settings", { tabset: "a" })).toBeUndefined();
        expect(m.get("border-settings", { border: "nope" })).toBeUndefined();
    });

    it("layout-settings: the layout-wide settings, resolved", () => {
        expect(model().get("layout-settings")).toMatchObject({
            rootOrientation: "horizontal",
            edgeDock: expect.any(Boolean),
        });
    });

    it("layout-json: a writable copy that loads back to the same layout", () => {
        const m = model();
        const copy = m.get("layout-json");
        expect(Object.isFrozen(copy)).toBe(false);
        expect(createModel(copy).get("layout-json")).toEqual(copy);
        expect(copy.windows?.[0]?.id).toBe("w0");
    });

    it("commands: every command, the same frozen list each time", () => {
        const m = model();
        const list = m.get("commands");
        expect(list.map((c) => c.name)).toContain("tab.close");
        expect(Object.isFrozen(list)).toBe(true);
        expect(m.get("commands")).toBe(list);
    });

    it("reads the state committed last", () => {
        const m = model();
        must(m.run("tab.select", { tabId: "a" }));
        expect(m.get("selected-tab", { container: "ts0" })?.id).toBe("a");
        must(m.run("tab.close", { tabId: "b" }));
        expect(m.get("node", { node: "b" })).toBeUndefined();
    });
});

describe("model.is", () => {
    it("selected and pinned: a tab's", () => {
        const m = model();
        expect(m.is("selected", { tab: "b" })).toBe(true);
        expect(m.is("selected", { tab: "a" })).toBe(false);
        expect(m.is("selected", { tab: "d" })).toBe(true);
        expect(m.is("selected", { tab: "ts0" })).toBe(false);
        expect(m.is("pinned", { tab: "c" })).toBe(true);
        expect(m.is("pinned", { tab: "a" })).toBe(false);
    });

    it("active and maximized: a tabset's, in its own layout", () => {
        const m = model();
        expect(m.is("active", { tabset: "ts1" })).toBe(true);
        expect(m.is("active", { tabset: "ts0" })).toBe(false);
        expect(m.is("maximized", { tabset: "ts0" })).toBe(false);
        must(m.run("tabset.maximize", { tabsetId: "ts0", value: true }));
        expect(m.is("maximized", { tabset: "ts0" })).toBe(true);
        must(m.run("tabset.activate", { tabsetId: "ts3" }));
        expect(m.is("active", { tabset: "ts3" })).toBe(true);
    });

    it("hidden-by-maximize: every tabset and row off the maximized tabset's path", () => {
        const m = model();
        must(m.run("tabset.maximize", { tabsetId: "ts1", value: true }));
        expect(m.is("hidden-by-maximize", { node: "ts0" })).toBe(true);
        expect(m.is("hidden-by-maximize", { node: "ts2" })).toBe(true);
        expect(m.is("hidden-by-maximize", { node: "r1" })).toBe(false);
        expect(m.is("hidden-by-maximize", { node: "ts1" })).toBe(false);
        // another layout's nodes are not
        expect(m.is("hidden-by-maximize", { node: "ts3" })).toBe(false);
    });

    it("empty: a tabset or a border without tabs", () => {
        const m = model();
        expect(m.is("empty", { container: "ts2" })).toBe(true);
        expect(m.is("empty", { container: "ts0" })).toBe(false);
        expect(m.is("empty", { container: "left" })).toBe(false);
        expect(m.is("empty", { container: "a" })).toBe(false);
    });

    it("open and overlay: a border's", () => {
        const m = model();
        expect(m.is("open", { border: "left" })).toBe(true);
        expect(m.is("overlay", { border: "left" })).toBe(true);
        must(
            m.run("border.configure", {
                borderId: "left",
                open: false,
                mode: "docked",
            }),
        );
        expect(m.is("open", { border: "left" })).toBe(false);
        expect(m.is("overlay", { border: "left" })).toBe(false);
    });

    it("root: a layout's root row", () => {
        const m = model();
        expect(m.is("root", { row: "root" })).toBe(true);
        expect(m.is("root", { row: "wroot" })).toBe(true);
        expect(m.is("root", { row: "r1" })).toBe(false);
    });

    it("in-window: a node in a popout window's layout", () => {
        const m = model();
        expect(m.is("in-window", { node: "e" })).toBe(true);
        expect(m.is("in-window", { node: "ts3" })).toBe(true);
        expect(m.is("in-window", { node: "a" })).toBe(false);
        expect(m.is("in-window", { node: "d" })).toBe(false);
        expect(m.is("in-window", { node: "nope" })).toBe(false);
    });

    it("is false for an unknown node", () => {
        const m = model();
        for (const key of MODEL_IS_KEYS) {
            expect(
                m.is(key, {
                    tab: "nope",
                    tabset: "nope",
                    node: "nope",
                    container: "nope",
                    border: "nope",
                    row: "nope",
                } as never),
            ).toBe(false);
        }
    });
});

describe("the key lists", () => {
    it("list every key once", () => {
        expect(new Set(MODEL_GET_KEYS).size).toBe(MODEL_GET_KEYS.length);
        expect(MODEL_GET_KEYS).toContain("selected-tab");
        expect(MODEL_IS_KEYS).toContain("hidden-by-maximize");
    });

    it("are kebab-case and never a command name (a command has a dot)", () => {
        for (const key of [...MODEL_GET_KEYS, ...MODEL_IS_KEYS]) {
            expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
        }
    });
});
