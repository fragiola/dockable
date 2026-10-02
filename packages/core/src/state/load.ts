import { type Rect, snap } from "../geometry/rect";
import {
    borderFieldProperties,
    propertyNames,
    tabFieldProperties,
    tabsetDefaultProperties,
} from "../schema/fragments";
import { layoutSchema } from "../schema/layout";
import type { JsonSchema, ValidationIssue } from "../schema/types";
import { joinPointer, validate } from "../schema/validator";
import { cloneJson } from "./clone";
import { Draft, deepFreeze } from "./draft";
import { IdSource } from "./ids";
import type { LayoutJson, TabInit } from "./json";
import { tidy } from "./tidy";
import {
    type AnyBorder,
    type AnyRow,
    type AnyState,
    type AnyTab,
    type AnyTabset,
    type AnyWindow,
    NodeIndex,
} from "./tree";
import {
    type DockableTypes,
    type LayoutDefaults,
    type LayoutState,
    MAIN_LAYOUT,
} from "./types";

/** The rect of the n-th window when it has none. */
export function defaultWindowRect(n: number): Rect {
    return { x: 50 + 50 * n, y: 50 + 50 * n, width: 600, height: 400 };
}

/** Thrown by `createModel` for an invalid layout document: every problem, each with a JSON path. */
export class LayoutValidationError extends Error {
    readonly issues: readonly ValidationIssue[];

    constructor(issues: readonly ValidationIssue[]) {
        const first = issues[0];
        super(
            first
                ? `invalid layout: ${first.path || "/"} ${first.message}${issues.length > 1 ? ` (and ${issues.length - 1} more)` : ""}`
                : "invalid layout",
        );
        this.name = "LayoutValidationError";
        this.issues = issues;
    }
}

/** Per-component data schemas: `tab.add`, `tab.set-data`, `tab.set-component` and loading validate `data` with them. */
export type DataSchemas = {
    readonly [component: string]: JsonSchema | undefined;
};

export interface BuildOptions {
    readonly dataSchemas?: DataSchemas | undefined;
    readonly freeze: boolean;
    /** ids a generated id must not take (the ids of the state being replaced) */
    readonly reserved?: ((id: string) => boolean) | undefined;
}

export type BuildResult =
    | { ok: true; state: AnyState; index: NodeIndex }
    | { ok: false; issues: ValidationIssue[] };

// the JSON types the schema guarantees (loosely typed: the schema has validated the shape)
interface TabsetJsonLike {
    readonly [key: string]: unknown;
    readonly type: "tabset";
    readonly id?: string;
    readonly weight?: number;
    readonly selected?: number;
    readonly children?: readonly TabInit[];
}
interface RowJsonLike {
    readonly [key: string]: unknown;
    readonly type: "row";
    readonly id?: string;
    readonly weight?: number;
    readonly children?: readonly (RowJsonLike | TabsetJsonLike)[];
}
interface BorderJsonLike {
    readonly [key: string]: unknown;
    readonly id?: string;
    readonly location: string;
    readonly selected?: number;
    readonly children?: readonly TabInit[];
}
interface WindowJsonLike {
    readonly id?: string;
    readonly rect?: { x: number; y: number; width: number; height: number };
    readonly root: RowJsonLike;
    readonly active?: string;
    readonly maximized?: string;
}
interface LayoutJsonLike {
    readonly defaults?: LayoutDefaults;
    readonly root: RowJsonLike;
    readonly active?: string;
    readonly maximized?: string;
    readonly borders?: readonly BorderJsonLike[];
    readonly windows?: readonly WindowJsonLike[];
}

/** The fields copied from JSON onto a node, by kind (everything else is structural). */
const TAB_FIELDS: readonly (keyof TabInit & string)[] = [
    "data",
    ...propertyNames(tabFieldProperties),
];
const TABSET_FIELDS = ["data", ...Object.keys(tabsetDefaultProperties)];
const BORDER_FIELDS = ["data", ...Object.keys(borderFieldProperties)];

function copyFields<S extends object>(
    target: Record<string, unknown>,
    source: S,
    fields: readonly (keyof S & string)[],
) {
    for (const field of fields) {
        const value = source[field];
        if (value !== undefined) {
            target[field] = cloneJson(value);
        }
    }
}

/** A tab node from its fields (JSON, `tab.add`): the structural ones, then those it has. */
export function tabNode(init: TabInit, id: string): AnyTab {
    const node: Record<string, unknown> = {
        type: "tab",
        id,
        component: init.component,
        label: init.label,
    };
    copyFields(node, init, TAB_FIELDS);
    return node as unknown as AnyTab;
}

