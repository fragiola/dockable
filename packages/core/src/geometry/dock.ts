// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/DockLocation.ts, and the
// edge bands of src/model/Model.ts (getEdgeDockRects) and src/model/RowNode.ts (canDrop), written
// once here. Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import { bottom, type Rect, rect, right } from "./rect";

/** A side of a layout, a border, or of a tabset. */
export type BorderLocation = "top" | "bottom" | "left" | "right";
/** Where a drop goes relative to its target: into it (`center`) or beside it. */
export type DockLocation = "center" | BorderLocation;
/** The direction a row lays its children out in. */
export type Orientation = "horizontal" | "vertical";

export const DOCK_LOCATIONS: readonly DockLocation[] = [
    "center",
    "top",
    "bottom",
    "left",
    "right",
];
export const BORDER_LOCATIONS: readonly BorderLocation[] = [
    "top",
    "bottom",
    "left",
    "right",
];

/** The orientation of the row a drop at `location` lines up with (center counts as vertical). */
export function dockOrientation(location: DockLocation): Orientation {
    return location === "left" || location === "right"
        ? "horizontal"
        : "vertical";
}

/** 1 for a drop after its target (bottom, right), 0 before it. */
export function dockIndexPlus(location: DockLocation): number {
    return location === "bottom" || location === "right" ? 1 : 0;
}

export function flip(orientation: Orientation): Orientation {
    return orientation === "horizontal" ? "vertical" : "horizontal";
}

/**
 * The dock location of a point over `r`: the middle half is the center (unless `excludeCenter`),
 * the rest split along the diagonals.
 */
export function dockLocationAt(
    r: Rect,
    x: number,
    y: number,
    excludeCenter = false,
): DockLocation {
    if (!(r.width > 0) || !(r.height > 0)) {
        return "center";
    }
    const fx = (x - r.x) / r.width;
    const fy = (y - r.y) / r.height;
    if (!excludeCenter && fx >= 0.25 && fx < 0.75 && fy >= 0.25 && fy < 0.75) {
        return "center";
    }
    const bottomLeft = fy >= fx; // below the top-left to bottom-right diagonal
    const bottomRight = fy >= 1 - fx; // below the bottom-left to top-right diagonal
    if (bottomLeft) {
        return bottomRight ? "bottom" : "left";
    }
    return bottomRight ? "right" : "top";
}

/** The half of `r` a drop at `location` would take (all of it for the center). */
export function dockRect(r: Rect, location: DockLocation): Rect {
    switch (location) {
        case "top":
            return rect(r.x, r.y, r.width, r.height / 2);
        case "bottom":
            return rect(r.x, bottom(r) - r.height / 2, r.width, r.height / 2);
        case "left":
            return rect(r.x, r.y, r.width / 2, r.height);
        case "right":
            return rect(right(r) - r.width / 2, r.y, r.width / 2, r.height);
        default:
            return r;
    }
}

/** A band along one edge of a layout where a drop docks to that edge. */
export interface EdgeBand {
    readonly location: BorderLocation;
    readonly rect: Rect;
}

/**
 * The four edge bands of a layout's root row: `margin` deep, `length` long (at most the edge),
 * centred on each edge.
 */
export function edgeBands(
    root: Rect,
    margin: number,
    length: number,
): EdgeBand[] {
    const w = Math.min(length, root.width);
    const h = Math.min(length, root.height);
    return [
        {
            location: "top",
            rect: rect(root.x + (root.width - w) / 2, root.y, w, margin),
        },
        {
            location: "bottom",
            rect: rect(
                root.x + (root.width - w) / 2,
                bottom(root) - margin,
                w,
                margin,
            ),
        },
        {
            location: "left",
            rect: rect(root.x, root.y + (root.height - h) / 2, margin, h),
        },
        {
            location: "right",
            rect: rect(
                right(root) - margin,
                root.y + (root.height - h) / 2,
                margin,
                h,
            ),
        },
    ];
}

/**
 * The edge band under a point, and the outline a drop there shows (a quarter of the root on that
 * side), or undefined. Strict bounds, as FlexLayout's `RowNode.canDrop`.
 */
export function edgeAt(
    root: Rect,
    margin: number,
    length: number,
    x: number,
    y: number,
): { location: BorderLocation; outline: Rect } | undefined {
    const xx = x - root.x;
    const yy = y - root.y;
    const halfAcross = Math.min(length, root.width) / 2; // top and bottom bands
    const halfAlong = Math.min(length, root.height) / 2; // left and right bands
    const h = root.height;
    const w = root.width;
    let location: BorderLocation | undefined;
    if (
        x < root.x + margin &&
        yy > h / 2 - halfAlong &&
        yy < h / 2 + halfAlong
    ) {
        location = "left";
    } else if (
        x > right(root) - margin &&
        yy > h / 2 - halfAlong &&
        yy < h / 2 + halfAlong
    ) {
        location = "right";
    } else if (
        y < root.y + margin &&
        xx > w / 2 - halfAcross &&
        xx < w / 2 + halfAcross
    ) {
        location = "top";
    } else if (
        y > bottom(root) - margin &&
        xx > w / 2 - halfAcross &&
        xx < w / 2 + halfAcross
    ) {
        location = "bottom";
    }
    if (!location) {
        return undefined;
    }
    const half = dockRect(root, location);
    const outline =
        location === "left"
            ? rect(half.x, half.y, half.width / 2, half.height)
            : location === "right"
              ? rect(
                    half.x + half.width / 2,
                    half.y,
                    half.width / 2,
                    half.height,
                )
              : location === "top"
                ? rect(half.x, half.y, half.width, half.height / 2)
                : rect(
                      half.x,
                      half.y + half.height / 2,
                      half.width,
                      half.height / 2,
                  );
    return { location, outline };
}
