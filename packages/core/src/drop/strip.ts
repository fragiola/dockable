// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/StripDrop.ts (findStripDrop)
// and the pinned clamp of src/model/TabSetNode.ts (canDrop), over rects. Tab groups are gone, so a
// strip's children are its tabs. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import { bottom, type Rect, rect, right } from "../geometry/rect";

/**
 * How a strip lays out its tabs: a border's strip runs `"horizontal"` or `"vertical"`; a tabset's
 * runs horizontally, and a slot whose edge is outside the tabset (a tab scrolled out) is not offered;
 * a tab flush with the tabset's edge is inside.
 */
export type StripMode = "horizontal" | "vertical" | "tabset";

/** A drop into a tab strip: the insertion index and the outline to show. */
export interface StripDrop {
    readonly index: number;
    readonly outline: Rect;
}

function lineRect(
    tab: Rect | undefined,
    x: number,
    y: number,
    vertical: boolean,
): Rect | undefined {
    // a tab hidden by tab overflow has an empty rect: it is on no line
    if (!tab || (tab.width === 0 && tab.height === 0)) {
        return undefined;
    }
    if (vertical) {
        return tab.x <= x && x <= right(tab) ? tab : undefined;
    }
    return tab.y <= y && y <= bottom(tab) ? tab : undefined;
}

function before(vertical: boolean, extent: Rect): Rect {
    return vertical
        ? rect(extent.x, extent.y - 2, extent.width, 3)
        : rect(extent.x - 2, extent.y, 3, extent.height);
}

function after(vertical: boolean, extent: Rect): Rect {
    return vertical
        ? rect(extent.x, bottom(extent) - 2, extent.width, 3)
        : rect(right(extent) - 2, extent.y, 3, extent.height);
}

/**
 * Where a drop over a strip goes: each tab on the pointer's line is split at its centre into a
 * "before" and an "after" slot; the space after the line's last tab appends. `host` is the
 * tabset's (or border strip's) rect, `strip` the strip's, `tabs` each tab's button rect in order.
 */
export function findStripDrop(
    host: Rect,
    strip: Rect,
    tabs: readonly (Rect | undefined)[],
    x: number,
    y: number,
    mode: StripMode,
): StripDrop | undefined {
    const vertical = mode === "vertical";
    if (tabs.length === 0) {
        return {
            index: 0,
            outline: vertical
                ? rect(strip.x, strip.y, strip.width, 2)
                : rect(strip.x, strip.y, 2, strip.height),
        };
    }
    const onLine: { index: number; extent: Rect }[] = [];
    for (const [index, tab] of tabs.entries()) {
        const extent = lineRect(tab, x, y, vertical);
        if (extent) {
            onLine.push({ index, extent });
        }
    }
    const last = onLine[onLine.length - 1];
    if (!last) {
        return undefined; // the pointer is between wrapped lines
    }
    const pos = vertical ? y : x;
    let p = vertical ? strip.y : strip.x;
    for (const { index, extent } of onLine) {
        const middle = vertical
            ? extent.y + extent.height / 2
            : extent.x + extent.width / 2;
        if (p <= pos && pos < middle) {
            const edge = vertical ? extent.y : extent.x;
            if (mode !== "tabset" || (host.x <= edge && edge <= right(host))) {
                return { index, outline: before(vertical, extent) };
            }
            return undefined;
        }
        p = middle;
    }
    const lastMiddle = vertical
        ? last.extent.y + last.extent.height / 2
        : last.extent.x + last.extent.width / 2;
    const lastEdge = vertical ? bottom(last.extent) : right(last.extent);
    const hostEdge = vertical ? bottom(host) : right(host);
    if (pos >= lastMiddle && lastEdge <= hostEdge) {
        return { index: tabs.length, outline: after(vertical, last.extent) };
    }
    return undefined;
}

/**
 * Clamps a strip drop to the pinned run: a pinned tab only drops within the run (`index <= run`),
 * anything else after it (`index >= run`). The outline moves to the boundary tab.
 */
export function clampToPinnedRun(
    drop: StripDrop,
    run: number,
    pinned: boolean,
    tabs: readonly (Rect | undefined)[],
): StripDrop {
    if (tabs.length === 0) {
        return drop;
    }
    const index = pinned
        ? Math.min(drop.index, run)
        : Math.max(drop.index, run);
    if (index === drop.index) {
        return drop;
    }
    const inside = index < tabs.length;
    const boundary = inside ? tabs[index] : tabs[tabs.length - 1];
    if (!boundary) {
        return { index, outline: drop.outline };
    }
    return {
        index,
        outline: inside ? before(false, boundary) : after(false, boundary),
    };
}
