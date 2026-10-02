import { describe, expect, it } from "vitest";
import type { LayoutJson } from "../../src/state/json";
import {
    LayoutValidationError,
    toLayoutJson,
    validateLayout,
} from "../../src/state/load";
import { createModel } from "../../src/state/model";
import type { AnyTypes } from "../../src/state/types";
import { render, setup, tab, tabsets } from "./harness";

function issuesOf(json: unknown): { path: string; message: string }[] {
    try {
        createModel(json as LayoutJson<AnyTypes>);
    } catch (error) {
        if (error instanceof LayoutValidationError) {
            return [...error.issues];
        }
        throw error;
    }
    throw new Error("expected a validation error");
}

describe("loading JSON v1", () => {
    it("fills what the document omits", () => {
        const model = createModel({
            version: 1,
            root: {
                type: "row",
                children: [
                    { type: "tabset", children: [tab("One"), tab("Two")] },
                    { type: "tabset", children: [], deleteWhenEmpty: false },
                ],
            },
            borders: [{ location: "left", children: [tab("Files")] }],
        });
        const [first, second] = model.state.root.children;
        expect(model.state.root.weight).toBe(100);
        expect(first).toMatchObject({
            type: "tabset",
            weight: 100,
            selected: 0,
        });
        expect(second).toMatchObject({
            type: "tabset",
            selected: -1,
            children: [],
        });
        expect(model.state.borders[0]).toMatchObject({
            type: "border",
            id: "border_left",
            selected: -1,
        });
        expect(model.state.windows).toEqual([]);
        expect(model.state.defaults).toEqual({});
    });

    it("gives the main layout one empty tabset when it has none", () => {
        const model = createModel();
        expect(model.state.root.children).toHaveLength(1);
        expect(model.state.root.children[0]).toMatchObject({
            type: "tabset",
            selected: -1,
            children: [],
        });
        expect(model.state.active).toBe(model.state.root.children[0]?.id);
    });

    it("clamps an out of range selected index", () => {
        const { text } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        selected: 5,
                        children: [tab("One"), tab("Two")],
                    },
                    { type: "tabset", selected: -5, children: [tab("Three")] },
                ],
            },
        });
        expect(text()).toBe("/ts0/t0[One],/ts0/t1[Two]*,/ts1/t0[Three]");
    });

    it("generates the missing ids, deterministically and without clashing with explicit ones", () => {
        const json: LayoutJson = {
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "x", label: "x" },
                            { id: "tab-1", component: "x", label: "x" },
                        ],
                    },
                ],
            },
        };
        const a = createModel(json);
        const b = createModel(json);
        expect(a.state).toEqual(b.state);
        const ids = a.get("all-tabs").map((t) => t.id);
        expect(ids).toEqual(["tab-2", "tab-1"]);
        expect(a.state.root.id).toBe("row-1");
    });

    it("uses an injected id generator", () => {
        let n = 0;
        const model = createModel(tabsets(["One"]), {
            createId: (kind) => `${kind}:${++n}`,
        });
        const added = model.run("tab.add", {
            component: "x",
            label: "x",
            to: "ts0",
        });
        expect(added).toEqual({ ok: true, value: { tabId: "tab:1" } });
    });

    it("keeps the active and maximized tabsets on their layouts", () => {
        const json = tabsets(["One"], ["Two"]);
        const model = createModel({ ...json, active: "ts1", maximized: "ts0" });
        expect(model.get("active-tabset")?.id).toBe("ts1");
        expect(model.get("maximized-tabset")?.id).toBe("ts0");
        expect(model.state.active).toBe("ts1");
    });

    it('round-trips: createModel(model.get("layout-json")) has an equal state', () => {
        const model = createModel({
            version: 1,
            defaults: {
                tab: { enablePopout: true },
                layout: { edgeDockMargin: 4 },
            },
            root: {
                type: "row",
                id: "root",
                children: [
                    {
                        type: "tabset",
                        id: "a",
                        weight: 30,
                        children: [tab("One", { pinned: true }), tab("Two")],
                    },
                    {
                        type: "row",
                        id: "r",
                        weight: 70,
                        children: [
                            {
                                type: "tabset",
                                id: "b",
                                children: [tab("Three")],
                                data: { tone: "blue" },
                            },
                            {
                                type: "tabset",
                                id: "c",
                                children: [tab("Four")],
                                enableDrop: false,
                            },
                        ],
                    },
                ],
            },
            active: "b",
            borders: [
                {
                    location: "bottom",
                    mode: "overlay",
                    size: 120,
                    children: [tab("Log")],
                    selected: 0,
                },
            ],
            windows: [
                {
                    id: "w1",
                    rect: { x: 10, y: 20, width: 300, height: 200 },
                    root: {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                id: "d",
                                children: [tab("Five")],
                            },
                        ],
                    },
                    active: "d",
                },
            ],
        });
        const again = createModel(model.get("layout-json"));
        expect(again.state).toStrictEqual(model.state);
        expect(render(again)).toBe(render(model));
    });

    it("hands out a writable copy from toJSON", () => {
        const model = createModel(tabsets(["One"]));
        const json = model.get("layout-json");
        expect(Object.isFrozen(json.root)).toBe(false);
        expect(Object.isFrozen(model.state.root)).toBe(true);
    });

    it("tidies the loaded tree as FlexLayout does", () => {
        const { model, text } = setup({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "row",
                        weight: 60,
                        children: [{ type: "tabset", children: [tab("One")] }],
                    },
                    { type: "row", children: [] },
                    { type: "tabset", children: [] },
                ],
            },
        });
        expect(text()).toBe("/ts0/t0[One]*");
        expect(model.state.root.children).toHaveLength(1);
        expect(model.state.root.children[0]?.weight).toBe(60);
    });
});

