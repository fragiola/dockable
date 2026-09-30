import type { JsonSchema } from "./types";

/** A node or window id. */
export const idSchema = {
    type: "string",
    minLength: 1,
} as const satisfies JsonSchema;

export const booleanSchema = { type: "boolean" } as const satisfies JsonSchema;

export const stringSchema = { type: "string" } as const satisfies JsonSchema;

/** Any JSON value (the app's data). */
export const dataSchema = {
    description: "the app's data (any JSON value)",
} as const satisfies JsonSchema;

/** A size in px. */
export const sizeSchema = {
    type: "number",
    minimum: 0,
} as const satisfies JsonSchema;

export const dockLocationSchema = {
    enum: ["center", "top", "bottom", "left", "right"],
} as const satisfies JsonSchema;

export const borderLocationSchema = {
    enum: ["top", "bottom", "left", "right"],
} as const satisfies JsonSchema;

export const borderModeSchema = {
    enum: ["docked", "overlay"],
} as const satisfies JsonSchema;

export const orientationSchema = {
    enum: ["horizontal", "vertical"],
} as const satisfies JsonSchema;

/** An insertion index; -1 appends. */
export const indexSchema = {
    type: "integer",
    minimum: -1,
} as const satisfies JsonSchema;

export const rectSchema = {
    type: "object",
    properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: sizeSchema,
        height: sizeSchema,
    },
    required: ["x", "y", "width", "height"],
    additionalProperties: false,
} as const satisfies JsonSchema;

/** `schema`, or `null` (a null removes a field so the defaults apply). */
export function nullable<const S extends JsonSchema>(
    schema: S,
): { readonly anyOf: readonly [S, { readonly const: null }] } {
    return { anyOf: [schema, { const: null }] };
}

type Properties = { readonly [name: string]: JsonSchema };

/** A closed object schema: only `properties`, the `required` ones present. */
export function object<const P extends Properties>(
    properties: P,
): {
    readonly type: "object";
    readonly properties: P;
    readonly required: readonly [];
    readonly additionalProperties: false;
};
export function object<
    const P extends Properties,
    const R extends readonly (keyof P & string)[],
>(
    properties: P,
    required: R,
): {
    readonly type: "object";
    readonly properties: P;
    readonly required: R;
    readonly additionalProperties: false;
};
export function object(
    properties: Properties,
    required: readonly string[] = [],
): JsonSchema {
    return {
        type: "object",
        properties,
        required,
        additionalProperties: false,
    };
}

/** The properties of a placement (`to`, `location`, `index`, `select`). */
export const placementProperties = {
    to: {
        ...idSchema,
        description: "a tabset, a row, a border, or a layout id (its root row)",
    },
    location: {
        ...dockLocationSchema,
        description:
            "center (default) goes into the target; an edge of a tabset splits it; an edge of a row docks beside its children",
    },
    index: {
        ...indexSchema,
        description: "for a center drop: the insertion index; -1 appends",
    },
    select: {
        ...booleanSchema,
        description: "whether the tab is selected in its new place",
    },
} as const satisfies { readonly [name: string]: JsonSchema };

/** Size limits of a tab or tabset. */
export const sizeLimitProperties = {
    minWidth: sizeSchema,
    minHeight: sizeSchema,
    maxWidth: sizeSchema,
    maxHeight: sizeSchema,
} as const satisfies { readonly [name: string]: JsonSchema };

/** The behaviour fields of a tab, as `tab.add` and JSON take them. */
export const tabFieldProperties = {
    pinned: booleanSchema,
    enableClose: booleanSchema,
    enableDrag: booleanSchema,
    enablePopout: booleanSchema,
    ...sizeLimitProperties,
    borderWidth: sizeSchema,
    borderHeight: sizeSchema,
} as const satisfies { readonly [name: string]: JsonSchema };
