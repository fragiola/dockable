// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/RowNode.ts (tidy) and
// src/model/Model.ts (tidy of every layout), over the draft. Copyright (c) 2017 Caplin Systems
// Ltd. MIT licence, see LICENSE.
import { resolveTabset } from "./defaults";
import { type Draft, newTabset } from "./draft";
import { MAIN_LAYOUT } from "./types";

/**
 * Tidies every layout, as FlexLayout does after each change:
 * - a row with no children is removed;
 * - a row with one child is replaced by that child (a tabset takes the row's weight; a row's
 *   children are hoisted, their weights scaled to the row's);
 * - an empty tabset is removed when it may be (`deleteWhenEmpty` and `enableClose`), clearing a
 *   maximize that pointed at it;
 * - the main layout keeps a tabset: when tidy would leave it with none, the first empty tabset it
 *   removed stays, with its id (caplin/FlexLayout#291; FlexLayout makes a new one), else a new
 *   empty tabset is made; either becomes active. An empty window is removed.
 */
export function tidy(draft: Draft): void {
    for (const layout of draft.layoutIds()) {
        const root = draft.rootOf(layout);
        if (root === undefined) {
            continue;
        }
        const removed: string[] = [];
        tidyRow(draft, root, removed);
        if (draft.row(root)?.children.length === 0) {
            if (layout !== MAIN_LAYOUT) {
                draft.removeWindow(layout);
                continue;
            }
            const kept = removed.shift() ?? newTabset(draft).id;
            draft.attach(root, kept);
            draft.setActive(layout, kept);
        }
        const maximized = draft.getMaximized(layout);
        if (maximized !== undefined && removed.includes(maximized)) {
            draft.setMaximized(layout, undefined);
        }
    }
}

/** tidies a row and its descendants; the empty tabsets it removes are added to `removed` */
function tidyRow(draft: Draft, rowId: string, removed: string[]) {
    let i = 0;
    for (;;) {
        const row = draft.row(rowId);
        const child = row?.children[i];
        if (!row || !child) {
            break;
        }
        if (child.type === "row") {
            tidyRow(draft, child.id, removed);
            const grandchildren = draft.row(child.id)?.children ?? [];
            if (grandchildren.length === 0) {
                draft.detach(child.id);
            } else if (grandchildren.length === 1) {
                // hoist the only child up to this level
                const only = grandchildren[0];
                draft.detach(child.id);
                if (only?.type === "row") {
                    const hoisted = [...only.children];
                    const total = hoisted.reduce(
                        (sum, item) => sum + item.weight,
                        0,
                    );
                    for (const [j, item] of hoisted.entries()) {
                        // all-zero weights (possible from JSON) are spread evenly
                        const weight =
                            total === 0
                                ? child.weight / hoisted.length
                                : (child.weight * item.weight) / total;
                        draft.set(item.id, "weight", weight);
                        draft.attach(rowId, item.id, i + j);
                    }
                } else if (only) {
                    draft.set(only.id, "weight", child.weight);
                    draft.attach(rowId, only.id, i);
                }
            } else {
                i++;
            }
        } else if (child.children.length === 0) {
            const resolved = resolveTabset(draft.getDefaults(), child);
            if (resolved.deleteWhenEmpty && resolved.enableClose) {
                draft.detach(child.id);
                removed.push(child.id);
            } else {
                i++;
            }
        } else {
            i++;
        }
    }
}