describe("validating JSON v1", () => {
    it("reports schema problems with JSON paths", () => {
        const issues = issuesOf({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        weight: -1,
                        children: [
                            { component: "", label: "Tab" },
                            { id: 4, component: "x", label: "x" },
                        ],
                    },
                    { type: "tab", component: "x", label: "x" },
                ],
            },
            borders: [{ location: "middle" }],
            extra: true,
        });
        expect(issues).toEqual(
            expect.arrayContaining([
                { path: "/root/children/0/weight", message: "must be >= 0" },
                {
                    path: "/root/children/0/children/0/component",
                    message: "must have at least 1 character(s)",
                },
                {
                    path: "/root/children/0/children/1/id",
                    message: "must be a string",
                },
                {
                    path: "/borders/0/location",
                    message: 'must be one of "top", "bottom", "left", "right"',
                },
                { path: "/extra", message: "is not allowed" },
            ]),
        );
        expect(issues.some((issue) => issue.path === "/root/children/1")).toBe(
            true,
        );
    });

    it("requires a string label on every tab, and keeps it in layout-json", () => {
        const issues = issuesOf({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "x" },
                            { component: "x", label: 1 },
                        ],
                    },
                ],
            },
        });
        expect(issues).toEqual([
            {
                path: "/root/children/0/children/0/label",
                message: "is required",
            },
            {
                path: "/root/children/0/children/1/label",
                message: "must be a string",
            },
        ]);
        const { model } = setup(tabsets(["One", "Two"]));
        const json = model.get("layout-json");
        expect(JSON.stringify(json)).toContain('"label":"Two"');
        expect(createModel(json).get("node-by", { id: "Two" })).toMatchObject({
            label: "Two",
        });
    });

    it("requires version 1", () => {
        expect(issuesOf({ version: 2, root: { type: "row" } })).toEqual([
            { path: "/version", message: "must be 1" },
        ]);
        expect(issuesOf({ root: { type: "row" } })).toEqual([
            { path: "/version", message: "is required" },
        ]);
    });

    it("reports duplicate ids, the reserved id and two borders on one side", () => {
        const issues = issuesOf({
            version: 1,
            root: {
                type: "row",
                id: "main",
                children: [
                    {
                        type: "tabset",
                        id: "x",
                        children: [{ id: "x", component: "c", label: "c" }],
                    },
                ],
            },
            borders: [{ location: "left" }, { location: "left", id: "other" }],
        });
        expect(issues.map((issue) => issue.path)).toEqual([
            "/root/id",
            "/root/children/0/children/0/id",
            "/borders/1/location",
        ]);
        expect(issues[1]?.message).toContain('duplicate id "x"');
    });

    it("rejects an active or maximized id that is not a tabset of its layout", () => {
        const json = tabsets(["One"]);
        expect(issuesOf({ ...json, active: "One" })).toEqual([
            {
                path: "/active",
                message: '"One" is not a tabset of this layout',
            },
        ]);
        expect(
            issuesOf({
                ...json,
                windows: [
                    {
                        id: "w",
                        root: {
                            type: "row",
                            children: [
                                {
                                    type: "tabset",
                                    id: "wt",
                                    children: [tab("Two")],
                                },
                            ],
                        },
                        maximized: "ts0",
                    },
                ],
            }),
        ).toEqual([
            {
                path: "/windows/0/maximized",
                message: '"ts0" is not a tabset of this layout',
            },
        ]);
    });

    it("validates tab data with the registered data schemas", () => {
        const json = {
            version: 1 as const,
            root: {
                type: "row" as const,
                children: [
                    {
                        type: "tabset" as const,
                        children: [
                            {
                                component: "editor",
                                label: "editor",
                                data: { path: 3 },
                            },
                        ],
                    },
                ],
            },
        };
        expect(() =>
            createModel(json, {
                dataSchemas: {
                    editor: {
                        type: "object",
                        properties: { path: { type: "string" } },
                        required: ["path"],
                    },
                },
            }),
        ).toThrowError(
            /root\/children\/0\/children\/0\/data\/path must be a string/,
        );
    });

    it("validateLayout reports without throwing", () => {
        expect(validateLayout(tabsets(["One"])).ok).toBe(true);
        const result = validateLayout({ version: 1 });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.issues).toEqual([
                { path: "/root", message: "is required" },
            ]);
        }
    });
});

describe("toLayoutJson", () => {
    it("turns a kept state back into a document layout.load takes", () => {
        const model = createModel(tabsets(["One", "Two"], ["Three"]));
        const before = model.state;
        const one = model.get("all-tabs")[0]?.id ?? "";
        model.run("tab.close", { tabId: one });
        const json = toLayoutJson(before);
        expect(json.version).toBe(1);
        expect(model.run("layout.load", { layout: json }).ok).toBe(true);
        expect(model.get("layout-json")).toEqual(json);
    });
});
