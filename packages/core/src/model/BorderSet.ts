// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/BorderSet.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

import { BorderNode } from "./BorderNode";
import type { DockLocation } from "./DockLocation";
import type { DropInfo } from "./DropInfo";
import type { IDraggable } from "./IDraggable";
import type { Model } from "./Model";
import type { Node } from "./Node";
import { TabGroupNode } from "./TabGroupNode";

export class BorderSet {
    /** @internal */
    static fromJson(json: any, model: Model) {
        const borderSet = new BorderSet(model);
        borderSet.borders = json.map((borderJson: any) =>
            BorderNode.fromJson(borderJson, model),
        );
        for (const border of borderSet.borders) {
            borderSet.borderMap.set(border.getLocation(), border);
        }
        return borderSet;
    }
    /** @internal */
    private borders: BorderNode[];
    /** @internal */
    private borderMap: Map<DockLocation, BorderNode>;

    /** @internal */
    constructor(_model: Model) {
        this.borders = [];
        this.borderMap = new Map<DockLocation, BorderNode>();
    }

    toJson() {
        return this.borders.map((borderNode) => borderNode.toJson());
    }

    /** @internal */
    getBorders() {
        return this.borders;
    }

    /** @internal */
    getBorderMap() {
        return this.borderMap;
    }

    /** @internal */
    forEachNode(fn: (node: Node, level: number) => void) {
        for (const borderNode of this.borders) {
            fn(borderNode, 0);
            for (const node of borderNode.getChildren()) {
                node.forEachNode(fn, 1);
            }
        }
    }

    /** @internal */
    setPaths() {
        for (const borderNode of this.borders) {
            const path = `/border/${borderNode.getLocation().getName()}`;
            borderNode.setPath(path);
            let i = 0;
            for (const node of borderNode.getChildren()) {
                if (node.getType() === TabGroupNode.TYPE) {
                    // recurse so the group's tabs get unique paths too (/border/x/g0/t0 ...)
                    node.setPaths(`${path}/g${i}`);
                } else {
                    node.setPath(`${path}/t${i}`);
                }
                i++;
            }
        }
    }

    /** @internal */
    findDropTargetNode(
        dragNode: Node & IDraggable,
        x: number,
        y: number,
        excludeCenter: boolean = false,
    ): DropInfo | undefined {
        for (const border of this.borders) {
            if (border.isShowing()) {
                const dropInfo = border.canDrop(dragNode, x, y, excludeCenter);
                if (dropInfo !== undefined) {
                    return dropInfo;
                }
            }
        }
        return undefined;
    }
}
