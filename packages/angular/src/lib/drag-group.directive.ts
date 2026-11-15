import { Directive, inject, output } from "@angular/core";
import {
    DragGroup as CoreDragGroup,
    type DragGroup,
    type Transfer,
} from "@fragiola/dockable";
import {
    type ContentViews,
    DOCKABLE_DRAG_GROUP,
    type DragGroupContext,
} from "./context";
import { onDestroy } from "./utils";

/** The content views of a drag group, keyed by moveable element (see {@link ContentViews}). */
class ContentViewRegistry implements ContentViews {
    private readonly entries = new Map<
        string,
        { owner: object; view: unknown }
    >();
    private readonly removals = new Map<
        string,
        ReturnType<typeof setTimeout>
    >();

    get(key: string) {
        return this.entries.get(key);
    }

    set(key: string, owner: object, view: unknown) {
        const pending = this.removals.get(key);
        if (pending !== undefined) {
            clearTimeout(pending);
            this.removals.delete(key);
        }
        this.entries.set(key, { owner, view });
    }

    release(key: string, owner: object, destroy: () => void) {
        if (this.entries.get(key)?.owner !== owner || this.removals.has(key)) {
            return;
        }
        this.removals.set(
            key,
            setTimeout(() => {
                this.removals.delete(key);
                if (this.entries.get(key)?.owner === owner) {
                    this.entries.delete(key);
                    destroy();
                }
            }, 0),
        );
    }
}

/**
 * Layouts of different models that exchange tabs by drag and drop. Put it on an element (or an
 * `ng-container`) around the `[dockableRoot]`s: a tab dragged from one drops into another (a
 * `tab.add` in the target model and a `tab.close` in the source, each through its model's
 * middleware, which can veto), and its content keeps its state. Renders nothing of its own.
 */
@Directive({
    selector: "[dockableDragGroup]",
    exportAs: "dockableDragGroup",
    providers: [
        {
            provide: DOCKABLE_DRAG_GROUP,
            useFactory: (): DragGroupContext => ({
                group: new CoreDragGroup(),
                views: new ContentViewRegistry(),
            }),
        },
    ],
})
export class DockableDragGroup {
    /**
     * after a tab moved from one layout to another, with where it came from and where it went
     * (what an app's undo needs)
     */
    readonly transfer = output<Transfer>();

    /** the core's drag group, for code that moves tabs between its layouts (`group.transfer(…)`) */
    readonly group: DragGroup = inject(DOCKABLE_DRAG_GROUP, {
        self: true,
    }).group;

    constructor() {
        onDestroy(
            this.group.onTransfer((transfer) => this.transfer.emit(transfer)),
        );
    }
}

/**
 * The drag group of the enclosing `[dockableDragGroup]`, for code that moves tabs between its
 * layouts (`group.transfer(…)`, an undo) or listens to transfers. Call it in an injection context.
 */
export function injectDragGroup(): DragGroup {
    const context = inject(DOCKABLE_DRAG_GROUP, { optional: true });
    if (!context) {
        throw new Error(
            "injectDragGroup must be used inside [dockableDragGroup]",
        );
    }
    return context.group;
}
