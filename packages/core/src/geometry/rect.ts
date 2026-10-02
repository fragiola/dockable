// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/Rect.ts, as plain
// functions over a readonly rect. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

/** A position and a size, in px. */
export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export const EMPTY_RECT: Rect = Object.freeze({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
});

export function rect(
    x: number,
    y: number,
    width: number,
    height: number,
): Rect {
    return { x, y, width, height };
}

/** A plain copy of anything with a position and a size (a `DOMRect`, say). */
export function toRect(value: Rect): Rect {
    return { x: value.x, y: value.y, width: value.width, height: value.height };
}

export function right(r: Rect): number {
    return r.x + r.width;
}

export function bottom(r: Rect): number {
    return r.y + r.height;
}

/** `r` relative to the origin of `origin`. */
export function relativeTo(r: Rect, origin: Rect): Rect {
    return rect(r.x - origin.x, r.y - origin.y, r.width, r.height);
}

export function contains(r: Rect, x: number, y: number): boolean {
    return r.x <= x && x <= right(r) && r.y <= y && y <= bottom(r);
}

export function rectEquals(a: Rect | undefined, b: Rect | undefined): boolean {
    return (
        a === b ||
        (a !== undefined &&
            b !== undefined &&
            a.x === b.x &&
            a.y === b.y &&
            a.width === b.width &&
            a.height === b.height)
    );
}

/** Equal to within half a pixel on every side (whole-pixel equality). */
export function equalsWhenRounded(
    a: Rect | undefined,
    b: Rect | undefined,
): boolean {
    if (!a || !b) {
        return false;
    }
    const epsilon = 0.5;
    return (
        Math.abs(a.x - b.x) < epsilon &&
        Math.abs(a.y - b.y) < epsilon &&
        Math.abs(a.width - b.width) < epsilon &&
        Math.abs(a.height - b.height) < epsilon
    );
}

/** `r` rounded to multiples of `unit`. */
export function snap(r: Rect, unit = 1): Rect {
    const round = (value: number) => Math.round(value / unit) * unit;
    return rect(round(r.x), round(r.y), round(r.width), round(r.height));
}

/** Positions an element absolutely over `r` (sizes clamped to 0): structural style only. */
export function positionElement(
    element: { style: CSSStyleDeclaration },
    r: Rect,
): void {
    element.style.left = `${r.x}px`;
    element.style.top = `${r.y}px`;
    element.style.width = `${Math.max(0, r.width)}px`;
    element.style.height = `${Math.max(0, r.height)}px`;
    element.style.position = "absolute";
}
