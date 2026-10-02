import type { DockLocation } from "../geometry/dock";
import type { Rect } from "../geometry/rect";
import {
    booleanSchema,
    dataSchema,
    describedId,
    idSchema,
    labelSchema,
    nullable,
    object,
    placementProperties,
    rectSchema,
    tabFieldProperties,
} from "../schema/fragments";
import { cloneJson } from "../state/clone";
import { resolveTab } from "../state/defaults";
import { type Draft, newRow, newTabset } from "../state/draft";
import type { TabInit } from "../state/json";
import {
    adjustSelectedIndex,
    pinnedRunLength,
    repairSelected,
    selectedTabOf,
} from "../state/selection";
import { tidy } from "../state/tidy";
import type { AnyTab } from "../state/tree";
import { MAIN_LAYOUT } from "../state/types";
import { defineCommand, fail, ok } from "./define";
import { dropOnBorder, dropOnRow, dropOnTabset } from "./dock";
import { checkDrop, type DropTarget, resolveTarget } from "./rules";
import type { CommandError } from "./types";

const tabIdSchema = { ...idSchema, description: "the tab's id" } as const;

const tabIdResult = object({ tabId: describedId("tab") }, ["tabId"]);

/** Removes the keys whose value is undefined (the state holds no undefined fields). */
export function compact<O extends object>(value: O): O {
    const out: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(value)) {
        if (field !== undefined) {
            out[key] = field;
        }
    }
    return out as O;
}

/** A tab node from its init fields, with a generated id when it has none. */
export function tabFromInit(draft: Draft, init: TabInit): AnyTab {
    return compact({
        type: "tab" as const,
        id: init.id ?? draft.newId("tab"),
        component: init.component,
        label: init.label,
        data: cloneJson(init.data),
        pinned: init.pinned,
        enableClose: init.enableClose,
        enableDrag: init.enableDrag,
        enablePopout: init.enablePopout,
        minWidth: init.minWidth,
        minHeight: init.minHeight,
        maxWidth: init.maxWidth,
        maxHeight: init.maxHeight,
        borderWidth: init.borderWidth,
        borderHeight: init.borderHeight,
    });
}

/** Places a node (a tab or a tabset) at a resolved target. */
export function place(
    draft: Draft,
    target: DropTarget,
    id: string,
    location: DockLocation,
    index: number,
    select: boolean | undefined,
): string {
    if (target.type === "tabset") {
        return dropOnTabset(draft, target.id, id, location, index, select);
    }
    if (target.type === "row") {
        return dropOnRow(draft, target.id, id, location, index);
    }
    dropOnBorder(draft, target.id, id, index, select);
    return target.id;
}

/** The tab `id` in the tree, or a not_found error. */
export function attachedTab(
    draft: Draft,
    id: string,
    path = "/tabId",
): AnyTab | CommandError {
    const tab = draft.tab(id);
    if (!tab || !draft.isAttached(id)) {
        return { code: "not_found", message: `no tab "${id}"`, path };
    }
    return tab;
}

export function isError(value: object): value is CommandError {
    return "code" in value && "message" in value && !("type" in value);
}

/** The rect of the n-th new window when none is given. */
export function defaultWindowRect(n: number): Rect {
    return { x: 50 + 50 * n, y: 50 + 50 * n, width: 600, height: 400 };
}

export const tabAdd = defineCommand({
    name: "tab.add",
    description:
        "Add a new tab. `component` names what the tab shows, `label` is its name (the app renders it) and `data` holds its state (validated when the app registered a data schema). `to` is a tabset, a row, a border or a layout id; `location` center adds it to that tabset or border at `index` (-1 appends), an edge of a tabset splits it, an edge of a root row docks the tab to that side of the layout.",
    payloadSchema: object(
        {
            id: {
                ...idSchema,
                description: "the new tab's id (generated when omitted)",
            },
            component: {
                type: "string",
                minLength: 1,
                description: "what the tab shows (a key of the app's registry)",
            },
            label: labelSchema,
            data: dataSchema,
            ...tabFieldProperties,
            ...placementProperties,
        },
        ["component", "label", "to"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft, validateData }) {
        const target = resolveTarget(draft, payload.to);
        if (isError(target)) {
            return { ok: false, error: target };
        }
        if (payload.id !== undefined && draft.isUsed(payload.id)) {
            return fail(
                "refused",
                `the id "${payload.id}" is already in use`,
                "/id",
            );
        }
        const invalid = validateData(payload.component, payload.data, "/data");
        if (invalid) {
            return { ok: false, error: invalid };
        }
        const location = payload.location ?? "center";
        const refused = checkDrop(
            draft,
            { kind: "tab", id: undefined, fields: payload },
            target,
            location,
        );
        if (refused) {
            return { ok: false, error: refused };
        }
        const tab = draft.create(tabFromInit(draft, payload));
        place(
            draft,
            target,
            tab.id,
            location,
            payload.index ?? -1,
            payload.select,
        );
        tidy(draft);
        return ok({ tabId: tab.id });
    },
});

