// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/RowNode.ts
// (getSplitterBounds, getSplitterInitials, calculateSplit, calcMinMaxSize), src/model/TabSetNode.ts
// (calcMinMaxSize) and src/model/BorderNode.ts (getSplitterBounds, calculateSplit), as functions over
// the state and the measured rects. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import type { BorderLocation, Orientation } from "../geometry/dock";
import { bottom, type Rect, right } from "../geometry/rect";
import {
    DEFAULT_MAX_SIZE,
    DEFAULT_MIN_SIZE,
    resolveTab,
    resolveTabset,
} from "../state/defaults";
import type { AnyRow, AnyTabset } from "../state/tree";
import type { LayoutDefaults } from "../state/types";

/** The size range of a row or tabset, in px. */
export interface SizeRange {
    readonly minWidth: number;
    readonly minHeight: number;
    readonly maxWidth: number;
    readonly maxHeight: number;
}

/** How a row or a tabset sizes in its row: its flex grow, from its weight, and its range. */
export interface FlexSizing extends SizeRange {
    readonly grow: number;
}

/** The flex grow of a weight: never below 1, or the item would not fill its row. */
export function flexGrow(weight: number): number {
    return Math.max(1, weight * 1000);
}

/** A tabset's range: its own limits narrowed by its tabs', plus its tab strip's height. */
export function tabsetRange(
    defaults: LayoutDefaults,
    tabset: AnyTabset,
    tabStripHeight: number,
): SizeRange {
    const own = resolveTabset(defaults, tabset);
    let minWidth = own.minWidth;
    let minHeight = own.minHeight;
    let maxWidth = own.maxWidth;
    let maxHeight = own.maxHeight;
    for (const tab of tabset.children) {
        const limits = resolveTab(defaults, tab);
        minWidth = Math.max(minWidth, limits.minWidth);
        minHeight = Math.max(minHeight, limits.minHeight);
        maxWidth = Math.min(maxWidth, limits.maxWidth);
        maxHeight = Math.min(maxHeight, limits.maxHeight);
    }
    minHeight += tabStripHeight;
    maxHeight += tabStripHeight;
    // contradictory limits never invert the range
    return {
        minWidth,
        minHeight,
        maxWidth: Math.max(maxWidth, minWidth),
        maxHeight: Math.max(maxHeight, minHeight),
    };
}

/**
 * The size ranges of every row and tabset below `root` (included): a row sums its children's
 * ranges along its orientation (with the splitters between them) and intersects them across it.
 */
export function sizeRanges(
    defaults: LayoutDefaults,
    root: AnyRow,
    rootOrientation: Orientation,
    splitterSize: number,
    tabStripHeight: (tabset: string) => number,
): Map<string, SizeRange> {
    const ranges = new Map<string, SizeRange>();
    const visit = (row: AnyRow, orientation: Orientation): SizeRange => {
        let minWidth = DEFAULT_MIN_SIZE;
        let minHeight = DEFAULT_MIN_SIZE;
        let maxWidth = DEFAULT_MAX_SIZE;
        let maxHeight = DEFAULT_MAX_SIZE;
        let first = true;
        const childOrientation: Orientation =
            orientation === "horizontal" ? "vertical" : "horizontal";
        for (const child of row.children) {
            const range =
                child.type === "row"
                    ? visit(child, childOrientation)
                    : tabsetRange(defaults, child, tabStripHeight(child.id));
            if (child.type === "tabset") {
                ranges.set(child.id, range);
            }
            if (orientation === "vertical") {
                minHeight += range.minHeight;
                maxHeight += range.maxHeight;
                if (!first) {
                    minHeight += splitterSize;
                    maxHeight += splitterSize;
                }
                minWidth = Math.max(minWidth, range.minWidth);
                maxWidth = Math.min(maxWidth, range.maxWidth);
            } else {
                minWidth += range.minWidth;
                maxWidth += range.maxWidth;
                if (!first) {
                    minWidth += splitterSize;
                    maxWidth += splitterSize;
                }
                minHeight = Math.max(minHeight, range.minHeight);
                maxHeight = Math.min(maxHeight, range.maxHeight);
            }
            first = false;
        }
        const range: SizeRange = {
            minWidth,
            minHeight,
            maxWidth: Math.max(maxWidth, minWidth),
            maxHeight: Math.max(maxHeight, minHeight),
        };
        ranges.set(row.id, range);
        return range;
    };
    visit(root, rootOrientation);
    return ranges;
}

