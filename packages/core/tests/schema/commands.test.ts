// For every command: a valid payload passes its schema, an invalid one fails at the expected path,
// and the fixtures are typed with the command's TypeScript types, so schema and type agree (the
// type-level check is in tests/types/schemas.ts).
import { describe, expect, it } from "vitest";
import { COMMAND_DEFINITIONS } from "../../src/commands/catalogue";
import type {
    CommandName,
    PayloadOf,
    ResultOf,
} from "../../src/commands/types";
import { layoutSchema } from "../../src/schema/layout";
import { validate } from "../../src/schema/validator";
import type { AnyTypes } from "../../src/state/types";

interface Fixture<C extends CommandName> {
    valid: PayloadOf<AnyTypes, C>;
    invalid: unknown;
    path: string;
    result: ResultOf<AnyTypes, C>;
}

const rect = { x: 0, y: 0, width: 100, height: 50 };

const fixtures: { [C in CommandName]: Fixture<C> } = {
    "tab.add": {
        valid: {
            component: "chart",
            data: { series: [] },
            to: "ts0",
            location: "left",
            index: -1,
            select: true,
            pinned: false,
            minWidth: 10,
        },
        invalid: { component: "chart", to: "ts0", location: "middle" },
        path: "/location",
        result: { tab: "tab-1" },
    },
    "tab.select": {
        valid: { tab: "t" },
        invalid: {},
        path: "/tab",
        result: { tab: "t" },
    },
    "tab.close": {
        valid: { tab: "t" },
        invalid: { tab: "" },
        path: "/tab",
        result: { tab: "t" },
    },
    "tab.move": {
        valid: { tab: "t", to: "ts1", location: "center", index: 2 },
        invalid: { tab: "t", to: "ts1", index: -2 },
        path: "/index",
        result: { tab: "t" },
    },
    "tab.update": {
        valid: { tab: "t", component: "chart", data: { series: [1] } },
        invalid: { tab: "t", data: {} },
        path: "/component",
        result: { tab: "t" },
    },
    "tab.pin": {
        valid: { tab: "t", value: true },
        invalid: { tab: "t", value: "yes" },
        path: "/value",
        result: { tab: "t" },
    },
    "tab.popout": {
        valid: { tab: "t", rect },
        invalid: { tab: "t", rect: { x: 0 } },
        path: "/rect/y",
        result: { window: "w" },
    },
    "tab.configure": {
        valid: { tab: "t", enableClose: false, minWidth: null },
        invalid: { tab: "t", enableClose: "no" },
        path: "/enableClose",
        result: { tab: "t" },
    },
    "tabset.activate": {
        valid: { tabset: "ts" },
        invalid: { tabset: 1 },
        path: "/tabset",
        result: { tabset: "ts" },
    },
    "tabset.maximize": {
        valid: { tabset: "ts", value: false },
        invalid: { tabset: "ts" },
        path: "/value",
        result: { tabset: "ts" },
    },
    "tabset.close": {
        valid: { tabset: "ts" },
        invalid: { tabset: "ts", tab: "t" },
        path: "/tab",
        result: { closed: ["a"] },
    },
    "tabset.move": {
        valid: { tabset: "ts", to: "row", location: "bottom" },
        invalid: { to: "row" },
        path: "/tabset",
        result: { tabset: "ts" },
    },
    "tabset.popout": {
        valid: { tabset: "ts" },
        invalid: { tabset: "ts", rect: {} },
        path: "/rect/x",
        result: { window: "w" },
    },
    "tabset.configure": {
        valid: {
            tabset: "ts",
            enableDrop: false,
            data: { name: "x" },
            maxWidth: null,
        },
        invalid: { tabset: "ts", minHeight: -1 },
        path: "/minHeight",
        result: { tabset: "ts" },
    },
    "row.resize": {
        valid: { row: "r", weights: [1, 2.5] },
        invalid: { row: "r", weights: [1, -1] },
        path: "/weights/1",
        result: { row: "r" },
    },
    "row.configure": {
        valid: { row: "r", data: null },
        invalid: { data: 1 },
        path: "/row",
        result: { row: "r" },
    },
    "border.resize": {
        valid: { border: "border_left", size: 120 },
        invalid: { border: "border_left", size: "big" },
        path: "/size",
        result: { border: "border_left", size: 120 },
    },
    "border.configure": {
        valid: {
            border: "border_left",
            open: false,
            mode: "overlay",
            size: null,
        },
        invalid: { border: "border_left", mode: "floating" },
        path: "/mode",
        result: { border: "border_left" },
    },
    "window.close": {
        valid: { window: "w" },
        invalid: {},
        path: "/window",
        result: { tabs: ["a", "b"] },
    },
    "window.configure": {
        valid: { window: "w", rect },
        invalid: { window: "w", rect: { ...rect, width: -1 } },
        path: "/rect/width",
        result: { window: "w" },
    },
    "layout.configure": {
        valid: {
            defaults: {
                tab: { enablePopout: true, minWidth: null },
                border: null,
                layout: { rootOrientation: "vertical" },
            },
        },
        invalid: { defaults: { layout: { rootOrientation: "diagonal" } } },
        path: "/defaults/layout/rootOrientation",
        result: {},
    },
    "layout.load": {
        valid: {
            layout: {
                version: 1,
                root: {
                    type: "row",
                    children: [
                        { type: "tabset", children: [{ component: "x" }] },
                    ],
                },
            },
        },
        invalid: {
            layout: {
                version: 1,
                root: {
                    type: "row",
                    children: [{ type: "tabset", selected: "0" }],
                },
            },
        },
        path: "/layout/root/children/0/selected",
        result: { added: ["a"], removed: [] },
    },
    batch: {
        valid: {
            commands: [
                { command: "tab.select", payload: { tab: "t" } },
                { command: "tab.close", payload: { tab: "t" } },
            ],
        },
        invalid: { commands: [{ command: "tab.select" }] },
        path: "/commands/0/payload",
        result: { results: [{ tab: "t" }] },
    },
};

