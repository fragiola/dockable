// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/Model.ts
// (findDropTargetNode), src/model/Node.ts (findDropTargetNode), src/model/RowNode.ts,
// src/model/TabSetNode.ts and src/model/BorderNode.ts (canDrop), src/model/BorderSet.ts
// (findDropTargetNode): the drop targets under a point, in FlexLayout's order, over the state and
// the measured rects. Whether a target accepts the drop is the model's (`model.can`), not decided
// here. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import {
    type DockLocation,
    dockLocationAt,
    dockRect,
    edgeAt,
} from "../geometry/dock";
import { contains, type Rect } from "../geometry/rect";
import { resolveBorder, resolveTabset } from "../state/defaults";
import type { AnyBorder, AnyRow, AnyState, AnyTabset } from "../state/tree";
import { MAIN_LAYOUT } from "../state/types";
import { clampToPinnedRun, findStripDrop } from "./strip";

/** The measured rects a drop is resolved with, relative to the layout's root element. */
export interface DropGeometry {
    /** a row's or a tabset's rect */
    node(id: string): Rect | undefined;
    /** a tabset's tab strip */
    tabStrip(id: string): Rect | undefined;
    /** a tabset's content area */
    content(id: string): Rect | undefined;
    /** a tab button */
    tabButton(id: string): Rect | undefined;
    /** a border's strip */
    borderStrip(id: string): Rect | undefined;
    /** a border's panel area */
    borderContent(id: string): Rect | undefined;
}

/** What is being dragged. */
export type DropSubjectKind =
    /** a tab of the layout (`id`), pinned or not */
    | { kind: "tab"; id: string; pinned: boolean }
    /** a whole tabset */
    | { kind: "tabset"; id: string }
    /** a new tab (a drag source, a foreign drag) */
    | { kind: "new"; pinned: boolean };

/** A place a drop could go. */
export interface DropCandidate {
    /** the target node: a tabset, a row (edge docking) or a border */
    readonly target: string;
    readonly location: DockLocation;
    /** the insertion index in the target's strip, or -1 */
    readonly index: number;
    /** the outline to show */
    readonly rect: Rect;
    /** `"edge"` for a drop at a layout's edge */
    readonly kind: "rect" | "edge";
    /** the tabset (or border) the drop goes into or beside, if any */
    readonly container: string | undefined;
    /** a tabset dropped on its own strip: accepted, and changes nothing */
    readonly self: boolean;
}

export interface DropOptions {
    /** no center drops (a tabset that cannot merge) */
    readonly excludeCenter: boolean;
}

function tabsetCandidate(
    state: AnyState,
    tabset: AnyTabset,
    geometry: DropGeometry,
    subject: DropSubjectKind,
    x: number,
    y: number,
    maximized: boolean,
    options: DropOptions,
): DropCandidate | undefined {
    const rect = geometry.node(tabset.id);
    if (!rect) {
        return undefined;
    }
    const strip = geometry.tabStrip(tabset.id);
    if (subject.kind === "tabset" && subject.id === tabset.id) {
        return {
            target: tabset.id,
            location: "center",
            index: -1,
            rect: strip ?? rect,
            kind: "rect",
            container: tabset.id,
            self: true,
        };
    }
    const content = geometry.content(tabset.id);
    if (content && contains(content, x, y)) {
        let location: DockLocation = "center";
        if (!maximized) {
            const flags = resolveTabset(state.defaults, tabset);
            const center = !options.excludeCenter && flags.enableDrop;
            const edges = flags.enableDivide;
            if (center && !edges) {
                location = "center";
            } else if (!center && edges) {
                location = dockLocationAt(content, x, y, true); // the edges reach the center
            } else {
                // both (or neither: the model then refuses whichever location this is)
                location = dockLocationAt(content, x, y);
            }
        }
        return {
            target: tabset.id,
            location,
            index: -1,
            rect: dockRect(rect, location),
            kind: "rect",
            container: tabset.id,
            self: false,
        };
    }
    if (strip && contains(strip, x, y)) {
        const buttons = tabset.children.map((tab) =>
            geometry.tabButton(tab.id),
        );
        let drop = findStripDrop(rect, strip, buttons, x, y, "tabset");
        if (!drop) {
            return undefined;
        }
        if (drop.index !== -1 && tabset.children.length > 0) {
            let run = 0;
            for (const tab of tabset.children) {
                if (tab.pinned !== true) {
                    break;
                }
                run++;
            }
            const pinned =
                (subject.kind === "tab" || subject.kind === "new") &&
                subject.pinned;
            drop = clampToPinnedRun(drop, run, pinned, buttons);
        }
        return {
            target: tabset.id,
            location: "center",
            index: drop.index,
            rect: drop.outline,
            kind: "rect",
            container: tabset.id,
            self: false,
        };
    }
    return undefined;
}

