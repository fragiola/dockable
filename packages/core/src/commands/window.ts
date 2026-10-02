import { describedId, idSchema, object, rectSchema } from "../schema/fragments";
import { type Draft, newTabset } from "../state/draft";
import { tidy } from "../state/tidy";
import { defaultTabset, walk } from "../state/tree";
import { MAIN_LAYOUT } from "../state/types";
import { defineCommand, fail, ok } from "./define";
import { dropOnTabset } from "./dock";

/** The tabs of a subtree, in tree order. */
function tabsBelow(draft: Draft, id: string): string[] {
    const tabs: string[] = [];
    const node = draft.get(id);
    if (node) {
        walk(node, (visited) => {
            if (visited.type === "tab") {
                tabs.push(visited.id);
            }
        });
    }
    return tabs;
}

/** Where tabs docked back from a window go: the main layout's default tabset, else a new one. */
function dockTarget(draft: Draft): string {
    const root = draft.rootOf(MAIN_LAYOUT);
    const found = defaultTabset(
        draft,
        MAIN_LAYOUT,
        root,
        draft.getActive(MAIN_LAYOUT),
    );
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
    payloadSchema: object({ windowId: describedId("window layout") }, [
        "windowId",
    ]),
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
            windowId: describedId("window layout"),
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