describe("command schemas", () => {
    it("has a fixture for every command", () => {
        expect(Object.keys(fixtures).sort()).toEqual(
            [...COMMAND_DEFINITIONS.keys()].sort(),
        );
    });

    for (const [name, definition] of COMMAND_DEFINITIONS) {
        const fixture = fixtures[name as CommandName];
        it(`${name}: a valid payload passes`, () => {
            expect(validate(definition.payloadSchema, fixture.valid)).toEqual(
                [],
            );
        });
        it(`${name}: an invalid payload fails at ${fixture.path}`, () => {
            const issues = validate(definition.payloadSchema, fixture.invalid);
            expect(issues.map((issue) => issue.path)).toContain(fixture.path);
        });
        it(`${name}: its result matches the result schema`, () => {
            expect(validate(definition.resultSchema, fixture.result)).toEqual(
                [],
            );
        });
    }

    it("the layout schema accepts every JSON v1 feature", () => {
        expect(
            validate(layoutSchema, {
                version: 1,
                defaults: {
                    tab: { enableClose: false },
                    tabset: { deleteWhenEmpty: false },
                    border: { size: 100, mode: "overlay" },
                    layout: {
                        rootOrientation: "vertical",
                        edgeDock: false,
                        edgeDockMargin: 4,
                        edgeDockLength: 50,
                    },
                },
                root: {
                    type: "row",
                    id: "r",
                    weight: 1,
                    data: { any: ["thing"] },
                    children: [
                        {
                            type: "tabset",
                            id: "ts",
                            selected: 0,
                            enableDrop: false,
                            minWidth: 10,
                            children: [
                                {
                                    type: "tab",
                                    id: "t",
                                    component: "c",
                                    data: 1,
                                    pinned: true,
                                    borderWidth: 20,
                                },
                            ],
                        },
                        { type: "row", children: [] },
                    ],
                },
                active: "ts",
                maximized: "ts",
                borders: [
                    {
                        type: "border",
                        location: "left",
                        selected: -1,
                        show: false,
                        autoHide: true,
                        children: [],
                    },
                ],
                windows: [
                    { id: "w", rect, root: { type: "row" }, active: "x" },
                ],
            }),
        ).toEqual([]);
    });
});
