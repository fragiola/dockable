import type { IDropZoneOptions, Model } from "@fragiola/dockable";
import type * as React from "react";
import { useDropZone } from "./hooks";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "./utils/useRender";

export interface DropZoneState {
    /** a drag the zone takes is over it */
    over: boolean;
    /** a drag the zone would take is in progress */
    active: boolean;
}

// `onDrop` is the zone's callback with the dragged node, not the element's native drop handler
export interface DropZoneProps
    extends Omit<DivPrimitiveProps<DropZoneState>, "onDrop"> {
    /** the model whose drags the zone takes */
    model: Model;
    /** whether the zone takes this drag (default: every drag of the model) */
    accepts?: IDropZoneOptions["accepts"];
    /**
     * called when the drag is dropped on the zone, with the dragged node. Nothing is moved:
     * dispatch the action you want (e.g. `Actions.deleteTab`)
     */
    onDrop: IDropZoneOptions["onDrop"];
    /** the zone's content; the primitive renders no text of its own */
    children?: React.ReactNode;
}

/**
 * A place, inside or outside the layout, where a drag of the layout can be dropped for you to
 * handle: a trash can that closes the tab, an "open to the right" pad, a region of the page. While
 * a drag it takes is over it, the layout shows no outline, and a drop calls `onDrop` with the
 * dragged node instead of moving it.
 */
export function DropZone(props: DropZoneProps) {
    const { model, accepts, onDrop, children, ...rest } = props;
    const zone = useDropZone({ model, accepts, onDrop });
    const state: DropZoneState = { over: zone.over, active: zone.active };
    return useRenderElement("div", rest, {
        state,
        ref: zone.ref,
        props: {
            ...dataAttributes({
                "drop-over": state.over,
                "drop-active": state.active,
            }),
            children,
        },
    });
}
