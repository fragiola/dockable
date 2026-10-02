import {
    booleanSchema,
    borderLocationSchema,
    borderModeSchema,
    dataSchema,
    idSchema,
    labelSchema,
    object,
    orientationSchema,
    rectSchema,
    sizeLimitProperties,
    sizeSchema,
    tabFieldProperties,
} from "./fragments";
import type { JsonSchema } from "./types";

const weightSchema = {
    type: "number",
    minimum: 0,
    description: "relative size in the parent row (default 100)",
} as const;

const selectedSchema = {
    type: "integer",
    description: "index of the selected tab; -1 for none",
} as const;

const tabsetFlags = {
    enableDrop: booleanSchema,
    enableDrag: booleanSchema,
    enableDivide: booleanSchema,
    enableMaximize: booleanSchema,
    enableClose: booleanSchema,
    deleteWhenEmpty: booleanSchema,
    autoSelectTab: booleanSchema,
    ...sizeLimitProperties,
} as const;

const borderFields = {
    size: sizeSchema,
    minSize: sizeSchema,
    maxSize: sizeSchema,
    mode: borderModeSchema,
    autoHide: booleanSchema,
    enableDrop: booleanSchema,
    autoSelectTabWhenOpen: booleanSchema,
    autoSelectTabWhenClosed: booleanSchema,
} as const;

const tabs = { type: "array", items: { $ref: "#/$defs/tab" } } as const;

/** The `$defs` of the layout schema (shared by `layout.load`'s payload schema). */
export const layoutDefs = {
    tab: object(
        {
            type: { const: "tab" },
            id: idSchema,
            component: { type: "string", minLength: 1 },
            label: labelSchema,
            data: dataSchema,
            ...tabFieldProperties,
        },
        ["component", "label"],
    ),
    tabset: object(
        {
            type: { const: "tabset" },
            id: idSchema,
            weight: weightSchema,
            selected: selectedSchema,
            data: dataSchema,
            children: tabs,
            ...tabsetFlags,
        },
        ["type"],
    ),
    row: object(
        {
            type: { const: "row" },
            id: idSchema,
            weight: weightSchema,
            data: dataSchema,
            children: {
                type: "array",
                items: {
                    anyOf: [
                        { $ref: "#/$defs/row" },
                        { $ref: "#/$defs/tabset" },
                    ],
                },
            },
        },
        ["type"],
    ),
    border: object(
        {
            type: { const: "border" },
            id: idSchema,
            location: borderLocationSchema,
            selected: selectedSchema,
            show: booleanSchema,
            data: dataSchema,
            children: tabs,
            ...borderFields,
        },
        ["location"],
    ),
    window: object(
        {
            id: idSchema,
            rect: rectSchema,
            root: { $ref: "#/$defs/row" },
            active: idSchema,
            maximized: idSchema,
        },
        ["root"],
    ),
    defaults: object({
        tab: object({
            enableClose: booleanSchema,
            enableDrag: booleanSchema,
            enablePopout: booleanSchema,
            ...sizeLimitProperties,
        }),
        tabset: object(tabsetFlags),
        border: object(borderFields),
        layout: object({
            rootOrientation: orientationSchema,
            edgeDock: booleanSchema,
            edgeDockMargin: sizeSchema,
            edgeDockLength: sizeSchema,
        }),
    }),
} as const satisfies { readonly [name: string]: JsonSchema };

/** The layout document without its `$defs` (they are hoisted by whoever embeds it). */
export const layoutDocumentSchema = object(
    {
        version: { const: 1 },
        defaults: { $ref: "#/$defs/defaults" },
        root: { $ref: "#/$defs/row" },
        active: idSchema,
        maximized: idSchema,
        borders: { type: "array", items: { $ref: "#/$defs/border" } },
        windows: { type: "array", items: { $ref: "#/$defs/window" } },
    },
    ["version", "root"],
);

/** The JSON Schema of a layout document (JSON v1). */
export const layoutSchema: JsonSchema = {
    title: "Dockable layout (JSON v1)",
    ...layoutDocumentSchema,
    $defs: layoutDefs,
};
