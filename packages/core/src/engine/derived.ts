// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx
// (the paths and size ranges a layout renders with), with React, JSX and CSS class names removed.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import { inlineRect } from "../geometry/direction";
import {
    type EdgeBand,
    edgeBands,
    flip,
    type Orientation,
} from "../geometry/dock";
import {
    computePaths,
    getTabButtonId,
    getTabPanelId,
    windowPath,
} from "../paths";
import {
    type FlexSizing,
    flexGrow,
    type SizeRange,
    sizeRanges,
} from "../split/split";
import { resolveLayout } from "../state/defaults";
import type { Model } from "../state/model";
import type { AnyRow, AnyState } from "../state/tree";
import type { DockableTypes } from "../state/types";
import type { SharedView } from "./LayoutEngine";
import type { Measure } from "./measure";

function rowOrientations(
    row: AnyRow,
    orientation: Orientation,
    into = new Map<string, Orientation>(),
): Map<string, Orientation> {
    into.set(row.id, orientation);
    for (const child of row.children) {
        if (child.type === "row") {
            rowOrientations(child, flip(orientation), into);
        }
    }
    return into;
}

/**
 * What a layout derives from the model's state to render it: the `data-layout-path` of its nodes,
 * the size ranges and orientations of its rows and tabsets, and the DOM ids of its tabs. Each is
 * computed once per state.
 */
export class Derived<T extends DockableTypes> {
    private readonly model: Model<T>;
    private readonly layoutId: string;
    private readonly shared: SharedView;
    private readonly measure: Measure<T>;
    private readonly isMainLayout: () => boolean;
    private pathsFor: AnyState | undefined;
    private paths = new Map<string, string>();
    private orientationsFor: AnyState | undefined;
    private orientations = new Map<string, Orientation>();
    private rangesFor: AnyState | undefined;
    private ranges = new Map<string, SizeRange>();
    private rangesSplitterSize = 0;

    constructor(
        model: Model<T>,
        layoutId: string,
        shared: SharedView,
        measure: Measure<T>,
        isMainLayout: () => boolean,
    ) {
        this.model = model;
        this.layoutId = layoutId;
        this.shared = shared;
        this.measure = measure;
        this.isMainLayout = isMainLayout;
    }

    /**
     * A window layout's number in its paths: the lowest one free when it is first seen, then kept
     * while it is open, so closing one window never renames another's elements.
     */
    private windowNumber(state: AnyState, layoutId: string): number {
        const numbers = this.shared.windowNumbers;
        for (const id of [...numbers.keys()]) {
            if (!state.windows.some((w) => w.id === id)) {
                numbers.delete(id);
            }
        }
        let number = numbers.get(layoutId);
        if (number === undefined) {
            const used = new Set(numbers.values());
            number = 1;
            while (used.has(number)) {
                number++;
            }
            numbers.set(layoutId, number);
        }
        return number;
    }

    /** The DOM id of a tab's button in this layout (unique on the page, see `idScope`). */
    tabButtonId(tabId: string): string {
        return getTabButtonId(tabId, this.shared.idScope);
    }

    /** The DOM id of a tab's panel in this layout (unique on the page, see `idScope`). */
    tabPanelId(tabId: string): string {
        return getTabPanelId(tabId, this.shared.idScope);
    }

    rootRow(state: AnyState): AnyRow | undefined {
        if (this.isMainLayout()) {
            return state.root;
        }
        return state.windows.find((w) => w.id === this.layoutId)?.root;
    }

    /** The `data-layout-path` of a node of this layout (the root row's is the layout's prefix). */
    path(id: string): string {
        const state = this.state();
        const root = state === this.pathsFor ? undefined : this.rootRow(state);
        if (root) {
            this.pathsFor = state;
            this.paths = this.isMainLayout()
                ? computePaths(root, "", state.borders)
                : computePaths(
                      root,
                      windowPath(this.windowNumber(state, this.layoutId)),
                  );
        }
        return this.paths.get(id) ?? "";
    }

    /** The size range of a row or tabset of this layout (its flex min/max). */
    private minMax(id: string): SizeRange {
        const state = this.state();
        const stale =
            state !== this.rangesFor ||
            this.measure.rangesDirty ||
            this.rangesSplitterSize !== this.shared.splitterSize;
        const root = stale ? this.rootRow(state) : undefined;
        if (root) {
            this.rangesFor = state;
            this.measure.rangesDirty = false;
            this.rangesSplitterSize = this.shared.splitterSize;
            this.ranges = sizeRanges(
                state.defaults,
                root,
                resolveLayout(state.defaults).rootOrientation,
                this.shared.splitterSize,
                (id) => this.measure.rects.get(`tabstrip:${id}`)?.height ?? 0,
            );
        }
        return (
            this.ranges.get(id) ?? {
                minWidth: 0,
                minHeight: 0,
                maxWidth: 99999,
                maxHeight: 99999,
            }
        );
    }

    flex(id: string): FlexSizing {
        const node = this.model.get("node-by", { id });
        const weight =
            node?.type === "row" || node?.type === "tabset" ? node.weight : 0;
        return { ...this.minMax(id), grow: flexGrow(weight) };
    }

    rowOrientation(rowId: string): Orientation {
        const state = this.state();
        const rootOrientation = resolveLayout(state.defaults).rootOrientation;
        const root =
            state === this.orientationsFor ? undefined : this.rootRow(state);
        if (root) {
            this.orientationsFor = state;
            this.orientations = rowOrientations(root, rootOrientation);
        }
        return this.orientations.get(rowId) ?? rootOrientation;
    }

    edgeBands(): EdgeBand[] {
        const settings = resolveLayout(this.state().defaults);
        const root = this.rootRow(this.state());
        const rect = root ? this.measure.inlineRect("row", root.id) : undefined;
        if (!settings.edgeDock || !rect) {
            return [];
        }
        const direction = this.measure.direction;
        return edgeBands(
            rect,
            settings.edgeDockMargin,
            settings.edgeDockLength,
        ).map((band) => ({ ...band, rect: inlineRect(band.rect, direction) }));
    }

    state(): AnyState {
        return this.model.state as unknown as AnyState;
    }
}
