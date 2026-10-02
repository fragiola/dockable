// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/Model.ts
// (findDropTargetNode), src/model/Node.ts (findDropTargetNode), src/model/RowNode.ts,
// src/model/TabSetNode.ts and src/model/BorderNode.ts (canDrop), src/model/BorderSet.ts
// (findDropTargetNode): the drop targets under a point, in FlexLayout's order, over the state and
// the measured rects. Whether a target accepts the drop is the model's (`model.can`), not decided
// here. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

import type { DragSubject } from "../dnd/session";
import {
    type DockLocation,
    dockLocationAt,
    dockRect,
    edgeAt,
} from "../geometry/dock";
import { contains, type Rect } from "../geometry/rect";
import { resolveBorder, resolveLayout, resolveTabset } from "../state/defaults";
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

/** Where the drop targets are looked for. */
export interface DropQuery {
    readonly state: AnyState;
    /** the layout under the pointer */
    readonly layoutId: string;
    /** its maximized tabset, if any */
    readonly maximized: AnyTabset | undefined;
    readonly geometry: DropGeometry;
    readonly subject: DragSubject;
    /** the pointer, relative to the layout's root element */
    readonly x: number;
    readonly y: number;
}

interface DropContext extends DropQuery {
    /** no center drops (a tabset that cannot merge) */
    readonly excludeCenter: boolean;
}

/** a dragged tabset can never merge when it cannot close or holds pinned tabs */
function excludesCenter(state: AnyState, subject: DragSubject): boolean {
    return (
        subject.kind === "tabset" &&
        (!resolveTabset(state.defaults, subject.tabset).enableClose ||
            subject.tabset.children.some((tab) => tab.pinned === true))
    );
}

function tabsetCandidate(
    ctx: DropContext,
    tabset: AnyTabset,
    maximized: boolean,
): DropCandidate | undefined {
    const { state, geometry, subject, x, y } = ctx;
    const rect = geometry.node(tabset.id);
    if (!rect) {
        return undefined;
    }
    const strip = geometry.tabStrip(tabset.id);
    if (subject.kind === "tabset" && subject.tabset.id === tabset.id) {
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
        const flags = resolveTabset(state.defaults, tabset);
        const center = !ctx.excludeCenter && flags.enableDrop;
        // with neither center nor edges, the model refuses whichever location this is
        const location: DockLocation =
            maximized || (center && !flags.enableDivide)
                ? "center"
                : dockLocationAt(content, x, y, !center && flags.enableDivide);
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
        const drop = findStripDrop(rect, strip, buttons, x, y, "tabset");
        if (!drop) {
            return undefined;
        }
        const run = tabset.children.findIndex((tab) => tab.pinned !== true);
        const clamped = clampToPinnedRun(
            drop,
            run === -1 ? tabset.children.length : run,
            subject.kind !== "tabset" && subject.tab.pinned === true,
            buttons,
        );
        return {
            target: tabset.id,
            location: "center",
            index: clamped.index,
            rect: clamped.outline,
            kind: "rect",
            container: tabset.id,
            self: false,
        };
    }
    return undefined;
}

function borderCandidate(
    ctx: DropContext,
    border: AnyBorder,
): DropCandidate | undefined {
    const { geometry, subject, x, y } = ctx;
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
            border.location === "start" || border.location === "end"
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
 * The drop targets under a point of a layout, in FlexLayout's order: an open overlay border's
 * panel (it covers the layout), the root row's edge bands, the tabsets under the point (only the
 * maximized one while a tabset is maximized), then the borders. The first one the model accepts is
 * the drop target.
 */
export function dropCandidates(query: DropQuery): DropCandidate[] {
    const { state, layoutId, geometry, x, y } = query;
    const ctx: DropContext = {
        ...query,
        excludeCenter: excludesCenter(state, query.subject),
    };
    const candidates: DropCandidate[] = [];
    const main = layoutId === MAIN_LAYOUT;
    const root = main
        ? state.root
        : state.windows.find((candidate) => candidate.id === layoutId)?.root;
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
                push(borderCandidate(ctx, border));
            }
        }
    }

    const rootRect = geometry.node(root.id);
    if (rootRect && contains(rootRect, x, y)) {
        if (query.maximized) {
            push(tabsetCandidate(ctx, query.maximized, true));
        } else {
            const settings = resolveLayout(state.defaults);
            const edge = settings.edgeDock
                ? edgeAt(
                      rootRect,
                      settings.edgeDockMargin,
                      settings.edgeDockLength,
                      x,
                      y,
                  )
                : undefined;
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
            const visit = (row: AnyRow) => {
                for (const child of row.children) {
                    const rect = geometry.node(child.id);
                    if (!rect || !contains(rect, x, y)) {
                        continue;
                    }
                    if (child.type === "row") {
                        visit(child);
                    } else {
                        push(tabsetCandidate(ctx, child, false));
                    }
                }
            };
            visit(root);
        }
    }

    if (main) {
        for (const border of state.borders) {
            if (resolveBorder(state.defaults, border).show) {
                push(borderCandidate(ctx, border));
            }
        }
    }
    return candidates;
}
