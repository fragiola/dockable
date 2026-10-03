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

/** `start` is the side a line of text begins on (left in LTR, right in RTL), `end` the other. */
export const dockLocationSchema = {
    enum: ["center", "top", "bottom", "start", "end"],
    description:
        "into the target (center) or beside it: top, bottom, start (where a line of text begins: left in LTR, right in RTL) or end",
} as const satisfies JsonSchema;

export const borderLocationSchema = {
    enum: ["top", "bottom", "start", "end"],
    description:
        "a side of the layout: top, bottom, start (where a line of text begins: left in LTR, right in RTL) or end",
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

type Properties = { readonly [name: string]: JsonSchema };

/** The names of `properties`, typed. */
export function propertyNames<const P extends Properties>(
    properties: P,
): (keyof P & string)[] {
    return Object.keys(properties) as (keyof P & string)[];
}

/** A schema that also accepts `null`. */
type NullableSchema<S> = {
    readonly anyOf: readonly [S, { readonly const: null }];
    readonly description?: string;
};

/** `schema`, or `null` (a null removes a field so `then` applies). */
export function nullable<const S extends JsonSchema>(
    schema: S,
    then = "the layout default applies",
): NullableSchema<S> {
    // the description stays on the field, where readers (and assistants) look for it
    return schema.description === undefined
        ? { anyOf: [schema, { const: null }] }
        : {
              anyOf: [schema, { const: null }],
              description: `${schema.description} (null removes it: ${then})`,
          };
}

/** Each of `properties`, {@link nullable}. */
export function nullableEach<const P extends Properties>(
    properties: P,
    then?: string,
): { readonly [K in keyof P]: NullableSchema<P[K]> } {
    return Object.fromEntries(
        Object.entries(properties).map(([name, schema]) => [
            name,
            nullable(schema, then),
        ]),
    ) as { readonly [K in keyof P]: NullableSchema<P[K]> };
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
} as const satisfies Properties;

/** Size limits of a tab or tabset. */
export const sizeLimitProperties = {
    minWidth: { ...sizeSchema, description: "the smallest width, in px" },
    minHeight: { ...sizeSchema, description: "the smallest height, in px" },
    maxWidth: { ...sizeSchema, description: "the largest width, in px" },
    maxHeight: { ...sizeSchema, description: "the largest height, in px" },
} as const satisfies Properties;

/** The fields of a tab a layout default applies to, described. */
export const tabDefaultProperties = {
    closable: {
        ...booleanSchema,
        description: "whether the tab can be closed",
    },
    draggable: {
        ...booleanSchema,
        description: "whether the tab can be dragged",
    },
    poppable: {
        ...booleanSchema,
        description: "whether the tab can be popped out into a window",
    },
    renamable: {
        ...booleanSchema,
        description: "whether the tab can be renamed (`tab.rename`)",
    },
    ...sizeLimitProperties,
} as const satisfies Properties;

/** A tab's own panel size in a border, described. */
export const tabBorderSizeProperties = {
    borderWidth: {
        ...sizeSchema,
        description: "its panel's width in a start or end border, in px",
    },
    borderHeight: {
        ...sizeSchema,
        description: "its panel's height in a top or bottom border, in px",
    },
} as const satisfies Properties;

/** Every behaviour field of a tab, as `tab.add` and JSON take them. */
export const tabFieldProperties = {
    pinned: {
        ...booleanSchema,
        description:
            "a pinned tab sits at the start of its strip, cannot close and cannot leave its tabset",
    },
    ...tabDefaultProperties,
    ...tabBorderSizeProperties,
} as const satisfies Properties;

/** The behaviour fields of a tabset, described: a layout default applies to each. */
export const tabsetDefaultProperties = {
    droppable: {
        ...booleanSchema,
        description: "whether tabs can be dropped into it",
    },
    draggable: {
        ...booleanSchema,
        description: "whether the whole tabset can be dragged",
    },
    splittable: {
        ...booleanSchema,
        description: "whether a drop on one of its edges can split it",
    },
    maximizable: {
        ...booleanSchema,
        description: "whether it can be maximized",
    },
    closable: {
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
} as const satisfies Properties;

/** The fields of a border a layout default applies to, described. */
export const borderDefaultProperties = {
    size: { ...sizeSchema, description: "its panel's size, in px" },
    minSize: { ...sizeSchema, description: "its panel's smallest size, in px" },
    maxSize: { ...sizeSchema, description: "its panel's largest size, in px" },
    mode: {
        ...borderModeSchema,
        description: "docked (beside the layout) or overlay (over it)",
    },
    autoHide: {
        ...booleanSchema,
        description:
            "hide the strip while the border has no tabs (a drag near its edge reveals it)",
    },
    droppable: {
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
} as const satisfies Properties;

/** Every behaviour field of a border, described. */
export const borderFieldProperties = {
    show: {
        ...booleanSchema,
        description: "false hides the border entirely",
    },
    ...borderDefaultProperties,
} as const satisfies Properties;

/** The layout-wide settings, described. */
export const layoutSettingProperties = {
    rootOrientation: {
        ...orientationSchema,
        description:
            "the orientation of every layout's root row; nested rows alternate",
    },
    edgeDock: {
        ...booleanSchema,
        description: "whether a drag offers the layout's edges as drop targets",
    },
    edgeDockMargin: {
        ...sizeSchema,
        description: "the depth in px of each edge band",
    },
    edgeDockLength: {
        ...sizeSchema,
        description:
            "the length in px of each edge band, centred on its edge (at most the edge)",
    },
} as const satisfies Properties;

/** A tab's label: any string (refusing an empty one is the app's policy). */
export const labelSchema = {
    type: "string",
    description: "the tab's name (the app renders it; the packages never do)",
} as const satisfies JsonSchema;