/** A child of a row as the split math sees it: its measured rect and its range. */
export interface SplitChild {
    readonly rect: Rect;
    readonly range: SizeRange;
}

/**
 * The pixel range the splitter before child `index` (1-based) can move in, honouring the
 * children's min and max sizes.
 */
export function splitterBounds(
    children: readonly SplitChild[],
    orientation: Orientation,
    splitterSize: number,
    index: number,
): [number, number] {
    const horizontal = orientation === "horizontal";
    const first = children[0];
    const last = children[children.length - 1];
    if (!first || !last) {
        return [0, 0];
    }
    const start = horizontal ? first.rect.x : first.rect.y;
    const end = horizontal ? right(last.rect) : bottom(last.rect);
    let p: [number, number] = [start, end];
    const q: [number, number] = [start, end];
    const min = (child: SplitChild) =>
        horizontal ? child.range.minWidth : child.range.minHeight;
    const max = (child: SplitChild) =>
        horizontal ? child.range.maxWidth : child.range.maxHeight;
    for (let i = 0; i < index; i++) {
        const child = children[i];
        if (!child) {
            continue;
        }
        p[0] += min(child);
        q[0] += max(child);
        if (i > 0) {
            p[0] += splitterSize;
            q[0] += splitterSize;
        }
    }
    for (let i = children.length - 1; i >= index; i--) {
        const child = children[i];
        if (!child) {
            continue;
        }
        p[1] -= min(child) + splitterSize;
        q[1] -= max(child) + splitterSize;
    }
    p = [Math.max(q[1], p[0]), Math.min(q[0], p[1])];
    // conflicting constraints keep the bounds ordered
    if (p[0] > p[1]) {
        p = [p[0], p[0]];
    }
    return p;
}

/** What a splitter drag starts from: every child's size, their sum and the splitter's position. */
export interface SplitInitials {
    readonly initialSizes: number[];
    readonly sum: number;
    readonly startPosition: number;
}

export function splitterInitials(
    children: readonly SplitChild[],
    orientation: Orientation,
    splitterSize: number,
    index: number,
): SplitInitials {
    const horizontal = orientation === "horizontal";
    const initialSizes = children.map((child) =>
        horizontal ? child.rect.width : child.rect.height,
    );
    const sum = initialSizes.reduce((total, size) => total + size, 0);
    const at = children[index]?.rect;
    const startPosition = (at ? (horizontal ? at.x : at.y) : 0) - splitterSize;
    return { initialSizes, sum, startPosition };
}

/**
 * The children's new weights for the splitter before child `index` at `splitterPos`: the child
 * it moves towards shrinks (down to its minimum, then the next), the other grows (up to its
 * maximum, then the next). Empty when the row is unmeasured (a zero sum).
 */
