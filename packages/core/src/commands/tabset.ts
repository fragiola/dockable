import {
    booleanSchema,
    dataSchema,
    describedId,
    dockLocationSchema,
    idSchema,
    indexSchema,
    nullableEach,
    object,
    rectSchema,
    tabsetDefaultProperties,
} from "../schema/fragments";
import { cloneJson } from "../state/clone";
import { resolveTab, resolveTabset } from "../state/defaults";
import { type Draft, newRow } from "../state/draft";
import { defaultWindowRect } from "../state/load";
import { adjustSelectedIndex } from "../state/selection";
import { tidy } from "../state/tidy";
import type { AnyTabset } from "../state/tree";
import { MAIN_LAYOUT } from "../state/types";
import { defineCommand, type Failure, fail, ok } from "./define";
import { dropOnRow } from "./dock";
import { checkDrop, resolveTarget } from "./rules";
import { place } from "./tab";

const tabsetIdResult = object({ tabsetId: describedId("tabset") }, [
    "tabsetId",
]);

/** The tabset `id` in the tree, or why not. */
function attachedTabset(draft: Draft, id: string): AnyTabset | Failure {
    const tabset = draft.tabset(id);
    if (!tabset || !draft.isAttached(id)) {
        return fail("not_found", `no tabset "${id}"`, "/tabsetId");
    }
    return tabset;
}

export const tabsetActivate = defineCommand({
    name: "tabset.activate",
    description: "Make a tabset the active one of its layout.",
    payloadSchema: object({ tabsetId: describedId("tabset") }, ["tabsetId"]),
    resultSchema: tabsetIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tabset = attachedTabset(draft, payload.tabsetId);
        if ("error" in tabset) {
            return tabset;
        }
        const layout = draft.layoutOf(tabset.id);
        if (layout !== undefined) {
            draft.setActive(layout, tabset.id);
        }
        return ok({ tabsetId: tabset.id });
    },
});

export const tabsetMaximize = defineCommand({
    name: "tabset.maximize",
    description:
        "Maximize a tabset so it fills its layout (value true), or restore it (value false). Maximizing also makes it active. Refused when the tabset does not allow it or is the only tabset of its layout.",
    payloadSchema: object(
        {
            tabsetId: describedId("tabset"),
            value: {
                ...booleanSchema,
                description: "true maximizes, false restores",
            },
        },
        ["tabsetId", "value"],
    ),
    resultSchema: tabsetIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tabset = attachedTabset(draft, payload.tabsetId);
        if ("error" in tabset) {
            return tabset;
        }
        const layout = draft.layoutOf(tabset.id) ?? MAIN_LAYOUT;
        const maximized = draft.getMaximized(layout) === tabset.id;
        if (!payload.value) {
            if (maximized) {
                draft.setMaximized(layout, undefined);
            }
            return ok({ tabsetId: tabset.id });
        }
        if (!maximized) {
            if (!resolveTabset(draft.getDefaults(), tabset).maximizable) {
                return fail(
                    "refused",
                    `tabset "${tabset.id}" cannot be maximized`,
                    "/tabsetId",
                );
            }
            const root = draft.rootOf(layout);
            const rootRow = root === undefined ? undefined : draft.row(root);
            if (
                rootRow &&
                rootRow.children.length === 1 &&
                rootRow.children[0]?.id === tabset.id
            ) {
                return fail(
                    "refused",
                    `tabset "${tabset.id}" is the only tabset of its layout`,
                    "/tabsetId",
                );
            }
        }
        draft.setMaximized(layout, tabset.id);
        draft.setActive(layout, tabset.id);
        return ok({ tabsetId: tabset.id });
    },
});

export const tabsetClose = defineCommand({
    name: "tabset.close",
    description:
        "Close a tabset: its closable tabs close, and the tabset is removed once empty. Refused when the tabset is not closable.",
    payloadSchema: object({ tabsetId: describedId("tabset") }, ["tabsetId"]),
    resultSchema: object(
        {
            closedTabIds: {
                type: "array",
                items: idSchema,
                description: "the ids of the tabs that closed",
            },
        },
        ["closedTabIds"],
    ),
    transient: false,
    reduce(payload, { draft }) {
        const tabset = attachedTabset(draft, payload.tabsetId);
        if ("error" in tabset) {
            return tabset;
        }
        const defaults = draft.getDefaults();
        if (!resolveTabset(defaults, tabset).closable) {
            return fail(
                "refused",
                `tabset "${tabset.id}" cannot be closed`,
                "/tabsetId",
            );
        }
        const closed: string[] = [];
        for (const tab of [...tabset.children]) {
            const resolved = resolveTab(defaults, tab);
            if (resolved.closable && !resolved.pinned) {
                const where = draft.detach(tab.id);
                if (where) {
                    adjustSelectedIndex(draft, where.parent, where.index);
                }
                closed.push(tab.id);
            }
        }
        if ((draft.tabset(tabset.id)?.children.length ?? 0) === 0) {
            draft.detach(tabset.id);
        }
        tidy(draft);
        return ok({ closedTabIds: closed });
    },
});

