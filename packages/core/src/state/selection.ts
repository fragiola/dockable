// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/Utils.ts (the selection
// math: adjustSelectedIndex, adjustSelectedIndexAfterInsert, restoreSelectionAfterInsert,
// detachDragNode) and TabSetNode/BorderNode.repairSelected, over the draft. Tab groups are gone,
// so a container's selection is a plain child index. Copyright (c) 2017 Caplin Systems Ltd. MIT
// licence, see LICENSE.
import { resolveBorder, resolveTabset } from "./defaults";
import type { Draft } from "./draft";
import type { AnyBorder, AnyTabset } from "./tree";

function container(
    draft: Draft,
    id: string,
): AnyTabset | AnyBorder | undefined {
    const node = draft.get(id);
    return node?.type === "tabset" || node?.type === "border"
        ? node
        : undefined;
}

function setSelected(draft: Draft, id: string, selected: number) {
    draft.set(id, "selected", selected);
}

/** Keeps a container's selection in range: -1 when it has no tabs, else at most the last tab. */
export function repairSelected(draft: Draft, id: string): void {
    const node = container(draft, id);
    if (!node) {
        return;
    }
    const count = node.children.length;
    if (count === 0) {
        setSelected(draft, id, -1);
    } else if (node.selected !== -1 && node.selected >= count) {
        setSelected(draft, id, count - 1);
    } else if (node.selected < -1) {
        setSelected(draft, id, -1);
    }
}

/**
 * After the tab at `removedIndex` left the container: removing the selected tab selects the next
 * one (or the new last), removing one before it shifts the selection.
 */
export function adjustSelectedIndex(
    draft: Draft,
    id: string,
    removedIndex: number,
): void {
    const node = container(draft, id);
    if (!node) {
        return;
    }
    const selected = node.selected;
    if (selected !== -1) {
        const count = node.children.length;
        if (removedIndex === selected && count > 0) {
            if (removedIndex >= count) {
                setSelected(draft, id, count - 1);
            }
            // otherwise the index now names the next tab
        } else if (removedIndex < selected) {
            setSelected(draft, id, selected - 1);
        } else if (removedIndex > selected) {
            // unchanged
        } else {
            setSelected(draft, id, -1);
        }
    }
    repairSelected(draft, id);
}

/** After `count` tabs were inserted at `insertedIndex`, the same tab stays selected. */
export function adjustSelectedIndexAfterInsert(
    draft: Draft,
    id: string,
    insertedIndex: number,
    count = 1,
): void {
    const node = container(draft, id);
    if (!node) {
        return;
    }
    if (count > 0 && node.selected !== -1 && insertedIndex <= node.selected) {
        setSelected(draft, id, node.selected + count);
    }
}

/**
 * Whether a container selects what is inserted into it: a tabset's `autoSelectTab`; a border's
 * `autoSelectTabWhenOpen` while open, `autoSelectTabWhenClosed` while closed.
 */
export function autoSelects(draft: Draft, id: string): boolean {
    const node = container(draft, id);
    if (!node) {
        return false;
    }
    const defaults = draft.getDefaults();
    if (node.type === "tabset") {
        return resolveTabset(defaults, node).autoSelectTab;
    }
    const border = resolveBorder(defaults, node);
    return node.selected !== -1
        ? border.autoSelectTabWhenOpen
        : border.autoSelectTabWhenClosed;
}

/**
 * After inserting `inserted`: it becomes selected when `select` is true, or when `select` is not
 * false and the container auto-selects; otherwise the tab selected before (`selectedTab`) stays
 * selected where it still is.
 */
export function restoreSelectionAfterInsert(
    draft: Draft,
    id: string,
    selectedTab: string | undefined,
    select: boolean | undefined,
    inserted: string | undefined,
): void {
    const node = container(draft, id);
    if (!node) {
        return;
    }
    const indexOf = (tab: string) =>
        (container(draft, id)?.children ?? []).findIndex(
            (child) => child.id === tab,
        );
    if (
        inserted !== undefined &&
        (select === true || (select !== false && autoSelects(draft, id)))
    ) {
        setSelected(draft, id, indexOf(inserted));
    } else if (selectedTab !== undefined) {
        const index = indexOf(selectedTab);
        if (index === -1) {
            repairSelected(draft, id);
        } else {
            setSelected(draft, id, index);
        }
    } else {
        repairSelected(draft, id);
    }
}

/** The selected tab of a container, if any. */
export function selectedTabOf(draft: Draft, id: string): string | undefined {
    const node = container(draft, id);
    if (!node || node.selected < 0) {
        return undefined;
    }
    return node.children[node.selected]?.id;
}

/**
 * Detaches a dragged node from its parent before a drop on `target`, repairing the source's
 * selection. A border whose selected tab leaves for another container closes.
 */
export function detachDragNode(
    draft: Draft,
    dragId: string,
    target: string,
): { dragParent: string | undefined; fromIndex: number } {
    const where = draft.detach(dragId);
    if (!where) {
        return { dragParent: undefined, fromIndex: 0 };
    }
    const parent = draft.get(where.parent);
    if (
        parent?.type === "border" &&
        where.parent !== target &&
        parent.selected === where.index
    ) {
        setSelected(draft, where.parent, -1);
    } else if (parent?.type === "tabset" || parent?.type === "border") {
        adjustSelectedIndex(draft, where.parent, where.index);
    }
    return { dragParent: where.parent, fromIndex: where.index };
}

/** The number of leading pinned tabs of a tabset (the pinned run). */
export function pinnedRunLength(draft: Draft, id: string): number {
    const node = container(draft, id);
    let run = 0;
    for (const child of node?.children ?? []) {
        if (child.pinned !== true) {
            break;
        }
        run++;
    }
    return run;
}
