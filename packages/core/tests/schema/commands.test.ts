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
import type { JsonSchema } from "../../src/schema/types";
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
        result: { tabId: "tab-1" },
    },
    "tab.select": {
        valid: { tabId: "t" },
        invalid: {},
        path: "/tabId",
        result: { tabId: "t" },
    },
    "tab.close": {
        valid: { tabId: "t" },
        invalid: { tabId: "" },
        path: "/tabId",
        result: { tabId: "t" },
    },
    "tab.move": {
        valid: { tabId: "t", to: "ts1", location: "center", index: 2 },
        invalid: { tabId: "t", to: "ts1", index: -2 },
        path: "/index",
        result: { tabId: "t" },
    },
    "tab.update": {
        valid: { tabId: "t", component: "chart", data: { series: [1] } },
        invalid: { tabId: "t", data: {} },
        path: "/component",
        result: { tabId: "t" },
    },
    "tab.pin": {
        valid: { tabId: "t", value: true },
        invalid: { tabId: "t", value: "yes" },
        path: "/value",
        result: { tabId: "t" },
    },
    "tab.popout": {
        valid: { tabId: "t", rect },
        invalid: { tabId: "t", rect: { x: 0 } },
        path: "/rect/y",
        result: { windowId: "w" },
    },
    "tab.configure": {
        valid: { tabId: "t", enableClose: false, minWidth: null },
        invalid: { tabId: "t", enableClose: "no" },
        path: "/enableClose",
        result: { tabId: "t" },
    },
    "tabset.activate": {
        valid: { tabsetId: "ts" },
        invalid: { tabsetId: 1 },
        path: "/tabsetId",
        result: { tabsetId: "ts" },
    },
    "tabset.maximize": {
        valid: { tabsetId: "ts", value: false },
        invalid: { tabsetId: "ts" },
        path: "/value",
        result: { tabsetId: "ts" },
    },
    "tabset.close": {
        valid: { tabsetId: "ts" },
        invalid: { tabsetId: "ts", tabId: "t" },
        path: "/tabId",
        result: { closedTabIds: ["a"] },
    },
    "tabset.move": {
        valid: { tabsetId: "ts", to: "row", location: "bottom" },
        invalid: { to: "row" },
        path: "/tabsetId",
        result: { tabsetId: "ts" },
    },
    "tabset.popout": {
        valid: { tabsetId: "ts" },
        invalid: { tabsetId: "ts", rect: {} },
        path: "/rect/x",
        result: { windowId: "w" },
    },
    "tabset.configure": {
        valid: {
            tabsetId: "ts",
            enableDrop: false,
            data: { name: "x" },
            maxWidth: null,
        },
        invalid: { tabsetId: "ts", minHeight: -1 },
        path: "/minHeight",
        result: { tabsetId: "ts" },
    },
    "row.resize": {
        valid: { rowId: "r", weights: [1, 2.5] },
        invalid: { rowId: "r", weights: [1, -1] },
        path: "/weights/1",
        result: { rowId: "r" },
    },
    "row.configure": {
        valid: { rowId: "r", data: null },
        invalid: { data: 1 },
        path: "/rowId",
        result: { rowId: "r" },
    },
    "border.resize": {
        valid: { borderId: "border_left", size: 120 },
        invalid: { borderId: "border_left", size: "big" },
        path: "/size",
        result: { borderId: "border_left", size: 120 },
    },
    "border.configure": {
        valid: {
            borderId: "border_left",
            open: false,
            mode: "overlay",
            size: null,
        },
        invalid: { borderId: "border_left", mode: "floating" },
        path: "/mode",
        result: { borderId: "border_left" },
    },
    "window.close": {
        valid: { windowId: "w" },
        invalid: {},
        path: "/windowId",
        result: { tabIds: ["a", "b"] },
    },
    "window.configure": {
        valid: { windowId: "w", rect },
        invalid: { windowId: "w", rect: { ...rect, width: -1 } },
        path: "/rect/width",
        result: { windowId: "w" },
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
        result: { addedNodeIds: ["a"], removedNodeIds: [] },
    },
    batch: {
        valid: {
            commands: [
                { command: "tab.select", payload: { tabId: "t" } },
                { command: "tab.close", payload: { tabId: "t" } },
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

/** A string field that holds an id: the shape of `idSchema` (`{ type: "string", minLength: 1 }`). */
function isIdSchema(schema: JsonSchema | undefined): boolean {
    return schema?.type === "string" && schema.minLength === 1;
}

/** The top-level fields of a payload or result schema that hold an id but are not named `*Id`. */
function misnamedIdFields(schema: JsonSchema): string[] {
    return Object.entries(schema.properties ?? {}).flatMap(([name, field]) => {
        if (ID_FIELD_EXCEPTIONS.has(name)) {
            return [];
        }
        if (isIdSchema(field) && !name.endsWith("Id")) {
            return [name];
        }
        if (
            field.type === "array" &&
            isIdSchema(field.items) &&
            !name.endsWith("Ids")
        ) {
            return [name];
        }
        return [];
    });
}

// `to` is a placement target (a tabset, a row, a border or a layout), `id` is a new tab's own id,
// and `component` is a key of the app's registry, not a node
const ID_FIELD_EXCEPTIONS = new Set(["to", "id", "component"]);

describe("id fields", () => {
    it("every payload and result field holding an id is named `*Id` (`*Ids` for a list)", () => {
        const misnamed = [...COMMAND_DEFINITIONS.values()].flatMap(
            (definition) =>
                [
                    ...misnamedIdFields(definition.payloadSchema),
                    ...misnamedIdFields(definition.resultSchema),
                ].map((field) => `${definition.name}: ${field}`),
        );
        expect(misnamed).toEqual([]);
    });

    it("catches a misnamed id field", () => {
        expect(
            misnamedIdFields({
                type: "object",
                properties: {
                    tab: { type: "string", minLength: 1 },
                    tabs: {
                        type: "array",
                        items: { type: "string", minLength: 1 },
                    },
                    tabId: { type: "string", minLength: 1 },
                    tabIds: {
                        type: "array",
                        items: { type: "string", minLength: 1 },
                    },
                    to: { type: "string", minLength: 1 },
                },
            }),
        ).toEqual(["tab", "tabs"]);
    });
});
