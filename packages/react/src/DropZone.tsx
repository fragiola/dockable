import type { AnyTypes, DockableTypes } from "@fragiola/dockable";
import type * as React from "react";
import { type UseDropZoneOptions, useDropZone } from "./hooks";
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

// `onDrop` is the zone's callback with what is dragged, not the element's native drop handler
export interface DropZoneProps<T extends DockableTypes = AnyTypes>
    extends Omit<DivPrimitiveProps<DropZoneState>, "onDrop">,
        UseDropZoneOptions<T> {
    /** the zone's content; the primitive renders no text of its own */
    children?: React.ReactNode;
}

/**
 * A place, inside or outside the layout, where a drag of the layout can be dropped for you to
 * handle: a trash can that closes the tab, an "open to the right" pad, a region of the page. While
 * a drag it takes is over it, the layout shows no outline, and a drop calls `onDrop` with what is
 * dragged instead of moving it.
 */
export function DropZone<T extends DockableTypes = AnyTypes>(
    props: DropZoneProps<T>,
) {
    const { model, accepts, onDrop, children, ...rest } = props;
    const { state, props: zone } = useDropZone({ model, accepts, onDrop });
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
