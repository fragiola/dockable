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
): {
    readonly anyOf: readonly [S, { readonly const: null }];
    readonly description?: string;
} {
    // the description stays on the field, where readers (and assistants) look for it
    return schema.description === undefined
        ? { anyOf: [schema, { const: null }] }
        : {
              anyOf: [schema, { const: null }],
              description: `${schema.description} (null removes it: the layout default applies)`,
          };
}

/** A described id field: `the tab's id`. */
export function describedId<const K extends string>(
    kind: K,
): {
    readonly type: "string";
    readonly minLength: 1;
    readonly description: string;
} {
    return { ...idSchema, description: `the ${kind}'s id` };
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
    minWidth: { ...sizeSchema, description: "the smallest width, in px" },
    minHeight: { ...sizeSchema, description: "the smallest height, in px" },
    maxWidth: { ...sizeSchema, description: "the largest width, in px" },
    maxHeight: { ...sizeSchema, description: "the largest height, in px" },
} as const satisfies { readonly [name: string]: JsonSchema };

/** The behaviour fields of a tabset, described. */
export const tabsetFieldProperties = {
    enableDrop: {
        ...booleanSchema,
        description: "whether tabs can be dropped into it",
    },
    enableDrag: {
        ...booleanSchema,
        description: "whether the whole tabset can be dragged",
    },
    enableDivide: {
        ...booleanSchema,
        description: "whether a drop on one of its edges can split it",
    },
    enableMaximize: {
        ...booleanSchema,
        description: "whether it can be maximized",
    },
    enableClose: {
        ...booleanSchema,
        description: "whether it can be closed",
    },
    deleteWhenEmpty: {
        ...booleanSchema,
        description: "whether it is removed when its last tab leaves",
    },
    autoSelectTab: {
        ...booleanSchema,
        description: "whether a tab added to it is selected",
    },
    ...sizeLimitProperties,
} as const satisfies { readonly [name: string]: JsonSchema };

/** The behaviour fields of a border, described. */
export const borderFieldProperties = {
    mode: {
        ...borderModeSchema,
        description: "docked (beside the layout) or overlay (over it)",
    },
    show: {
        ...booleanSchema,
        description: "false hides the border entirely",
    },
    autoHide: {
        ...booleanSchema,
        description:
            "hide the strip while the border has no tabs (a drag near its edge reveals it)",
    },
    enableDrop: {
        ...booleanSchema,
        description: "whether tabs can be dropped into it",
    },
    autoSelectTabWhenOpen: {
        ...booleanSchema,
        description: "whether a tab added while its panel is open is selected",
    },
    autoSelectTabWhenClosed: {
        ...booleanSchema,
        description:
            "whether a tab added while its panel is closed is selected (which opens it)",
    },
    size: { ...sizeSchema, description: "its panel's size, in px" },
    minSize: { ...sizeSchema, description: "its panel's smallest size, in px" },
    maxSize: { ...sizeSchema, description: "its panel's largest size, in px" },
} as const satisfies { readonly [name: string]: JsonSchema };

/** A tab's label: any string (refusing an empty one is the app's policy). */
export const labelSchema = {
    type: "string",
    description: "the tab's name (the app renders it; the packages never do)",
} as const satisfies JsonSchema;

/** The behaviour fields of a tab, as `tab.add` and JSON take them. */
export const tabFieldProperties = {
    pinned: {
        ...booleanSchema,
        description:
            "a pinned tab sits at the start of its strip, cannot close and cannot leave its tabset",
    },
    enableClose: {
        ...booleanSchema,
        description: "whether the tab can be closed",
    },
    enableDrag: {
        ...booleanSchema,
        description: "whether the tab can be dragged",
    },
    enablePopout: {
        ...booleanSchema,
        description: "whether the tab can be popped out into a window",
    },
    ...sizeLimitProperties,
    borderWidth: {
        ...sizeSchema,
        description: "its panel's width in a left or right border, in px",
    },
    borderHeight: {
        ...sizeSchema,
        description: "its panel's height in a top or bottom border, in px",
    },
} as const satisfies { readonly [name: string]: JsonSchema };
