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
 * - an empty main layout gets a new empty tabset, which becomes active; an empty window is removed.
 */
export function tidy(draft: Draft): void {
    for (const layout of draft.layoutIds()) {
        const root = draft.rootOf(layout);
        if (root !== undefined) {
            tidyRow(draft, root, layout, true);
        }
    }
}

function tidyRow(draft: Draft, rowId: string, layout: string, isRoot: boolean) {
    let i = 0;
    for (;;) {
        const row = draft.row(rowId);
        const child = row?.children[i];
        if (!row || !child) {
            break;
        }
        if (child.type === "row") {
            tidyRow(draft, child.id, layout, false);
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
                if (draft.getMaximized(layout) === child.id) {
                    draft.setMaximized(layout, undefined);
                }
            } else {
                i++;
            }
        } else {
            i++;
        }
    }

    const row = draft.row(rowId);
    if (isRoot && row && row.children.length === 0) {
        if (layout === MAIN_LAYOUT) {
            const tabset = newTabset(draft);
            draft.attach(rowId, tabset.id);
            draft.setActive(layout, tabset.id);
        } else {
            draft.removeWindow(layout);
        }
    }
}