function borderCandidate(
    border: AnyBorder,
    geometry: DropGeometry,
    subject: DropSubjectKind,
    x: number,
    y: number,
): DropCandidate | undefined {
    if (subject.kind === "tabset") {
        return undefined; // borders hold tabs only
    }
    const strip = geometry.borderStrip(border.id);
    if (strip && contains(strip, x, y)) {
        const buttons = border.children.map((tab) =>
            geometry.tabButton(tab.id),
        );
        const drop = findStripDrop(
            strip,
            strip,
            buttons,
            x,
            y,
            border.location === "left" || border.location === "right"
                ? "vertical"
                : "horizontal",
        );
        return drop
            ? {
                  target: border.id,
                  location: "center",
                  index: drop.index,
                  rect: drop.outline,
                  kind: "rect",
                  container: border.id,
                  self: false,
              }
            : undefined;
    }
    const content = geometry.borderContent(border.id);
    if (border.selected !== -1 && content && contains(content, x, y)) {
        return {
            target: border.id,
            location: "center",
            index: -1,
            rect: content,
            kind: "rect",
            container: border.id,
            self: false,
        };
    }
    return undefined;
}

/**
 * The drop targets under a point of layout `layout`, in FlexLayout's order: an open overlay border's
 * panel (it covers the layout), the root row's edge bands, the tabsets under the point (only the
 * maximized one while a tabset is maximized), then the borders. The first one the model accepts is
 * the drop target.
 */
export function dropCandidates(
    state: AnyState,
    layout: string,
    geometry: DropGeometry,
    subject: DropSubjectKind,
    x: number,
    y: number,
    options: DropOptions,
): DropCandidate[] {
    const candidates: DropCandidate[] = [];
    const main = layout === MAIN_LAYOUT;
    const windowLayout = main
        ? undefined
        : state.windows.find((candidate) => candidate.id === layout);
    const root = main ? state.root : windowLayout?.root;
    const maximizedId = main ? state.maximized : windowLayout?.maximized;
    if (!root) {
        return candidates;
    }
    const push = (candidate: DropCandidate | undefined) => {
        if (candidate) {
            candidates.push(candidate);
        }
    };

    if (main) {
        for (const border of state.borders) {
            const resolved = resolveBorder(state.defaults, border);
            const content = geometry.borderContent(border.id);
            if (
                resolved.show &&
                resolved.mode === "overlay" &&
                border.selected !== -1 &&
                content &&
                contains(content, x, y)
            ) {
                push(borderCandidate(border, geometry, subject, x, y));
            }
        }
    }

    const rootRect = geometry.node(root.id);
    if (rootRect && contains(rootRect, x, y)) {
        const maximized =
            maximizedId === undefined
                ? undefined
                : findTabset(root, maximizedId);
        if (maximized) {
            push(
                tabsetCandidate(
                    state,
                    maximized,
                    geometry,
                    subject,
                    x,
                    y,
                    true,
                    options,
                ),
            );
        } else {
            const settings = state.defaults.layout;
            if (settings?.edgeDock ?? true) {
                const edge = edgeAt(
                    rootRect,
                    settings?.edgeDockMargin ?? 10,
                    settings?.edgeDockLength ?? 100,
                    x,
                    y,
                );
                if (edge) {
                    candidates.push({
                        target: root.id,
                        location: edge.location,
                        index: -1,
                        rect: edge.outline,
                        kind: "edge",
                        container: undefined,
                        self: false,
                    });
                }
            }
            const visit = (row: AnyRow) => {
                for (const child of row.children) {
                    const rect = geometry.node(child.id);
                    if (!rect || !contains(rect, x, y)) {
                        continue;
                    }
                    if (child.type === "row") {
                        visit(child);
                    } else {
                        push(
                            tabsetCandidate(
                                state,
                                child,
                                geometry,
                                subject,
                                x,
                                y,
                                false,
                                options,
                            ),
                        );
                    }
                }
            };
            visit(root);
        }
    }

    if (main) {
        for (const border of state.borders) {
            if (resolveBorder(state.defaults, border).show) {
                push(borderCandidate(border, geometry, subject, x, y));
            }
        }
    }
    return candidates;
}

function findTabset(row: AnyRow, id: string): AnyTabset | undefined {
    for (const child of row.children) {
        if (child.type === "tabset" && child.id === id) {
            return child;
        }
        if (child.type === "row") {
            const found = findTabset(child, id);
            if (found) {
                return found;
            }
        }
    }
    return undefined;
}