export const tabSelect = defineCommand({
    name: "tab.select",
    description:
        "Select a tab, making it visible. In a tabset the tabset also becomes the active one; in a border the border's panel opens. Selecting the selected tab changes nothing.",
    payloadSchema: object({ tabId: tabIdSchema }, ["tabId"]),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if (isError(tab)) {
            return { ok: false, error: tab };
        }
        const parent = draft.parentOf(tab.id);
        const container = parent === undefined ? undefined : draft.get(parent);
        if (container?.type === "tabset" || container?.type === "border") {
            const index = container.children.findIndex(
                (child) => child.id === tab.id,
            );
            draft.set(container.id, "selected", index);
            if (container.type === "tabset") {
                const layout = draft.layoutOf(container.id);
                if (layout !== undefined) {
                    draft.setActive(layout, container.id);
                }
            }
        }
        return ok({ tabId: tab.id });
    },
});

export const tabClose = defineCommand({
    name: "tab.close",
    description:
        "Close a tab and remove it from the layout. Refused for a pinned tab or one whose enableClose is false.",
    payloadSchema: object({ tabId: tabIdSchema }, ["tabId"]),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if (isError(tab)) {
            return { ok: false, error: tab };
        }
        const resolved = resolveTab(draft.getDefaults(), tab);
        if (resolved.pinned) {
            return fail("refused", `tab "${tab.id}" is pinned`, "/tabId");
        }
        if (!resolved.enableClose) {
            return fail(
                "refused",
                `tab "${tab.id}" cannot be closed`,
                "/tabId",
            );
        }
        const where = draft.detach(tab.id);
        if (where) {
            if (draft.get(where.parent)?.type === "border") {
                repairSelected(draft, where.parent);
            } else {
                adjustSelectedIndex(draft, where.parent, where.index);
            }
        }
        tidy(draft);
        return ok({ tabId: tab.id });
    },
});

export const tabMove = defineCommand({
    name: "tab.move",
    description:
        "Move a tab to another place: into a tabset or border at an index (location center), beside a tabset (an edge location splits it), or to an edge of a layout (`to` a root row or a layout id, with an edge location). Refused where the tab or the target does not allow it.",
    payloadSchema: object({ tabId: tabIdSchema, ...placementProperties }, [
        "tabId",
        "to",
    ]),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if (isError(tab)) {
            return { ok: false, error: tab };
        }
        if (!resolveTab(draft.getDefaults(), tab).enableDrag) {
            return fail("refused", `tab "${tab.id}" cannot be moved`, "/tabId");
        }
        const target = resolveTarget(draft, payload.to);
        if (isError(target)) {
            return { ok: false, error: target };
        }
        const location = payload.location ?? "center";
        const refused = checkDrop(
            draft,
            { kind: "tab", id: tab.id, fields: tab },
            target,
            location,
        );
        if (refused) {
            return { ok: false, error: refused };
        }
        place(
            draft,
            target,
            tab.id,
            location,
            payload.index ?? -1,
            payload.select,
        );
        tidy(draft);
        return ok({ tabId: tab.id });
    },
});

export const tabSetData = defineCommand({
    name: "tab.set-data",
    description:
        "Change a tab's data. Without `component`, `data` is a shallow patch: its top-level keys replace the tab's, the others stay (none is removed). With `component`, the tab switches to that component and `data` is its whole new value. The resulting data is validated when the app registered a schema for the component.",
    payloadSchema: {
        type: "object",
        anyOf: [
            object(
                {
                    tabId: tabIdSchema,
                    component: {
                        not: {},
                        description: "absent: the data is a patch",
                    },
                    data: {
                        type: "object",
                        description:
                            "the keys to change; each replaces the tab's own (a shallow merge)",
                    },
                },
                ["tabId", "data"],
            ),
            object(
                {
                    tabId: tabIdSchema,
                    component: {
                        type: "string",
                        minLength: 1,
                        description:
                            "the tab's new component (its current one to replace the data whole)",
                    },
                    data: {
                        ...dataSchema,
                        description: "the component's whole data",
                    },
                },
                ["tabId", "component"],
            ),
        ],
    },
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft, validateData }) {
        const tab = attachedTab(draft, payload.tabId);
        if (isError(tab)) {
            return { ok: false, error: tab };
        }
        if (payload.component === undefined) {
            const current = tab.data ?? {};
            if (!isPlainObject(current)) {
                return fail(
                    "invalid_payload",
                    `the data of tab "${tab.id}" is not an object: set it whole, with its component`,
                    "/data",
                );
            }
            // only the patch is copied (the kept keys are the state's own); a spread defines own
            // keys, and an undefined value, dropped by the copy, changes nothing
            const data = { ...current, ...cloneJson(payload.data) };
            const invalid = validateData(tab.component, data, "/data");
            if (invalid) {
                return { ok: false, error: invalid };
            }
            draft.set(tab.id, "data", data);
            return ok({ tabId: tab.id });
        }
        const invalid = validateData(payload.component, payload.data, "/data");
        if (invalid) {
            return { ok: false, error: invalid };
        }
        draft.set(tab.id, "component", payload.component);
        draft.set(tab.id, "data", cloneJson(payload.data));
        return ok({ tabId: tab.id });
    },
});

