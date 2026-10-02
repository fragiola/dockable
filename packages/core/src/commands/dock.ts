// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/TabSetNode.ts (drop),
// src/model/RowNode.ts (drop) and src/model/BorderNode.ts (drop), over the draft. Tab groups,
// floats and sub-layouts are gone. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import {
    type DockLocation,
    dockIndexPlus,
    dockOrientation,
    flip,
    type Orientation,
} from "../geometry/dock";
import { resolveLayout } from "../state/defaults";
import { type Draft, newRow, newTabset } from "../state/draft";
import {
    adjustSelectedIndexAfterInsert,
    detachDragNode,
    pinnedRunLength,
    repairSelected,
    restoreSelectionAfterInsert,
    selectedTabOf,
} from "../state/selection";

/** Whether `id` is `ancestor` or below it. */
export function isInSubtree(
    draft: Draft,
    id: string,
    ancestor: string,
): boolean {
    for (
        let current: string | undefined = id;
        current !== undefined;
        current = draft.parentOf(current)
    ) {
        if (current === ancestor) {
            return true;
        }
    }
    return false;
}

/** The orientation of a row: its layout's root orientation, flipped at every level below. */
export function rowOrientation(draft: Draft, rowId: string): Orientation {
    let orientation = resolveLayout(draft.getDefaults()).rootOrientation;
    for (
        let parent = draft.parentOf(rowId);
        parent !== undefined;
        parent = draft.parentOf(parent)
    ) {
        orientation = flip(orientation);
    }
    return orientation;
}

/** Makes `tabset` the active tabset of its layout. */
function activate(draft: Draft, tabset: string) {
    const layout = draft.layoutOf(tabset);
    if (layout !== undefined) {
        draft.setActive(layout, tabset);
    }
}

/**
 * Drops a tab or a tabset on a tabset (FlexLayout's `TabSetNode.drop`). Center: the tab is
 * inserted at `index` (clamped to the pinned run), or the tabset's tabs are merged in. An edge:
 * a new tabset holding the tab (or the tabset itself) is placed beside the target, splitting its
 * weight along the row, or both are wrapped in a new row across it. Returns the tabset that now
 * holds what was dropped.
 */
export function dropOnTabset(
    draft: Draft,
    target: string,
    dragId: string,
    location: DockLocation,
    index: number,
    select?: boolean,
): string {
    if (isInSubtree(draft, target, dragId)) {
        return target; // a tabset dropped into itself: nothing to do
    }
    const drag = draft.get(dragId);
    const selectedTab = selectedTabOf(draft, target);
    const { dragParent, fromIndex } = detachDragNode(draft, dragId, target);

    // moving forward within the same tabset: the removal shifted the insertion point
    let at = index;
    if (
        drag?.type === "tab" &&
        dragParent === target &&
        fromIndex < at &&
        at > 0
    ) {
        at--;
    }

    if (location === "center") {
        const children = draft.tabset(target)?.children ?? [];
        let insert = at === -1 ? children.length : at;
        // keep the pinned tabs grouped at the start
        const run = pinnedRunLength(draft, target);
        if (drag?.type === "tab") {
            insert =
                drag.pinned === true
                    ? Math.min(insert, run)
                    : Math.max(insert, run);
            draft.attach(target, dragId, insert);
            restoreSelectionAfterInsert(
                draft,
                target,
                selectedTab,
                select,
                dragId,
            );
        } else if (drag?.type === "tabset") {
            insert = Math.max(insert, run);
            const first = insert;
            for (const tab of [...drag.children]) {
                draft.attach(target, tab.id, insert);
                insert++;
            }
            adjustSelectedIndexAfterInsert(
                draft,
                target,
                first,
                insert - first,
            );
            const merged = draft.tabset(target);
            if (
                merged &&
                merged.selected === -1 &&
                merged.children.length > 0
            ) {
                draft.set(target, "selected", 0);
            }
        }
        activate(draft, target);
        return target;
    }

    let moved: string;
    if (drag?.type === "tab") {
        const tabset = newTabset(draft);
        draft.attach(tabset.id, dragId);
        draft.set(tabset.id, "selected", 0);
        moved = tabset.id;
    } else {
        moved = dragId;
    }
    const parentRow = draft.parentOf(target);
    const row = parentRow === undefined ? undefined : draft.row(parentRow);
    if (parentRow === undefined || !row) {
        return moved;
    }
    const position = row.children.findIndex((child) => child.id === target);
    const targetWeight =
        draft.get(target)?.type === "tabset"
            ? (draft.tabset(target)?.weight ?? 100)
            : 100;
    if (rowOrientation(draft, parentRow) === dockOrientation(location)) {
        draft.set(moved, "weight", targetWeight / 2);
        draft.set(target, "weight", targetWeight / 2);
        draft.attach(parentRow, moved, position + dockIndexPlus(location));
    } else {
        // a new row across the parent's orientation holds the target and the new tabset
        const wrapper = newRow(draft, targetWeight);
        draft.detach(target);
        draft.attach(wrapper.id, target);
        draft.set(target, "weight", 50);
        draft.set(moved, "weight", 50);
        draft.attach(wrapper.id, moved, dockIndexPlus(location));
        draft.attach(parentRow, wrapper.id, position);
    }
    activate(draft, moved);
    return moved;
}

