import { type Rect, rect, right } from "./rect";

/** The inline direction of a layout: `start` is on the left in `"ltr"`, on the right in `"rtl"`. */
export type Direction = "ltr" | "rtl";

/**
 * A physical x as the start-to-end math reads it: as is in LTR, negated in RTL (never `-0`), so it
 * grows from the start side either way. Its own inverse: it maps an inline x back to a physical one.
 */
export function inlineX(x: number, direction: Direction): number {
    return direction === "rtl" ? 0 - x : x;
}

/** A rect with its x as {@link inlineX} reads it (and back). */
export function inlineRect(r: Rect, direction: Direction): Rect {
    return direction === "rtl"
        ? rect(inlineX(right(r), direction), r.y, r.width, r.height)
        : r;
}
