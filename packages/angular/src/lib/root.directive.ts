// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutInternal.tsx (the measure cycle and document key handling);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import {
    afterRenderEffect,
    computed,
    Directive,
    effect,
    forwardRef,
    inject,
    input,
    output,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import {
    type AnyTypes,
    createLayoutEngine,
    type DockableTypes,
    type KeyMap,
    type LayoutEngine,
    MAIN_LAYOUT,
    type Model,
    type OnExternalDrag,
    type OpenWindow,
    type WindowLayout,
} from "@fragiola/dockable";
import {
    DOCKABLE,
    DOCKABLE_DRAG_GROUP,
    DOCKABLE_LAYOUT,
    type DockableContext,
    eraseEngine,
    eraseModel,
    type LayoutContext,
} from "./context";
import { dragStateSignal, indicatorSignal } from "./internal";
import {
    bindStructuralStyle,
    dataAttr,
    injectHost,
    onDestroy,
    optionalBoolean,
} from "./utils";

export interface RootState {
    /** a tabset of the main layout is maximized */
    maximized: boolean;
    /** a node of this layout is being dragged */
    dragging: boolean;
    /** the drag is over a target of the main layout that a drop rule refused */
    refused: boolean;
}

/** What a popout callback receives (`(popoutOpen)`, `(popoutClose)`). */
export interface PopoutEvent<T extends DockableTypes = AnyTypes> {
    layout: WindowLayout<T>;
    window: Window;
    document: Document;
}

let nextScope = 0;

/** `popoutMirrorRoot`: a bare attribute or a boolean, or the names of the attributes to copy. */
function mirrorRoot(
    value: boolean | string | readonly string[] | undefined | null,
): boolean | readonly string[] | undefined {
    return Array.isArray(value)
        ? (value as readonly string[])
        : optionalBoolean(value);
}

/**
 * The layout's root: put it on the element the layout fills (`<div [dockableRoot]="model">`). It
 * owns the engine for the model, attaches it to the element (the containing block the panels are
 * positioned in), runs the measure-and-position cycle after every render and updates the parts
 * when the engine asks. Another model makes another engine (the layout renders again).
 */
