// The drop rules of FlexLayout's Node.isDockAllowed (src/model/Node.ts), ModelLayout.canDockTo
// (window layouts) and the subtree guards of Model.applyMoveNode, as preconditions of the
// commands that place a tab or a tabset. Ported from FlexLayout
// (https://github.com/caplin/FlexLayout). Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see
// LICENSE.
import type { DockLocation } from "../geometry/dock";
import {
    resolveBorder,
    resolveTab,
    resolveTabset,
    type TabLike,
} from "../state/defaults";
import type { Draft } from "../state/draft";
import type { AnyBorder, AnyRow, AnyTabset } from "../state/tree";
import { MAIN_LAYOUT } from "../state/types";
import { isInSubtree } from "./dock";
import type { CommandError } from "./types";

/** What is being placed. */
export type DropSubject =
    /** an existing tab (`id`), or a new one (`id` undefined) with these fields */
    | { kind: "tab"; id: string | undefined; fields: TabLike }
    | { kind: "tabset"; id: string };

/** A drop target, resolved. */
export type DropTarget = AnyTabset | AnyRow | AnyBorder;

/** The node `to` names: a tabset, a row, a border, or a layout id (its root row). */
export function resolveTarget(
    draft: Draft,
    to: string,
): DropTarget | CommandError {
    const root = draft.rootOf(to);
    const id = root ?? to;
    const node = draft.get(id);
    if (
        node &&
        (node.type === "tabset" ||
            node.type === "row" ||
            node.type === "border") &&
        draft.isAttached(id)
    ) {
        return node;
    }
    return {
        code: "not_found",
        message: `"${to}" is not a tabset, row, border or layout`,
        path: "/to",
    };
}

function refused(message: string, path = "/to"): CommandError {
    return { code: "refused", message, path };
}

/** Why placing `subject` at `target`/`location` is refused, or undefined when it is allowed. */
export function checkDrop(
    draft: Draft,
    subject: DropSubject,
    target: DropTarget,
    location: DockLocation,
): CommandError | undefined {
    const defaults = draft.getDefaults();

    if (target.type === "tabset") {
        const flags = resolveTabset(defaults, target);
        if (location === "center" && !flags.enableDrop) {
            return refused(`tabset "${target.id}" does not accept drops`);
        }
        if (location !== "center" && !flags.enableDivide) {
            return refused(`tabset "${target.id}" cannot be split`);
        }
    } else if (target.type === "border") {
        if (subject.kind !== "tab") {
            return refused(`border "${target.id}" only holds tabs`);
        }
        if (location !== "center") {
            return refused(
                `a border only takes a center drop, not "${location}"`,
                "/location",
            );
        }
        if (!resolveBorder(defaults, target).enableDrop) {
            return refused(`border "${target.id}" does not accept drops`);
        }
    }

    if (subject.kind === "tab") {
        if (target.type === "border" && subject.fields.pinned === true) {
            return refused(
                "a pinned tab can only be in a tabset",
                subject.id === undefined ? "/pinned" : "/tabId",
            );
        }
        if (subject.id !== undefined && subject.fields.pinned === true) {
            const parent = draft.parentOf(subject.id);
            if (target.id !== parent || location !== "center") {
                return refused(
                    `tab "${subject.id}" is pinned: it can only move within its tabset`,
                    "/tabId",
                );
            }
        }
    } else {
        const tabset = draft.tabset(subject.id);
        if (isInSubtree(draft, target.id, subject.id)) {
            return refused(`a tabset cannot be moved into itself`);
        }
        if (tabset && target.type === "tabset" && location === "center") {
            if (!resolveTabset(defaults, tabset).enableClose) {
                return refused(
                    `tabset "${subject.id}" cannot be merged: its enableClose is false`,
                    "/tabsetId",
                );
            }
            if (tabset.children.some((tab) => tab.pinned === true)) {
                return refused(
                    `tabset "${subject.id}" holds pinned tabs and cannot be merged`,
                    "/tabsetId",
                );
            }
        }
    }

    const layout = draft.layoutOf(target.id);
    if (layout !== undefined && layout !== MAIN_LAYOUT) {
        const tabs: TabLike[] =
            subject.kind === "tab"
                ? [subject.fields]
                : [...(draft.tabset(subject.id)?.children ?? [])];
        if (tabs.some((tab) => !resolveTab(defaults, tab).enablePopout)) {
            return refused(
                "a tab that does not allow popouts cannot move into a window",
            );
        }
    }
    return undefined;
}