/** A plain JSON object (not an array, not null). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const tabPin = defineCommand({
    name: "tab.pin",
    description:
        "Pin (value true) or unpin a tab of a tabset. Pinned tabs sit at the start of the strip, cannot be closed and cannot be dragged out of their tabset.",
    payloadSchema: object(
        {
            tabId: tabIdSchema,
            value: { ...booleanSchema, description: "true pins, false unpins" },
        },
        ["tabId", "value"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if (isError(tab)) {
            return { ok: false, error: tab };
        }
        const parent = draft.parentOf(tab.id);
        if ((tab.pinned === true) === payload.value) {
            return ok({ tabId: tab.id });
        }
        if (parent === undefined || draft.get(parent)?.type !== "tabset") {
            if (payload.value) {
                return fail(
                    "refused",
                    "only a tab of a tabset can be pinned",
                    "/tabId",
                );
            }
            // unpinning is always possible (outside a tabset there is no pinned run to leave)
            draft.set(tab.id, "pinned", undefined);
            return ok({ tabId: tab.id });
        }
        const selected = selectedTabOf(draft, parent);
        draft.set(tab.id, "pinned", payload.value ? true : undefined);
        draft.detach(tab.id);
        // with the tab out, the run's length is both the end of the pinned tabs (pin) and the
        // start of the others (unpin)
        draft.attach(parent, tab.id, pinnedRunLength(draft, parent));
        if (selected !== undefined) {
            const index = draft
                .tabset(parent)
                ?.children.findIndex((child) => child.id === selected);
            draft.set(parent, "selected", index ?? -1);
        }
        return ok({ tabId: tab.id });
    },
});

export const tabPopout = defineCommand({
    name: "tab.popout",
    description:
        "Open a tab in a new browser window (a window layout). `rect` is the window's screen rect; a default is used without one. Refused when the tab does not allow popouts, is pinned or is already in a window.",
    payloadSchema: object(
        {
            tabId: tabIdSchema,
            rect: {
                ...rectSchema,
                description:
                    "the window's screen rect; without one, a 600x400 window offset 50px per open window (engine.popout passes the tab's place on screen)",
            },
        },
        ["tabId"],
    ),
    resultSchema: object({ windowId: describedId("new window") }, ["windowId"]),
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if (isError(tab)) {
            return { ok: false, error: tab };
        }
        if (draft.layoutOf(tab.id) !== MAIN_LAYOUT) {
            return fail(
                "refused",
                `tab "${tab.id}" is already in a window`,
                "/tabId",
            );
        }
        const resolved = resolveTab(draft.getDefaults(), tab);
        if (!resolved.enablePopout) {
            return fail(
                "refused",
                `tab "${tab.id}" does not allow popouts`,
                "/tabId",
            );
        }
        if (resolved.pinned) {
            return fail("refused", `tab "${tab.id}" is pinned`, "/tabId");
        }
        const windowId = draft.newId("window");
        const row = newRow(draft);
        const tabset = newTabset(draft);
        draft.attach(row.id, tabset.id);
        draft.addWindow(
            windowId,
            row.id,
            payload.rect ?? defaultWindowRect(draft.layoutIds().length - 1),
        );
        dropOnTabset(draft, tabset.id, tab.id, "center", 0, true);
        tidy(draft);
        return ok({ windowId });
    },
});

export const tabConfigure = defineCommand({
    name: "tab.configure",
    description:
        "Change a tab's label, behaviour flags and size limits. Absent keys are left as they are. A null flag or limit removes the tab's own value so the layout default applies; the label cannot be removed (a tab always has one).",
    payloadSchema: object(
        {
            tabId: tabIdSchema,
            label: { ...labelSchema, description: "the tab's new name" },
            enableClose: nullable(tabFieldProperties.enableClose),
            enableDrag: nullable(tabFieldProperties.enableDrag),
            enablePopout: nullable(tabFieldProperties.enablePopout),
            minWidth: nullable(tabFieldProperties.minWidth),
            minHeight: nullable(tabFieldProperties.minHeight),
            maxWidth: nullable(tabFieldProperties.maxWidth),
            maxHeight: nullable(tabFieldProperties.maxHeight),
            borderWidth: nullable(tabFieldProperties.borderWidth),
            borderHeight: nullable(tabFieldProperties.borderHeight),
        },
        ["tabId"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if (isError(tab)) {
            return { ok: false, error: tab };
        }
        for (const [key, value] of Object.entries(payload)) {
            if (key !== "tabId" && value !== undefined) {
                draft.set(tab.id, key, value === null ? undefined : value);
            }
        }
        return ok({ tabId: tab.id });
    },
});
