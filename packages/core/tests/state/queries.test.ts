import { describe, expect, it } from "vitest";
import { createModel, type LayoutJson, MAIN_LAYOUT } from "../../src";
import {
    MODEL_GET_KEYS,
    MODEL_IS_KEYS,
    type ModelGetKey,
    type ModelGetMap,
    type ModelIsMap,
    type NoPayload,
} from "../../src/state/queries";
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
                    { id: "a", component: "x", label: "x" },
                    { id: "b", component: "x", label: "x", enableClose: true },
                ],
            },
            {
                type: "row",
                id: "r1",
                children: [
                    {
                        type: "tabset",
                        id: "ts1",
                        children: [
                            {
                                id: "c",
                                component: "x",
                                label: "x",
                                pinned: true,
                            },
                        ],
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
            children: [{ id: "d", component: "x", label: "x" }],
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
                        children: [{ id: "e", component: "x", label: "x" }],
                    },
                ],
            },
        },
    ],
    active: "ts1",
};

const model = () => createModel(structuredClone(json));
const ids = (nodes: readonly { id: string }[]) => nodes.map((n) => n.id);

/** Every field a payload (or any member of a payload union) can carry. */
type FieldOf<P> = P extends unknown ? keyof P : never;

describe("model.get", () => {
    it("node-by { id }: a node by its id, undefined when unknown", () => {
        const m = model();
        expect(m.get("node-by", { id: "a" })).toMatchObject({
            type: "tab",
            id: "a",
        });
        expect(m.get("node-by", { id: "nope" })).toBeUndefined();
    });

    it("node-parent-by { nodeId }: a tab's tabset or border, a tabset's row; none for a root", () => {
        const m = model();
        expect(m.get("node-parent-by", { nodeId: "a" })?.id).toBe("ts0");
        expect(m.get("node-parent-by", { nodeId: "d" })?.id).toBe("left");
        expect(m.get("node-parent-by", { nodeId: "ts1" })?.id).toBe("r1");
        expect(m.get("node-parent-by", { nodeId: "root" })).toBeUndefined();
        expect(m.get("node-parent-by", { nodeId: "nope" })).toBeUndefined();
    });

    it("layout-id-by { nodeId }: main for the main layout and its borders, the window's id in a window", () => {
        const m = model();
        expect(m.get("layout-id-by", { nodeId: "a" })).toBe(MAIN_LAYOUT);
        expect(m.get("layout-id-by", { nodeId: "d" })).toBe(MAIN_LAYOUT);
        expect(m.get("layout-id-by", { nodeId: "e" })).toBe("w0");
        expect(m.get("layout-id-by", { nodeId: "nope" })).toBeUndefined();
    });

    it("root-row: the main layout's by default, a window's by id", () => {
        const m = model();
        expect(m.get("root-row")?.id).toBe("root");
        expect(m.get("root-row", { layoutId: "w0" })?.id).toBe("wroot");
        expect(m.get("root-row", { layoutId: "nope" })).toBeUndefined();
    });

    it("window-by { id }: a popout window's layout", () => {
        const m = model();
        expect(m.get("window-by", { id: "w0" })?.root.id).toBe("wroot");
        expect(m.get("window-by", { id: "nope" })).toBeUndefined();
    });

    it("windows and borders: the model's, in order", () => {
        const m = model();
        expect(ids(m.get("windows"))).toEqual(["w0"]);
        expect(m.get("windows")).toBe(m.state.windows);
        expect(ids(m.get("borders"))).toEqual(["left"]);
        expect(m.get("borders")).toBe(m.state.borders);
    });

    it("all-tabs: every tab of the model, its borders' and its windows' included", () => {
        expect(ids(model().get("all-tabs"))).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("tabs: a layout's tabs (main with its borders, and by default)", () => {
        const m = model();
        expect(ids(m.get("tabs"))).toEqual(["a", "b", "c", "d"]);
        expect(ids(m.get("tabs", { layoutId: MAIN_LAYOUT }))).toEqual([
            "a",
            "b",
            "c",
            "d",
        ]);
        expect(ids(m.get("tabs", { layoutId: "w0" }))).toEqual(["e"]);
    });

    it("tabsets: a layout's, in tree order (main by default)", () => {
        const m = model();
        expect(ids(m.get("tabsets"))).toEqual(["ts0", "ts1", "ts2"]);
        expect(ids(m.get("tabsets", { layoutId: "w0" }))).toEqual(["ts3"]);
        expect(m.get("tabsets", { layoutId: "nope" })).toEqual([]);
    });

    it("selected-tab-by { tabsetId }: a tabset's, undefined when none or not a tabset", () => {
        const m = model();
        expect(m.get("selected-tab-by", { tabsetId: "ts0" })?.id).toBe("b");
        expect(m.get("selected-tab-by", { tabsetId: "ts2" })).toBeUndefined();
        expect(m.get("selected-tab-by", { tabsetId: "a" })).toBeUndefined();
        // a border is not a tabset
        expect(m.get("selected-tab-by", { tabsetId: "left" })).toBeUndefined();
    });

    it("selected-tab-by { borderId }: a border's, undefined when closed or not a border", () => {
        const m = model();
        expect(m.get("selected-tab-by", { borderId: "left" })?.id).toBe("d");
        expect(m.get("selected-tab-by", { borderId: "ts0" })).toBeUndefined();
        must(m.run("border.configure", { borderId: "left", open: false }));
        expect(m.get("selected-tab-by", { borderId: "left" })).toBeUndefined();
    });

    it("selected-tab-by { layoutId }: the selected tab of a layout's active tabset", () => {
        const m = model();
        const main = { layoutId: MAIN_LAYOUT };
        expect(m.get("selected-tab-by", main)?.id).toBe("c");
        must(m.run("tabset.activate", { tabsetId: "ts0" }));
        expect(m.get("selected-tab-by", main)?.id).toBe("b");
        // the window has no active tabset until one is activated
        expect(m.get("selected-tab-by", { layoutId: "w0" })).toBeUndefined();
        must(m.run("tabset.activate", { tabsetId: "ts3" }));
        expect(m.get("selected-tab-by", { layoutId: "w0" })?.id).toBe("e");
        // an active tabset with no tabs has no selected tab
        must(m.run("tabset.activate", { tabsetId: "ts2" }));
        expect(m.get("selected-tab-by", main)).toBeUndefined();
        expect(m.get("selected-tab-by", { layoutId: "nope" })).toBeUndefined();
    });

    it("selected-tab-by: exactly one of tabsetId, borderId and layoutId, else none", () => {
        const m = model();
        const read = (payload: object) =>
            m.get("selected-tab-by", payload as never);
        expect(read({})).toBeUndefined();
        expect(read({ tabsetId: "ts0", borderId: "left" })).toBeUndefined();
        expect(
            read({ tabsetId: "ts0", layoutId: MAIN_LAYOUT }),
        ).toBeUndefined();
        expect(
            read({ borderId: "left", layoutId: MAIN_LAYOUT }),
        ).toBeUndefined();
        // an untyped call with no payload reads nothing either
        expect(
            (m.get as (key: string) => unknown)("selected-tab-by"),
        ).toBeUndefined();
    });

    it("active-tabset and maximized-tabset: a layout's (main by default)", () => {
        const m = model();
        expect(m.get("active-tabset")?.id).toBe("ts1");
        expect(m.get("maximized-tabset")).toBeUndefined();
        must(m.run("tabset.maximize", { tabsetId: "ts0", value: true }));
        expect(m.get("maximized-tabset")?.id).toBe("ts0");
        must(m.run("tabset.activate", { tabsetId: "ts3" }));
        expect(m.get("active-tabset", { layoutId: "w0" })?.id).toBe("ts3");
        expect(m.get("maximized-tabset", { layoutId: "w0" })).toBeUndefined();
    });

    it("default-tabset: a layout's active tabset, else its first (main by default)", () => {
        const m = model();
        expect(m.get("default-tabset")?.id).toBe("ts1");
        expect(m.get("default-tabset", { layoutId: MAIN_LAYOUT })?.id).toBe(
            "ts1",
        );
        // the window has no active tabset: its first
        expect(m.get("default-tabset", { layoutId: "w0" })?.id).toBe("ts3");
        expect(m.get("default-tabset", { layoutId: "nope" })).toBeUndefined();
    });

    it("default-tabset: another layout's active tabset is never the main one's", () => {
        const { active: _, windows = [], ...rest } = structuredClone(json);
        const m = createModel({
            ...rest,
            windows: windows.map((w) => ({ ...w, active: "ts3" })),
        });
        expect(m.get("active-tabset")).toBeUndefined();
        expect(m.get("active-tabset", { layoutId: "w0" })?.id).toBe("ts3");
        expect(m.get("default-tabset")?.id).toBe("ts0");
        expect(m.get("default-tabset", { layoutId: "w0" })?.id).toBe("ts3");
    });

    it("tab-, tabset- and border-settings-by: the node's own value, else the default", () => {
        const m = model();
        expect(m.get("tab-settings-by", { tabId: "a" })?.enableClose).toBe(
            false,
        );
        expect(m.get("tab-settings-by", { tabId: "b" })?.enableClose).toBe(
            true,
        );
        expect(
            m.get("tabset-settings-by", { tabsetId: "ts2" })?.enableClose,
        ).toBe(false);
        expect(m.get("border-settings-by", { borderId: "left" })).toMatchObject(
            {
                mode: "overlay",
                size: 220,
            },
        );
        // a node of another kind has no such settings
        expect(m.get("tab-settings-by", { tabId: "ts0" })).toBeUndefined();
        expect(m.get("tabset-settings-by", { tabsetId: "a" })).toBeUndefined();
        expect(
            m.get("border-settings-by", { borderId: "nope" }),
        ).toBeUndefined();
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
        expect(m.get("selected-tab-by", { tabsetId: "ts0" })?.id).toBe("a");
        must(m.run("tab.close", { tabId: "b" }));
        expect(m.get("node-by", { id: "b" })).toBeUndefined();
    });
});

describe("model.is", () => {
    it("tab-selected and tab-pinned: a tab's", () => {
        const m = model();
        expect(m.is("tab-selected", { tabId: "b" })).toBe(true);
        expect(m.is("tab-selected", { tabId: "a" })).toBe(false);
        expect(m.is("tab-selected", { tabId: "d" })).toBe(true);
        expect(m.is("tab-selected", { tabId: "ts0" })).toBe(false);
        expect(m.is("tab-pinned", { tabId: "c" })).toBe(true);
        expect(m.is("tab-pinned", { tabId: "a" })).toBe(false);
    });

    it("tabset-active and tabset-maximized: a tabset's, in its own layout", () => {
        const m = model();
        expect(m.is("tabset-active", { tabsetId: "ts1" })).toBe(true);
        expect(m.is("tabset-active", { tabsetId: "ts0" })).toBe(false);
        expect(m.is("tabset-maximized", { tabsetId: "ts0" })).toBe(false);
        must(m.run("tabset.maximize", { tabsetId: "ts0", value: true }));
        expect(m.is("tabset-maximized", { tabsetId: "ts0" })).toBe(true);
        must(m.run("tabset.activate", { tabsetId: "ts3" }));
        expect(m.is("tabset-active", { tabsetId: "ts3" })).toBe(true);
    });

    it("node-hidden-by-maximize: every tabset and row off the maximized tabset's path", () => {
        const m = model();
        must(m.run("tabset.maximize", { tabsetId: "ts1", value: true }));
        expect(m.is("node-hidden-by-maximize", { nodeId: "ts0" })).toBe(true);
        expect(m.is("node-hidden-by-maximize", { nodeId: "ts2" })).toBe(true);
        expect(m.is("node-hidden-by-maximize", { nodeId: "r1" })).toBe(false);
        expect(m.is("node-hidden-by-maximize", { nodeId: "ts1" })).toBe(false);
        // another layout's nodes are not
        expect(m.is("node-hidden-by-maximize", { nodeId: "ts3" })).toBe(false);
    });

    it("tabset-empty and border-empty: each of its own kind only", () => {
        const m = model();
        expect(m.is("tabset-empty", { tabsetId: "ts2" })).toBe(true);
        expect(m.is("tabset-empty", { tabsetId: "ts0" })).toBe(false);
        expect(m.is("tabset-empty", { tabsetId: "a" })).toBe(false);
        expect(m.is("border-empty", { borderId: "left" })).toBe(false);
        must(m.run("tab.move", { tabId: "d", to: "ts2" }));
        expect(m.is("border-empty", { borderId: "left" })).toBe(true);
        // an empty node of the other kind answers false
        expect(m.is("tabset-empty", { tabsetId: "left" })).toBe(false);
        expect(m.is("border-empty", { borderId: "ts0" })).toBe(false);
    });

    it("border-open and border-overlay: a border's", () => {
        const m = model();
        expect(m.is("border-open", { borderId: "left" })).toBe(true);
        expect(m.is("border-overlay", { borderId: "left" })).toBe(true);
        must(
            m.run("border.configure", {
                borderId: "left",
                open: false,
                mode: "docked",
            }),
        );
        expect(m.is("border-open", { borderId: "left" })).toBe(false);
        expect(m.is("border-overlay", { borderId: "left" })).toBe(false);
    });

    it("row-root: a layout's root row", () => {
        const m = model();
        expect(m.is("row-root", { rowId: "root" })).toBe(true);
        expect(m.is("row-root", { rowId: "wroot" })).toBe(true);
        expect(m.is("row-root", { rowId: "r1" })).toBe(false);
    });

    it("node-in-window: a node in a popout window's layout", () => {
        const m = model();
        expect(m.is("node-in-window", { nodeId: "e" })).toBe(true);
        expect(m.is("node-in-window", { nodeId: "ts3" })).toBe(true);
        expect(m.is("node-in-window", { nodeId: "a" })).toBe(false);
        expect(m.is("node-in-window", { nodeId: "d" })).toBe(false);
        expect(m.is("node-in-window", { nodeId: "nope" })).toBe(false);
    });

    it("is false for an unknown node", () => {
        const m = model();
        for (const key of MODEL_IS_KEYS) {
            expect(
                m.is(key, {
                    tabId: "nope",
                    tabsetId: "nope",
                    nodeId: "nope",
                    borderId: "nope",
                    rowId: "nope",
                } as never),
            ).toBe(false);
        }
    });
});

describe("the key lists", () => {
    it("list every key once", () => {
        expect(new Set(MODEL_GET_KEYS).size).toBe(MODEL_GET_KEYS.length);
        expect(new Set(MODEL_IS_KEYS).size).toBe(MODEL_IS_KEYS.length);
        expect(MODEL_GET_KEYS).toContain("selected-tab-by");
        expect(MODEL_IS_KEYS).toContain("node-hidden-by-maximize");
    });

    it("are kebab-case and never a command name (a command has a dot)", () => {
        for (const key of [...MODEL_GET_KEYS, ...MODEL_IS_KEYS]) {
            expect(key).toMatch(/^[a-z]+(-[a-z]+)*$/);
        }
    });

    it("read as a sentence: the key names its result, the payload whose", () => {
        // a get key that takes an id ends in `-by`, its payload is required, and its field
        // completes the key: `id` (the result's own) or `<entity>Id` (`node-by { id }`,
        // `selected-tab-by { tabsetId }`); any other key takes nothing or an optional `layoutId`
        const getInputs: {
            [K in ModelGetKey]: {
                required: NoPayload extends ModelGetMap[K]["payload"]
                    ? false
                    : true;
                fields: readonly FieldOf<ModelGetMap[K]["payload"]>[];
            };
        } = {
            "node-by": { required: true, fields: ["id"] },
            "node-parent-by": { required: true, fields: ["nodeId"] },
            "layout-id-by": { required: true, fields: ["nodeId"] },
            "root-row": { required: false, fields: ["layoutId"] },
            "window-by": { required: true, fields: ["id"] },
            windows: { required: false, fields: [] },
            borders: { required: false, fields: [] },
            "all-tabs": { required: false, fields: [] },
            tabs: { required: false, fields: ["layoutId"] },
            tabsets: { required: false, fields: ["layoutId"] },
            "selected-tab-by": {
                required: true,
                fields: ["tabsetId", "borderId", "layoutId"],
            },
            "active-tabset": { required: false, fields: ["layoutId"] },
            "default-tabset": { required: false, fields: ["layoutId"] },
            "maximized-tabset": { required: false, fields: ["layoutId"] },
            "tab-settings-by": { required: true, fields: ["tabId"] },
            "tabset-settings-by": { required: true, fields: ["tabsetId"] },
            "border-settings-by": { required: true, fields: ["borderId"] },
            "layout-settings": { required: false, fields: [] },
            "layout-json": { required: false, fields: [] },
            commands: { required: false, fields: [] },
        };
        expect(Object.keys(getInputs).sort()).toEqual(
            [...MODEL_GET_KEYS].sort(),
        );
        for (const [key, { required, fields }] of Object.entries(getInputs)) {
            const fieldList: readonly string[] = fields;
            expect(key, key).not.toMatch(/-by-/);
            expect(required, key).toBe(key.endsWith("-by"));
            if (required) {
                expect(fieldList.length, key).toBeGreaterThan(0);
                for (const field of fieldList) {
                    expect(field === "id" || field.endsWith("Id"), key).toBe(
                        true,
                    );
                }
            } else {
                expect(
                    fieldList.every((field) => field === "layoutId"),
                    key,
                ).toBe(true);
            }
        }
    });

    it("name the entity whose id they take (is)", () => {
        // an is key starts with the entity whose id it takes
        const isFields: { [K in keyof ModelIsMap]: keyof ModelIsMap[K] } = {
            "tab-selected": "tabId",
            "tab-pinned": "tabId",
            "tabset-active": "tabsetId",
            "tabset-maximized": "tabsetId",
            "tabset-empty": "tabsetId",
            "node-hidden-by-maximize": "nodeId",
            "node-in-window": "nodeId",
            "border-empty": "borderId",
            "border-open": "borderId",
            "border-overlay": "borderId",
            "row-root": "rowId",
        };
        expect(Object.keys(isFields).sort()).toEqual([...MODEL_IS_KEYS].sort());
        for (const [key, field] of Object.entries(isFields)) {
            expect(key.startsWith(`${field.replace(/Id$/, "")}-`), key).toBe(
                true,
            );
        }
    });
});