export function calculateSplit(
    children: readonly SplitChild[],
    orientation: Orientation,
    index: number,
    splitterPos: number,
    initials: SplitInitials,
): number[] {
    const horizontal = orientation === "horizontal";
    const { initialSizes, sum, startPosition } = initials;
    const sizes = [...initialSizes];
    if (sum <= 0 || sizes.length === 0) {
        return [];
    }
    const size = (i: number) => sizes[i] ?? 0;
    const minOf = (i: number) => {
        const range = children[i]?.range;
        return range ? (horizontal ? range.minWidth : range.minHeight) : 0;
    };
    const maxOf = (i: number) => {
        const range = children[i]?.range;
        return range
            ? horizontal
                ? range.maxWidth
                : range.maxHeight
            : DEFAULT_MAX_SIZE;
    };

    if (splitterPos < startPosition) {
        // moved back: the child after the splitter grows
        const growMax = maxOf(index);
        let shift = startPosition - splitterPos;
        let altShift = 0;
        if (size(index) + shift > growMax) {
            altShift = size(index) + shift - growMax;
            sizes[index] = growMax;
        } else {
            sizes[index] = size(index) + shift;
        }
        for (let i = index - 1; i >= 0; i--) {
            const m = minOf(i);
            if (size(i) - shift > m) {
                sizes[i] = size(i) - shift;
                break;
            }
            shift -= size(i) - m;
            sizes[i] = m;
        }
        for (let i = index + 1; i < children.length; i++) {
            const m = maxOf(i);
            if (size(i) + altShift < m) {
                sizes[i] = size(i) + altShift;
                break;
            }
            altShift -= m - size(i);
            sizes[i] = m;
        }
    } else {
        // moved forward: the child before the splitter grows
        const growMax = maxOf(index - 1);
        let shift = splitterPos - startPosition;
        let altShift = 0;
        if (size(index - 1) + shift > growMax) {
            altShift = size(index - 1) + shift - growMax;
            sizes[index - 1] = growMax;
        } else {
            sizes[index - 1] = size(index - 1) + shift;
        }
        for (let i = index; i < children.length; i++) {
            const m = minOf(i);
            if (size(i) - shift > m) {
                sizes[i] = size(i) - shift;
                break;
            }
            shift -= size(i) - m;
            sizes[i] = m;
        }
        for (let i = index - 1; i >= 0; i--) {
            const m = maxOf(i);
            if (size(i) + altShift < m) {
                sizes[i] = size(i) + altShift;
                break;
            }
            altShift -= m - size(i);
            sizes[i] = m;
        }
    }
    // 0.1 keeps a weight from ever reaching zero
    return sizes.map((value) => (Math.max(0.1, value) * 100) / sum);
}

/**
 * The pixel range a border's splitter can move in: from the border's strip plus its minimum size to
 * where the main layout keeps its own minimum (or the border its maximum). `limits` gives the border
 * panel's min and max (omit them for the unconstrained range FlexLayout's resize uses).
 */
export function borderSplitterBounds(
    location: BorderLocation,
    strip: Rect,
    layoutRect: Rect,
    layoutRange: SizeRange,
    splitterSize: number,
    limits?: { minSize: number; maxSize: number },
): [number, number] {
    const bounds: [number, number] = [0, 0];
    if (layoutRect.width === 0 && layoutRect.height === 0) {
        return bounds; // not measured yet
    }
    const minSize = limits?.minSize ?? 0;
    const maxSize = limits?.maxSize ?? DEFAULT_MAX_SIZE;
    if (location === "top") {
        bounds[0] = bottom(strip) + minSize;
        bounds[1] = Math.max(
            bounds[0],
            bottom(layoutRect) - layoutRange.minHeight - splitterSize,
        );
        bounds[1] = Math.min(bounds[1], bottom(strip) + maxSize);
    } else if (location === "left") {
        bounds[0] = right(strip) + minSize;
        bounds[1] = Math.max(
            bounds[0],
            right(layoutRect) - layoutRange.minWidth - splitterSize,
        );
        bounds[1] = Math.min(bounds[1], right(strip) + maxSize);
    } else if (location === "bottom") {
        bounds[1] = strip.y - minSize - splitterSize;
        bounds[0] = Math.min(bounds[1], layoutRect.y + layoutRange.minHeight);
        bounds[0] = Math.max(bounds[0], strip.y - maxSize - splitterSize);
    } else {
        bounds[1] = strip.x - minSize - splitterSize;
        bounds[0] = Math.min(bounds[1], layoutRect.x + layoutRange.minWidth);
        bounds[0] = Math.max(bounds[0], strip.x - maxSize - splitterSize);
    }
    return bounds;
}

/** A border panel's size for its splitter at `splitterPos` (the unconstrained bounds' origin). */
export function borderSplitSize(
    location: BorderLocation,
    bounds: [number, number],
    splitterPos: number,
): number {
    return location === "bottom" || location === "right"
        ? Math.max(0, bounds[1] - splitterPos)
        : Math.max(0, splitterPos - bounds[0]);
}
