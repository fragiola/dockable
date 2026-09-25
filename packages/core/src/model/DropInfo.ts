// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/DropInfo.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

import type { DockLocation } from "./DockLocation";
import type { IDropTarget } from "./IDropTarget";
import type { Node } from "./Node";
import type { Rect } from "./Rect";

/**
 * What a drop outline represents: `"rect"` for a drop into (or beside) a node, `"edge"` for a
 * drop at the outer edge of a row. Replaces FlexLayout's outline class name; the view maps it to
 * `data-*`.
 */
export type DropKind = "rect" | "edge";

export class DropInfo {
    node: Node & IDropTarget;
    rect: Rect;
    location: DockLocation;
    index: number;
    kind: DropKind;

    constructor(
        node: Node & IDropTarget,
        rect: Rect,
        location: DockLocation,
        index: number,
        kind: DropKind,
    ) {
        this.node = node;
        this.rect = rect;
        this.location = location;
        this.index = index;
        this.kind = kind;
    }
}
