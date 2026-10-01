import { describedId, idSchema, object, rectSchema } from "../schema/fragments";
import { type Draft, newTabset } from "../state/draft";
import { tidy } from "../state/tidy";
import { type AnyNode, childrenOf } from "../state/tree";
import { MAIN_LAYOUT } from "../state/types";
import { defineCommand, fail, ok } from "./define";
import { dropOnTabset } from "./dock";

const windowIdSchema = {
    ...idSchema,
    description: "the window layout's id",
} as const;

/** The tabs of a subtree, in tree order. */
function tabsBelow(draft: Draft, id: string): string[] {
    const tabs: string[] = [];
    const visit = (node: AnyNode | undefined) => {
        if (!node) {
            return;
        }
        if (node.type === "tab") {
            tabs.push(node.id);
            return;
        }
        for (const child of childrenOf(node)) {
            visit(draft.get(child.id));
        }
    };
    visit(draft.get(id));
    return tabs;
}

/**
 * Where tabs docked back from a window go: the main layout's active tabset, else its first tabset
 * (a new one when it has none, which only a batch in progress can leave).
 */
export function dockTarget(draft: Draft): string {
    const active = draft.getActive(MAIN_LAYOUT);
    if (active !== undefined && draft.layoutOf(active) === MAIN_LAYOUT) {
        return active;
    }
    const root = draft.rootOf(MAIN_LAYOUT);
    const first = (id: string | undefined): string | undefined => {
        const node = id === undefined ? undefined : draft.get(id);
        if (!node || node.type === "tab" || node.type === "border") {
            return undefined;
        }
        if (node.type === "tabset") {
            return node.id;
        }
        for (const child of node.children) {
            const found = first(child.id);
            if (found !== undefined) {
                return found;
            }
        }
        return undefined;
    };
    const found = first(root);
    if (found !== undefined) {
        return found;
    }
    const tabset = newTabset(draft);
    if (root !== undefined) {
        draft.attach(root, tabset.id);
    }
    return tabset.id;
}

export const windowClose = defineCommand({
    name: "window.close",
    description:
        "Close a popout window layout: its tabs move back into the main layout's active tabset (its first tabset when none is active), and the window closes.",
    payloadSchema: object({ windowId: windowIdSchema }, ["windowId"]),
    resultSchema: object(
        {
            tabIds: {
                type: "array",
                items: idSchema,
                description:
                    "the ids of the tabs moved back into the main layout",
            },
        },
        ["tabIds"],
    ),
    transient: false,
    reduce(payload, { draft }) {
        const root =
            payload.windowId === MAIN_LAYOUT
                ? undefined
                : draft.rootOf(payload.windowId);
        if (root === undefined) {
            return fail(
                "not_found",
                `no window "${payload.windowId}"`,
                "/windowId",
            );
        }
        const tabs = tabsBelow(draft, root);
        const target = dockTarget(draft);
        for (const tab of tabs) {
            dropOnTabset(draft, target, tab, "center", -1, undefined);
        }
        draft.removeWindow(payload.windowId);
        tidy(draft);
        return ok({ tabIds: tabs });
    },
});

export const windowConfigure = defineCommand({
    name: "window.configure",
    description:
        "Record a popout window's screen rect (the engine does this when the window moves or resizes, so a saved layout reopens it in place).",
    payloadSchema: object(
        {
            windowId: windowIdSchema,
            rect: { ...rectSchema, description: "the window's screen rect" },
        },
        ["windowId", "rect"],
    ),
    resultSchema: object({ windowId: describedId("window") }, ["windowId"]),
    transient: true,
    reduce(payload, { draft }) {
        if (
            payload.windowId === MAIN_LAYOUT ||
            draft.rootOf(payload.windowId) === undefined
        ) {
            return fail(
                "not_found",
                `no window "${payload.windowId}"`,
                "/windowId",
            );
        }
        const current = draft.windowRect(payload.windowId);
        const { x, y, width, height } = payload.rect;
        if (
            !current ||
            current.x !== x ||
            current.y !== y ||
            current.width !== width ||
            current.height !== height
        ) {
            draft.setWindowRect(payload.windowId, { x, y, width, height });
        }
        return ok({ windowId: payload.windowId });
    },
});
