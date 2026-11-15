import {
    computed,
    Directive,
    effect,
    input,
    output,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import {
    type AnyTypes,
    type DockableTypes,
    DragDropManager,
    type DragEventLike,
    type DragState,
    type DragSubject,
    type DropZoneOptions,
    type Model,
    type TabInitOf,
} from "@fragiola/dockable";
import { dragStateSignal } from "./internal";
import { booleanInput, dataAttr, injectHost } from "./utils";

export interface DragSourceState {
    /** a drag started by this source is in progress */
    dragging: boolean;
    /** the source is disabled */
    disabled: boolean;
}

/** What `(dropped)` of a `[dockableDragSource]` emits. */
export interface NewTabDrop {
    /** the new tab's id, or `undefined` when the add was refused */
    tabId: string | undefined;
    event: DragEventLike;
}

/**
 * An element, anywhere on the page, that can be dragged into a layout to create a new tab:
 * `<div [dockableDragSource]="model" [tab]="{ component: 'note', label: 'Note' }">`. The drop runs
 * `tab.add` through the model's middleware, which can veto or rewrite it. It is itself the drag
 * image. Give it a role and a name that fit your UI, and offer a keyboard path to the same command
 * (a click, a menu): native drag and drop has none.
 */
@Directive({
    selector: "[dockableDragSource]",
    exportAs: "dockableDragSource",
    host: {
        "[attr.draggable]": "!disabled()",
        "[attr.aria-disabled]": "disabled() ? 'true' : null",
        "[attr.data-dragging]": "data().dragging",
        "[attr.data-disabled]": "data().disabled",
        "(dragstart)": "onDragStart($event)",
        "(dragend)": "onDragEnd()",
    },
})
export class DockableDragSource<T extends DockableTypes = AnyTypes> {
    /** the model of the layout the new tab is dropped into (its `[dockableRoot]` must be rendered) */
    readonly dockableDragSource = input.required<Model<T>>();
    /**
     * the tab a drop creates (a `tab.add` init, checked against the registry). A function is called
     * at each drag start, so every drop can get fresh data.
     */
    readonly tab = input.required<TabInitOf<T> | (() => TabInitOf<T>)>();
    /** no drag starts while true */
    readonly disabled = input(false, { transform: booleanInput });
    /** after the drop, with the new tab's id (`undefined` when the add was refused) */
    readonly dropped = output<NewTabDrop>();

    private readonly host = injectHost();
    private readonly dragState = dragStateSignal();
    private readonly started = signal<DragState | undefined>(undefined);

    /** what the source shows as `data-*` */
    readonly state: Signal<DragSourceState> = computed(() => ({
        dragging:
            this.dragState() !== undefined &&
            this.dragState() === this.started(),
        disabled: this.disabled(),
    }));

    protected readonly data = computed(() => ({
        dragging: dataAttr(this.state().dragging),
        disabled: dataAttr(this.state().disabled),
    }));

    protected onDragStart(event: DragEvent): void {
        const tab = this.tab();
        if (
            this.disabled() ||
            !DragDropManager.startAddDrag(
                this.dockableDragSource(),
                event,
                typeof tab === "function" ? tab() : tab,
                (tabId, dropEvent) =>
                    this.dropped.emit({ tabId, event: dropEvent }),
                this.host,
            )
        ) {
            // no layout to drop into (not rendered yet): no native drag either
            event.preventDefault();
            return;
        }
        event.stopPropagation(); // an enclosing draggable must not start its own drag
        this.started.set(DragDropManager.getDragState());
    }

    protected onDragEnd(): void {
        const started = untracked(this.started);
        if (
            started !== undefined &&
            DragDropManager.getDragState() === started
        ) {
            DragDropManager.endDrag();
        }
        this.started.set(undefined);
    }
}

export interface DropZoneState {
    /** a drag the zone takes is over it */
    over: boolean;
    /** a drag the zone would take is in progress */
    active: boolean;
}

/** What `(dropped)` of a `[dockableDropZone]` emits. */
export interface DropZoneDrop<T extends DockableTypes = AnyTypes> {
    /**
     * what is dragged: `{ kind: "tab", tab }`, `{ kind: "tabset", tabset }` or, for a new tab (a
     * `[dockableDragSource]` or a foreign drag), `{ kind: "new", tab }`
     */
    drag: DragSubject<T>;
    event: DragEventLike;
}

/**
 * A place, inside or outside the layout, where a drag of the layout can be dropped for you to
 * handle: `<div [dockableDropZone]="model" (dropped)="close($event.drag)">`, a trash can that
 * closes the tab, an "open to the right" pad, a region of the page. While a drag it takes is over
 * it, the layout shows no outline, and a drop emits `(dropped)` with what is dragged instead of
 * moving it: run the command you want.
 */
@Directive({
    selector: "[dockableDropZone]",
    exportAs: "dockableDropZone",
    host: {
        "[attr.data-drop-over]": "data().over",
        "[attr.data-drop-active]": "data().active",
    },
})
export class DockableDropZone<T extends DockableTypes = AnyTypes> {
    /** the model whose drags the zone takes */
    readonly dockableDropZone = input.required<Model<T>>();
    /** whether the zone takes this drag (default: every drag of the model) */
    readonly accepts = input<DropZoneOptions<T>["accepts"]>(undefined);
    /** a drag the zone takes was dropped on it; nothing is moved */
    readonly dropped = output<DropZoneDrop<T>>();

    private readonly dragState = dragStateSignal();
    private readonly over = signal(false);

    /** what the zone shows as `data-*` */
    readonly state: Signal<DropZoneState> = computed(() => {
        const subject = this.dragState()?.subjectOf(this.dockableDropZone());
        const accepts = this.accepts();
        const active = subject !== undefined && (accepts?.(subject) ?? true);
        return { over: this.over() && active, active };
    });

    protected readonly data = computed(() => ({
        over: dataAttr(this.state().over),
        active: dataAttr(this.state().active),
    }));

    constructor() {
        const host = injectHost();
        effect((onCleanup) => {
            const model = this.dockableDropZone();
            untracked(() => {
                const unregister = DragDropManager.registerDropZone(
                    model,
                    host,
                    {
                        accepts: (drag) => this.accepts()?.(drag) ?? true,
                        onDrop: (drag, event) =>
                            this.dropped.emit({ drag, event }),
                        onOverChange: (value) => this.over.set(value),
                    },
                );
                onCleanup(() => {
                    unregister();
                    this.over.set(false);
                });
            });
        });
    }
}
