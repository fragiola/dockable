import type { DockLocation } from "../geometry/dock";
import {
    booleanSchema,
    dataSchema,
    describedId,
    idSchema,
    labelSchema,
    nullableEach,
    object,
    placementProperties,
    rectSchema,
    tabBorderSizeProperties,
    tabDefaultProperties,
    tabFieldProperties,
} from "../schema/fragments";
import { isObject } from "../schema/validator";
import { cloneJson } from "../state/clone";
import { resolveTab } from "../state/defaults";
import { type Draft, newRow, newTabset } from "../state/draft";
import { defaultWindowRect, tabNode } from "../state/load";
import {
    adjustSelectedIndex,
    pinnedRunLength,
    repairSelected,
    selectedTabOf,
} from "../state/selection";
import { tidy } from "../state/tidy";
import type { AnyTab } from "../state/tree";
import { MAIN_LAYOUT } from "../state/types";
import { defineCommand, type Failure, fail, ok } from "./define";
import { dropOnBorder, dropOnRow, dropOnTabset } from "./dock";
import { checkDrop, type DropTarget, resolveTarget } from "./rules";

const tabIdResult = object({ tabId: describedId("tab") }, ["tabId"]);

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

/** The tab `id` in the tree, or why not. */
function attachedTab(draft: Draft, id: string): AnyTab | Failure {
    const tab = draft.tab(id);
    if (!tab || !draft.isAttached(id)) {
        return fail("not_found", `no tab "${id}"`, "/tabId");
    }
    return tab;
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
        if ("error" in target) {
            return target;
        }
        if (payload.id !== undefined && draft.isUsed(payload.id)) {
            return fail(
                "refused",
                `the id "${payload.id}" is already in use`,
                "/id",
            );
        }
        const invalid = validateData(payload.component, payload.data);
        if (invalid) {
            return invalid;
        }
        const location = payload.location ?? "center";
        const refused = checkDrop(
            draft,
            { kind: "tab", id: undefined, fields: payload },
            target,
            location,
        );
        if (refused) {
            return refused;
        }
        const tab = draft.create(
            tabNode(payload, payload.id ?? draft.newId("tab")),
        );
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
    payloadSchema: object({ tabId: describedId("tab") }, ["tabId"]),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if ("error" in tab) {
            return tab;
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
        "Close a tab and remove it from the layout. Refused for a pinned tab or one that is not closable.",
    payloadSchema: object({ tabId: describedId("tab") }, ["tabId"]),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if ("error" in tab) {
            return tab;
        }
        const resolved = resolveTab(draft.getDefaults(), tab);
        if (resolved.pinned) {
            return fail("refused", `tab "${tab.id}" is pinned`, "/tabId");
        }
        if (!resolved.closable) {
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
    payloadSchema: object(
        { tabId: describedId("tab"), ...placementProperties },
        ["tabId", "to"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if ("error" in tab) {
            return tab;
        }
        if (!resolveTab(draft.getDefaults(), tab).draggable) {
            return fail("refused", `tab "${tab.id}" cannot be moved`, "/tabId");
        }
        const target = resolveTarget(draft, payload.to);
        if ("error" in target) {
            return target;
        }
        const location = payload.location ?? "center";
        const refused = checkDrop(
            draft,
            { kind: "tab", id: tab.id, fields: tab },
            target,
            location,
        );
        if (refused) {
            return refused;
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
        "Change some of a tab's data: `data` is a shallow patch, whose top-level keys replace the tab's while the others stay (none is removed). The merged data is validated when the app registered a schema for the tab's component. To switch the component, use `tab.set-component`.",
    payloadSchema: object(
        {
            tabId: describedId("tab"),
            data: {
                type: "object",
                description:
                    "the keys to change; each replaces the tab's own (a shallow merge)",
            },
        },
        ["tabId", "data"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft, validateData }) {
        const tab = attachedTab(draft, payload.tabId);
        if ("error" in tab) {
            return tab;
        }
        const current = tab.data ?? {};
        if (!isObject(current)) {
            return fail(
                "invalid_payload",
                `the data of tab "${tab.id}" is not an object: replace it with tab.set-component`,
                "/data",
            );
        }
        // only the patch is copied (the kept keys are the state's own); a spread defines own
        // keys, and an undefined value, dropped by the copy, changes nothing
        const data = { ...current, ...cloneJson(payload.data) };
        const invalid = validateData(tab.component, data);
        if (invalid) {
            return invalid;
        }
        draft.set(tab.id, "data", data);
        return ok({ tabId: tab.id });
    },
});

export const tabSetComponent = defineCommand({
    name: "tab.set-component",
    description:
        "Switch a tab to another component (or reset it to its own): `data` is the component's whole new value, validated when the app registered a schema for that component. The tab keeps its id, label and place.",
    payloadSchema: object(
        {
            tabId: describedId("tab"),
            component: {
                type: "string",
                minLength: 1,
                description:
                    "the tab's new component (a key of the app's registry)",
            },
            data: { ...dataSchema, description: "the component's whole data" },
        },
        ["tabId", "component"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft, validateData }) {
        const tab = attachedTab(draft, payload.tabId);
        if ("error" in tab) {
            return tab;
        }
        const invalid = validateData(payload.component, payload.data);
        if (invalid) {
            return invalid;
        }
        draft.set(tab.id, "component", payload.component);
        draft.set(tab.id, "data", cloneJson(payload.data));
        return ok({ tabId: tab.id });
    },
});

export const tabPin = defineCommand({
    name: "tab.pin",
    description:
        "Pin (value true) or unpin a tab of a tabset. Pinned tabs sit at the start of the strip, cannot be closed and cannot be dragged out of their tabset.",
    payloadSchema: object(
        {
            tabId: describedId("tab"),
            value: { ...booleanSchema, description: "true pins, false unpins" },
        },
        ["tabId", "value"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if ("error" in tab) {
            return tab;
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
            tabId: describedId("tab"),
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
        if ("error" in tab) {
            return tab;
        }
        if (draft.layoutOf(tab.id) !== MAIN_LAYOUT) {
            return fail(
                "refused",
                `tab "${tab.id}" is already in a window`,
                "/tabId",
            );
        }
        const resolved = resolveTab(draft.getDefaults(), tab);
        if (!resolved.poppable) {
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

export const tabRename = defineCommand({
    name: "tab.rename",
    description:
        "Change a tab's label. Refused for a tab that is not renamable (its own `renamable`, else the layout default).",
    payloadSchema: object(
        {
            tabId: describedId("tab"),
            label: { ...labelSchema, description: "the tab's new name" },
        },
        ["tabId", "label"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if ("error" in tab) {
            return tab;
        }
        if (!resolveTab(draft.getDefaults(), tab).renamable) {
            return fail(
                "refused",
                `tab "${tab.id}" cannot be renamed`,
                "/tabId",
            );
        }
        draft.set(tab.id, "label", payload.label);
        return ok({ tabId: tab.id });
    },
});

export const tabConfigure = defineCommand({
    name: "tab.configure",
    description:
        "Change a tab's behaviour flags and size limits. Absent keys are left as they are. A null flag or limit removes the tab's own value so the layout default applies. The label changes with `tab.rename`.",
    payloadSchema: object(
        {
            tabId: describedId("tab"),
            ...nullableEach({
                ...tabDefaultProperties,
                ...tabBorderSizeProperties,
            }),
        },
        ["tabId"],
    ),
    resultSchema: tabIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tab = attachedTab(draft, payload.tabId);
        if ("error" in tab) {
            return tab;
        }
        for (const [key, value] of Object.entries(payload)) {
            if (key !== "tabId" && value !== undefined) {
                draft.set(tab.id, key, value === null ? undefined : value);
            }
        }
        return ok({ tabId: tab.id });
    },
});