export const tabsetMove = defineCommand({
    name: "tabset.move",
    description:
        "Move a whole tabset: merge its tabs into another tabset (location center), place it beside a tabset (an edge), or dock it to an edge of a layout.",
    payloadSchema: object(
        {
            tabsetId: describedId("tabset"),
            to: {
                ...idSchema,
                description: "a tabset, a row, or a layout id (its root row)",
            },
            location: {
                ...dockLocationSchema,
                description:
                    "center (default) merges its tabs into the target; an edge of a tabset places it beside; an edge of a row docks it there",
            },
            index: {
                ...indexSchema,
                description: "for a merge: where its tabs go; -1 appends",
            },
        },
        ["tabsetId", "to"],
    ),
    resultSchema: tabsetIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tabset = attachedTabset(draft, payload.tabsetId);
        if ("error" in tabset) {
            return tabset;
        }
        if (!resolveTabset(draft.getDefaults(), tabset).draggable) {
            return fail(
                "refused",
                `tabset "${tabset.id}" cannot be moved`,
                "/tabsetId",
            );
        }
        const target = resolveTarget(draft, payload.to);
        if ("error" in target) {
            return target;
        }
        const location = payload.location ?? "center";
        const refused = checkDrop(
            draft,
            { kind: "tabset", id: tabset.id },
            target,
            location,
        );
        if (refused) {
            return refused;
        }
        // a moved subtree that holds the maximized tabset cannot stay maximized
        const from = draft.layoutOf(tabset.id);
        if (from !== undefined && draft.getMaximized(from) === tabset.id) {
            draft.setMaximized(from, undefined);
        }
        const holder = place(
            draft,
            target,
            tabset.id,
            location,
            payload.index ?? -1,
            undefined,
        );
        tidy(draft);
        return ok({ tabsetId: holder });
    },
});

export const tabsetPopout = defineCommand({
    name: "tabset.popout",
    description:
        "Open a whole tabset in a new browser window. Refused when any of its tabs does not allow popouts, when it is empty, or when it is already in a window.",
    payloadSchema: object(
        {
            tabsetId: describedId("tabset"),
            rect: {
                ...rectSchema,
                description:
                    "the window's screen rect; without one, a 600x400 window offset 50px per open window (engine.popout passes the tabset's place on screen)",
            },
        },
        ["tabsetId"],
    ),
    resultSchema: object({ windowId: describedId("new window") }, ["windowId"]),
    transient: false,
    reduce(payload, { draft }) {
        const tabset = attachedTabset(draft, payload.tabsetId);
        if ("error" in tabset) {
            return tabset;
        }
        const layout = draft.layoutOf(tabset.id);
        if (layout !== MAIN_LAYOUT) {
            return fail(
                "refused",
                `tabset "${tabset.id}" is already in a window`,
                "/tabsetId",
            );
        }
        if (tabset.children.length === 0) {
            return fail(
                "refused",
                `tabset "${tabset.id}" is empty`,
                "/tabsetId",
            );
        }
        const defaults = draft.getDefaults();
        if (
            tabset.children.some((tab) => !resolveTab(defaults, tab).poppable)
        ) {
            return fail(
                "refused",
                `a tab of tabset "${tabset.id}" does not allow popouts`,
                "/tabsetId",
            );
        }
        if (draft.getMaximized(layout) === tabset.id) {
            draft.setMaximized(layout, undefined);
        }
        const windowId = draft.newId("window");
        const row = newRow(draft);
        draft.addWindow(
            windowId,
            row.id,
            payload.rect ?? defaultWindowRect(draft.layoutIds().length - 1),
        );
        dropOnRow(draft, row.id, tabset.id, "center", 0);
        tidy(draft);
        return ok({ windowId });
    },
});

export const tabsetConfigure = defineCommand({
    name: "tabset.configure",
    description:
        "Change a tabset's behaviour flags, size limits or data. A null value removes the tabset's own value so the layout default applies (data: null removes the data).",
    payloadSchema: object(
        {
            tabsetId: describedId("tabset"),
            ...nullableEach(tabsetDefaultProperties),
            data: dataSchema,
        },
        ["tabsetId"],
    ),
    resultSchema: tabsetIdResult,
    transient: false,
    reduce(payload, { draft }) {
        const tabset = attachedTabset(draft, payload.tabsetId);
        if ("error" in tabset) {
            return tabset;
        }
        for (const [key, value] of Object.entries(payload)) {
            if (key !== "tabsetId" && value !== undefined) {
                draft.set(
                    tabset.id,
                    key,
                    value === null ? undefined : cloneJson(value),
                );
            }
        }
        return ok({ tabsetId: tabset.id });
    },
});