function clampSelected(
    selected: number | undefined,
    count: number,
    fallback: number,
) {
    if (count === 0) {
        return -1;
    }
    const value = selected ?? fallback;
    if (value < -1) {
        return -1;
    }
    return value >= count ? count - 1 : value;
}

/**
 * Builds a state from a layout document: validates it (the schema, then ids, border sides and
 * the active and maximized tabsets), fills the omitted fields, generates the missing ids and tidies
 * it. Reports every problem with its JSON path.
 */
export function buildState(
    json: unknown,
    ids: IdSource,
    options: BuildOptions,
    path = "",
): BuildResult {
    const issues = validate(layoutSchema, json, path);
    if (issues.length > 0) {
        return { ok: false, issues };
    }
    const doc = json as LayoutJsonLike;

    // explicit ids first, so a generated one never takes an id used later in the document
    const explicit = new Map<string, string>();
    const claim = (id: string | undefined, at: string) => {
        if (id === undefined) {
            return;
        }
        if (id === MAIN_LAYOUT) {
            issues.push({
                path: joinPointer(at, "id"),
                message: `"${MAIN_LAYOUT}" is reserved for the main layout`,
            });
        } else if (explicit.has(id)) {
            issues.push({
                path: joinPointer(at, "id"),
                message: `duplicate id "${id}" (also at ${explicit.get(id) || "/"})`,
            });
        } else {
            explicit.set(id, joinPointer(at, "id"));
        }
    };
    const claimRow = (row: RowJsonLike, at: string) => {
        claim(row.id, at);
        for (const [i, child] of (row.children ?? []).entries()) {
            const childPath = joinPointer(joinPointer(at, "children"), i);
            if (child.type === "row") {
                claimRow(child, childPath);
            } else {
                claim(child.id, childPath);
                for (const [j, tab] of (child.children ?? []).entries()) {
                    claim(
                        tab.id,
                        joinPointer(joinPointer(childPath, "children"), j),
                    );
                }
            }
        }
    };
    claimRow(doc.root, joinPointer(path, "root"));
    const seenSides = new Map<string, number>();
    for (const [i, border] of (doc.borders ?? []).entries()) {
        const at = joinPointer(joinPointer(path, "borders"), i);
        claim(border.id ?? `border_${border.location}`, at);
        const before = seenSides.get(border.location);
        if (before !== undefined) {
            issues.push({
                path: joinPointer(at, "location"),
                message: `a border is already on the ${border.location} side (borders/${before})`,
            });
        }
        seenSides.set(border.location, i);
        for (const [j, tab] of (border.children ?? []).entries()) {
            const tabPath = joinPointer(joinPointer(at, "children"), j);
            claim(tab.id, tabPath);
            if (tab.pinned === true) {
                issues.push({
                    path: joinPointer(tabPath, "pinned"),
                    message: "a border tab cannot be pinned (only a tabset's)",
                });
            }
        }
    }
    for (const [i, windowLayout] of (doc.windows ?? []).entries()) {
        const at = joinPointer(joinPointer(path, "windows"), i);
        claim(windowLayout.id, at);
        claimRow(windowLayout.root, joinPointer(at, "root"));
    }

    const generated = new Set<string>();
    const newId = (kind: "row" | "tabset" | "tab" | "window") => {
        const id = ids.next(
            kind,
            (candidate) =>
                candidate === MAIN_LAYOUT ||
                explicit.has(candidate) ||
                generated.has(candidate) ||
                (options.reserved?.(candidate) ?? false),
        );
        generated.add(id);
        return id;
    };

    const buildTab = (tab: TabInit, at: string): AnyTab => {
        const schema = options.dataSchemas?.[tab.component];
        if (schema) {
            issues.push(...validate(schema, tab.data, joinPointer(at, "data")));
        }
        return tabNode(tab, tab.id ?? newId("tab"));
    };
    const buildTabs = (tabs: readonly TabInit[] | undefined, at: string) =>
        (tabs ?? []).map((tab, i) =>
            buildTab(tab, joinPointer(joinPointer(at, "children"), i)),
        );
    const buildTabset = (tabset: TabsetJsonLike, at: string): AnyTabset => {
        const children = buildTabs(tabset.children, at);
        const node: Record<string, unknown> = {
            type: "tabset",
            id: tabset.id ?? newId("tabset"),
            weight: tabset.weight ?? 100,
            selected: clampSelected(tabset.selected, children.length, 0),
            children,
        };
        copyFields(node, tabset, TABSET_FIELDS);
        return node as unknown as AnyTabset;
    };
    const buildRow = (row: RowJsonLike, at: string): AnyRow => {
        const node: Record<string, unknown> = {
            type: "row",
            id: row.id ?? newId("row"),
            weight: row.weight ?? 100,
            children: (row.children ?? []).map((child, i) => {
                const childPath = joinPointer(joinPointer(at, "children"), i);
                return child.type === "row"
                    ? buildRow(child, childPath)
                    : buildTabset(child, childPath);
            }),
        };
        if (row.data !== undefined) {
            node.data = cloneJson(row.data);
        }
        return node as unknown as AnyRow;
    };

    const root = buildRow(doc.root, joinPointer(path, "root"));
    const borders = (doc.borders ?? []).map((border, i): AnyBorder => {
        const at = joinPointer(joinPointer(path, "borders"), i);
        const children = buildTabs(border.children, at);
        const node: Record<string, unknown> = {
            type: "border",
            id: border.id ?? `border_${border.location}`,
            location: border.location,
            selected: clampSelected(border.selected, children.length, -1),
            children,
        };
        copyFields(node, border, BORDER_FIELDS);
        return node as unknown as AnyBorder;
    });
    const windows = (doc.windows ?? []).map((windowLayout, i): AnyWindow => {
        const at = joinPointer(joinPointer(path, "windows"), i);
        return {
            id: windowLayout.id ?? newId("window"),
            rect: snap(windowLayout.rect ?? defaultWindowRect(i)),
            root: buildRow(windowLayout.root, joinPointer(at, "root")),
            ...(windowLayout.active !== undefined
                ? { active: windowLayout.active }
                : {}),
            ...(windowLayout.maximized !== undefined
                ? { maximized: windowLayout.maximized }
                : {}),
        };
    });

    const state: AnyState = {
        defaults: cloneJson(doc.defaults ?? {}),
        root,
        ...(doc.active !== undefined ? { active: doc.active } : {}),
        ...(doc.maximized !== undefined ? { maximized: doc.maximized } : {}),
        borders,
        windows,
    };
    const index = NodeIndex.build(state);

    // an active or maximized tabset must be a tabset of its own layout
    const checkTabset = (
        id: string | undefined,
        layout: string,
        at: string,
    ) => {
        if (id === undefined) {
            return;
        }
        if (index.get(id)?.type !== "tabset" || index.layoutOf(id) !== layout) {
            issues.push({
                path: at,
                message: `"${id}" is not a tabset of this layout`,
            });
        }
    };
    checkTabset(state.active, MAIN_LAYOUT, joinPointer(path, "active"));
    checkTabset(state.maximized, MAIN_LAYOUT, joinPointer(path, "maximized"));
    for (const [i, windowLayout] of windows.entries()) {
        const at = joinPointer(joinPointer(path, "windows"), i);
        checkTabset(
            windowLayout.active,
            windowLayout.id,
            joinPointer(at, "active"),
        );
        checkTabset(
            windowLayout.maximized,
            windowLayout.id,
            joinPointer(at, "maximized"),
        );
    }

    if (issues.length > 0) {
        return { ok: false, issues };
    }

    const draft = new Draft(state, index, ids, options.reserved);
    tidy(draft);
    const committed = draft.commit(options.freeze);
    return {
        ok: true,
        state: options.freeze ? deepFreeze(committed.state) : committed.state,
        index: committed.index,
    };
}

