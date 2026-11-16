import {
    type AnyTypes,
    type DockableTypes,
    DragDropManager,
    type DropZoneOptions,
    type Model,
} from "@fragiola/dockable";
import * as React from "react";
import type { DropZoneState } from "../components/drop-zone";
import { useDragState } from "./internal";

export interface UseDropZoneOptions<T extends DockableTypes = AnyTypes> {
    /** the model whose drags the zone takes */
    model: Model<T>;
    /** whether the zone takes this drag (default: every drag of the model) */
    accepts?: DropZoneOptions<T>["accepts"];
    /**
     * called when the drag is dropped on the zone, with what is dragged: `{ kind: "tab", tab }`,
     * `{ kind: "tabset", tabset }` or, for a new tab (a `Dockable.DragSource` or a foreign drag),
     * `{ kind: "new", tab }`. Nothing is moved: run the command you want (`tab.close`).
     */
    onDrop: DropZoneOptions<T>["onDrop"];
}

export interface UseDropZoneResult {
    state: DropZoneState;
    /** what goes on the zone's element */
    props: {
        /** callback ref */
        ref: React.RefCallback<HTMLElement>;
    };
}

/**
 * The lower layer of `Dockable.DropZone`: makes an element, inside or outside the layout, a place
 * where a drag of the layout can be dropped for the consumer to handle (a trash can, an "open to
 * the right" pad). Spread `props` on the element.
 */
export function useDropZone<T extends DockableTypes>(
    options: UseDropZoneOptions<T>,
): UseDropZoneResult {
    const { model } = options;
    const latest = React.useRef(options);
    latest.current = options;
    const [element, setElement] = React.useState<HTMLElement | null>(null);
    const [over, setOver] = React.useState(false);
    const dragState = useDragState();

    React.useLayoutEffect(() => {
        if (!element) {
            return;
        }
        const unregister = DragDropManager.registerDropZone(model, element, {
            accepts: (drag) => latest.current.accepts?.(drag) ?? true,
            onDrop: (drag, event) => latest.current.onDrop(drag, event),
            onOverChange: setOver,
        });
        return () => {
            unregister();
            setOver(false);
        };
    }, [model, element]);

    const subject = dragState?.subjectOf(model);
    const active =
        subject !== undefined && (options.accepts?.(subject) ?? true);
    return {
        state: { over: over && active, active },
        props: { ref: setElement },
    };
}