@Directive({
    selector: "[dockableRoot]",
    exportAs: "dockableRoot",
    providers: [
        { provide: DOCKABLE, useExisting: forwardRef(() => DockableRoot) },
        {
            provide: DOCKABLE_LAYOUT,
            useExisting: forwardRef(() => DockableRoot),
        },
    ],
    host: {
        "[attr.data-layout-path]": '"/layout"',
        "[attr.data-maximized]": "data().maximized",
        "[attr.data-dragging]": "data().dragging",
        "[attr.data-drop-refused]": "data().refused",
    },
})
export class DockableRoot<T extends DockableTypes = AnyTypes>
    implements DockableContext, LayoutContext
{
    /**
     * the layout model. Its middleware (`model.use`) sees every command the layout runs, and its
     * listeners (`model.subscribe`) every change; a new state never needs a new model
     * (`layout.load`). Another model makes another engine.
     */
    readonly dockableRoot = input.required<Model<T>>();
    /** keyboard bindings, merged over `defaultKeyMap` */
    readonly keyMapInput = input<KeyMap | undefined>(undefined, {
        alias: "keyMap",
    });
    /** true (default) to resize live while dragging a splitter; false to preview and commit on release */
    readonly realtimeResize = input(undefined, { transform: optionalBoolean });
    /** seconds a view may take to animate the drop indicator (exposed as data; default 0.3) */
    readonly tabDragSpeed = input<number | undefined>(undefined);
    /** the popout host page (default `"popout.html"`); the window layout's id is passed as `?id=` */
    readonly popoutURL = input<string | undefined>(undefined);
    /** whether window layouts open as popouts; default: a desktop pointer is present */
    readonly supportsPopout = input(undefined, { transform: optionalBoolean });
    /** a popout document's title; with none, the host page's title is kept */
    readonly popoutTitle = input<
        ((layout: WindowLayout<T>) => string | undefined) | undefined
    >(undefined);
    /** opens a popout's native window (default: the main window's `open`) */
    readonly openWindow = input<OpenWindow | undefined>(undefined);
    /**
     * copies the main document's `<html>` and `<body>` attributes into each popout and keeps them
     * in sync (a theme class, `data-theme`, …): `true` (or a bare attribute) copies them all
     * (except `style`, `id` and `dir`), a list copies those names. Default: only `lang`.
     */
    readonly popoutMirrorRoot = input(undefined, { transform: mirrorRoot });
    /**
     * accepts a drag that did not start in a layout (files, links, text, another library's
     * element) as a new tab: return `{ tab, onDrop? }`, or `undefined` to ignore it
     */
    readonly externalDrag = input<OnExternalDrag<T> | undefined>(undefined);

    /** a popout document is ready, before its content renders */
    readonly popoutOpen = output<PopoutEvent<T>>();
    /** a popout window is closing (its tabs dock back into the main layout) */
    readonly popoutClose = output<PopoutEvent<T>>();

    private readonly host = injectHost();
    private readonly dragGroup = inject(DOCKABLE_DRAG_GROUP, {
        optional: true,
    });
    /** DOM ids and window names unique on the page */
    private readonly idScope = `a${nextScope++}-`;

    readonly model: Signal<Model> = computed(() =>
        eraseModel(this.dockableRoot()),
    );
    readonly engine: Signal<LayoutEngine> = computed(() =>
        eraseEngine(
            createLayoutEngine({
                model: this.dockableRoot(),
                idScope: this.idScope,
            }),
        ),
    );
    readonly layoutId: Signal<string> = signal(MAIN_LAYOUT).asReadonly();
    readonly keyMap: Signal<KeyMap | undefined> = computed(() =>
        this.keyMapInput(),
    );

    /** bumped whenever the engine asks for a render */
    private readonly tick = signal(0);
    private renders = 0;
    readonly revision: Signal<number> = computed(() => {
        this.tick();
        const engine = this.engine();
        engine.adapter.setOptions({
            realtimeResize: this.realtimeResize(),
            tabDragSpeed: this.tabDragSpeed(),
            onExternalDrag: this.externalDrag() as OnExternalDrag | undefined,
            dragGroup: this.dragGroup?.group,
            keyMap: this.keyMapInput(),
            popout: {
                popoutURL: this.popoutURL(),
                supportsPopout: this.supportsPopout(),
                mirrorRoot: this.popoutMirrorRoot(),
                openWindow: this.openWindow(),
                title: this.popoutTitle() as
                    | ((layout: WindowLayout) => string | undefined)
                    | undefined,
                onPopoutOpen: (layout, window, document) =>
                    this.popoutOpen.emit({
                        layout: layout as unknown as WindowLayout<T>,
                        window,
                        document,
                    }),
                onPopoutClose: (layout, window, document) =>
                    this.popoutClose.emit({
                        layout: layout as unknown as WindowLayout<T>,
                        window,
                        document,
                    }),
            },
        });
        engine.adapter.prepare();
        return ++this.renders;
    });

    private readonly windowLayers = signal<ReadonlyMap<string, HTMLElement>>(
        new Map(),
    );
    private readonly attached = signal<LayoutEngine | undefined>(undefined);
    readonly layers: Signal<ReadonlyMap<string, HTMLElement>> = computed(() => {
        const all = new Map(this.windowLayers());
        if (this.attached() === this.engine()) {
            // the main layout's panels are positioned in the root itself
            all.set(MAIN_LAYOUT, this.host);
        }
        return all;
    });

    private readonly pending = new Set<LayoutEngine>();
    private readonly measureRequests = signal(0);

    private readonly dragState = dragStateSignal();
    private readonly refused = indicatorSignal(
        this.engine,
        (indicator) => indicator.refused,
    );

    /** what the root shows as `data-*` */
    readonly state: Signal<RootState> = computed(() => {
        this.revision();
        const engine = this.engine();
        const drag = this.dragState();
        return {
            maximized:
                this.model().get("maximized-tabset", {
                    layoutId: MAIN_LAYOUT,
                }) !== undefined,
            dragging: drag !== undefined && drag.mainEngine === engine,
            refused: this.refused(),
        };
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            maximized: dataAttr(state.maximized),
            dragging: dataAttr(state.dragging),
            refused: dataAttr(state.refused),
        };
    });

    constructor() {
        // the containing block the panels are absolutely positioned in
        bindStructuralStyle(this.host, () => ({ position: "relative" }));

        // the engine's render requests
        effect((onCleanup) => {
            const engine = this.engine();
            onCleanup(
                engine.adapter.subscribe(() => {
                    this.tick.update((value) => value + 1);
                }),
            );
        });

        // attached before any panel renders and creates a moveable element (panels wait for the
        // main layer, which exists once the root is attached)
        effect((onCleanup) => {
            const engine = this.engine();
            untracked(() => {
                engine.adapter.attachRoot(this.host);
                this.attached.set(engine);
                this.scheduleMeasure(engine);
            });
            onCleanup(() => {
                engine.adapter.detachRoot();
                if (untracked(this.attached) === engine) {
                    this.attached.set(undefined);
                }
            });
        });

        // leave the group when this root goes away or its engine is replaced (a new model), so the
        // group never reaches a layout that is gone
        // (the engine joins it through its options)
        effect((onCleanup) => {
            const engine = this.engine();
            if (this.dragGroup) {
                onCleanup(() => engine.adapter.setOptions({}));
            }
        });

        // from anywhere in the document (tab content included): the key map's tabset focus keys
        // and overlay close key (the core's rules); a press elsewhere in the layout closes an open
        // overlay border
        effect((onCleanup) => {
            const engine = this.engine();
            const doc = this.host.ownerDocument;
            const onKeyDown = (event: KeyboardEvent) => {
                engine.adapter.handleDocumentKeyDown(event);
            };
            const onPointerDown = (event: PointerEvent) => {
                engine.adapter.handleOverlayPointerDown(event);
            };
            // capture: splitters and buttons stop the propagation of their presses
            doc.addEventListener("pointerdown", onPointerDown, true);
            doc.addEventListener("keydown", onKeyDown);
            onCleanup(() => {
                doc.removeEventListener("pointerdown", onPointerDown, true);
                doc.removeEventListener("keydown", onKeyDown);
            });
        });

        // the measure-and-position cycle, after every render that changed the layout or registered
        // an element (each part registers its elements while it renders)
        afterRenderEffect(() => {
            this.revision();
            this.measureRequests();
            const main = this.engine();
            untracked(() => {
                const engines = new Set([main, ...this.pending]);
                this.pending.clear();
                for (const engine of engines) {
                    engine.run("measure-and-position");
                }
            });
        });

        onDestroy(() => this.pending.clear());
    }

    setLayer(layoutId: string, element: HTMLElement | null): void {
        const previous = untracked(this.windowLayers);
        if ((previous.get(layoutId) ?? null) === element) {
            return;
        }
        const next = new Map(previous);
        if (element === null) {
            next.delete(layoutId);
        } else {
            next.set(layoutId, element);
        }
        this.windowLayers.set(next);
    }

    scheduleMeasure(engine: LayoutEngine): void {
        this.pending.add(engine);
        this.measureRequests.update((value) => value + 1);
    }
}