/** Validates a layout document without building a model. */
export function validateLayout<J = LayoutJson>(
    json: unknown,
    options?: { dataSchemas?: DataSchemas },
): { ok: true; value: J } | { ok: false; issues: readonly ValidationIssue[] } {
    const result = buildState(json, new IdSource(), {
        dataSchemas: options?.dataSchemas,
        freeze: false,
    });
    return result.ok
        ? { ok: true, value: json as J }
        : { ok: false, issues: result.issues };
}

/**
 * A state as a layout document (a writable copy), like `model.get("layout-json")` for the current state:
 * for a state kept from before (`event.before`, an undo step), to load it back with `layout.load`.
 */
export function toLayoutJson<T extends DockableTypes>(
    state: LayoutState<T>,
): LayoutJson<T> {
    // the state is JSON-shaped already: a copy, with the version, and without the empty parts
    const json: Record<string, unknown> = { version: 1 };
    if (Object.keys(state.defaults).length > 0) {
        json.defaults = cloneJson(state.defaults);
    }
    json.root = cloneJson(state.root);
    if (state.active !== undefined) {
        json.active = state.active;
    }
    if (state.maximized !== undefined) {
        json.maximized = state.maximized;
    }
    if (state.borders.length > 0) {
        json.borders = cloneJson(state.borders);
    }
    if (state.windows.length > 0) {
        json.windows = cloneJson(state.windows);
    }
    return json as unknown as LayoutJson<T>;
}
