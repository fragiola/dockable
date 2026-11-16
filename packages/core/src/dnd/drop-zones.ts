import type { Model } from "../state/model";
import type { AnyTypes, DockableTypes } from "../state/types";
import {
    type DragEventLike,
    type DragSubject,
    type DropZone,
    dropZones,
    endDrag,
    endExternalDragOutside,
    getDragState,
    setZoneOver,
} from "./session";

/** Options of a drop zone: a consumer element that takes a layout drag. */
export interface DropZoneOptions<T extends DockableTypes = AnyTypes> {
    /** whether the zone takes this drag (default: every drag of the zone's model) */
    accepts?: ((drag: DragSubject<T>) => boolean) | undefined;
    /** called when the drag is dropped on the zone; nothing is moved: run the command you want */
    onDrop: (drag: DragSubject<T>, event: DragEventLike) => void;
    /** called when the pointer enters (`true`) or leaves (`false`) the zone during a drag it takes */
    onOverChange?: ((over: boolean) => void) | undefined;
}

export function registerDropZone<T extends DockableTypes>(
    model: Model<T>,
    element: Element,
    options: DropZoneOptions<T>,
): () => void {
    const zone: DropZone = {
        options: options as unknown as DropZoneOptions<AnyTypes>,
        enterCount: 0,
        over: false,
    };
    dropZones.add(zone);
    const owner: object = model;
    const accepts = () => {
        const state = getDragState();
        return (
            state !== undefined &&
            state.mainEngine.adapter.model === owner &&
            (zone.options.accepts?.(state.subject) ?? true)
        );
    };
    const onEnter = (event: Event) => {
        if (!accepts()) return;
        // the zone takes the drag: the layouts under or around it must not
        event.stopPropagation();
        event.preventDefault();
        zone.enterCount++;
        setZoneOver(zone, true);
        hideIndicators();
    };
    const onOver = (event: Event) => {
        if (!accepts()) return;
        event.stopPropagation();
        event.preventDefault();
        const dataTransfer = (event as DragEvent).dataTransfer;
        if (dataTransfer) {
            dataTransfer.dropEffect = getDragState()?.isNewTab()
                ? "copy"
                : "move";
        }
        setZoneOver(zone, true);
        hideIndicators();
    };
    const onLeave = (event: Event) => {
        if (!zone.over) return;
        event.stopPropagation();
        zone.enterCount = Math.max(0, zone.enterCount - 1);
        if (zone.enterCount === 0) {
            setZoneOver(zone, false);
            endExternalDragOutside();
        }
    };
    const onDrop = (event: Event) => {
        const state = getDragState();
        if (!state || !accepts()) return;
        event.stopPropagation();
        event.preventDefault();
        setZoneOver(zone, false);
        zone.options.onDrop(state.subject, event as DragEvent);
        // the drag is over: the source's dragend (if any) finds nothing left to end
        endDrag();
    };
    element.addEventListener("dragenter", onEnter);
    element.addEventListener("dragover", onOver);
    element.addEventListener("dragleave", onLeave);
    element.addEventListener("drop", onDrop);
    return () => {
        element.removeEventListener("dragenter", onEnter);
        element.removeEventListener("dragover", onOver);
        element.removeEventListener("dragleave", onLeave);
        element.removeEventListener("drop", onDrop);
        dropZones.delete(zone);
    };
}

function hideIndicators() {
    const main = getDragState()?.mainEngine.adapter;
    for (const manager of main?.getDragDropManager().managers() ?? []) {
        manager.hideIndicator();
    }
}