/**
 * Drops a tab or a tabset on a row (FlexLayout's `RowNode.drop`). Center: it is inserted at
 * `index` (a tab in a new tabset). An edge along the row's orientation: first or last. An edge
 * across it: the row's children move into a new row beside the dropped one. The dropped node takes
 * a third of the row's total weight. Returns the tabset that now holds what was dropped.
 */
export function dropOnRow(
    draft: Draft,
    target: string,
    dragId: string,
    location: DockLocation,
    index: number,
): string {
    if (isInSubtree(draft, target, dragId)) {
        return dragId;
    }
    const drag = draft.get(dragId);
    const where = draft.detach(dragId);
    if (where) {
        const parent = draft.get(where.parent);
        if (parent?.type === "tabset") {
            // FlexLayout selects the source tabset's first tab
            draft.set(where.parent, "selected", 0);
            repairSelected(draft, where.parent);
        } else if (parent?.type === "border") {
            draft.set(where.parent, "selected", -1);
        }
    }

    let node: string;
    if (drag?.type === "tab") {
        const tabset = newTabset(draft);
        draft.attach(tabset.id, dragId);
        draft.set(tabset.id, "selected", 0);
        node = tabset.id;
    } else {
        node = dragId;
    }

    const children = draft.row(target)?.children ?? [];
    let total = children.reduce((sum, child) => sum + child.weight, 0);
    if (total === 0) {
        total = 100;
    }
    draft.set(node, "weight", total / 3);

    const horizontal = rowOrientation(draft, target) === "horizontal";
    if (location === "center") {
        draft.attach(target, node, index === -1 ? children.length : index);
    } else if (
        (horizontal && location === "start") ||
        (!horizontal && location === "top")
    ) {
        draft.attach(target, node, 0);
    } else if (
        (horizontal && location === "end") ||
        (!horizontal && location === "bottom")
    ) {
        draft.attach(target, node);
    } else {
        // across the row: its children move into a new row beside the dropped node
        const outer = newRow(draft);
        const inner = newRow(draft, 75);
        draft.set(node, "weight", 25);
        for (const child of [...(draft.row(target)?.children ?? [])]) {
            draft.attach(inner.id, child.id);
        }
        const before =
            (horizontal && location === "top") ||
            (!horizontal && location === "start");
        if (before) {
            draft.attach(outer.id, node);
            draft.attach(outer.id, inner.id);
        } else {
            draft.attach(outer.id, inner.id);
            draft.attach(outer.id, node);
        }
        draft.attach(target, outer.id);
    }
    if (draft.get(node)?.type === "tabset") {
        activate(draft, node);
    }
    return node;
}

/** Drops a tab on a border's strip at `index` (FlexLayout's `BorderNode.drop`). */
export function dropOnBorder(
    draft: Draft,
    target: string,
    dragId: string,
    index: number,
    select?: boolean,
): void {
    if (draft.get(dragId)?.type !== "tab") {
        return;
    }
    const selectedTab = selectedTabOf(draft, target);
    const { dragParent, fromIndex } = detachDragNode(draft, dragId, target);
    let at = index;
    if (dragParent === target && fromIndex < at && at > 0) {
        at--;
    }
    const children = draft.border(target)?.children ?? [];
    draft.attach(target, dragId, at === -1 ? children.length : at);
    restoreSelectionAfterInsert(draft, target, selectedTab, select, dragId);
}
