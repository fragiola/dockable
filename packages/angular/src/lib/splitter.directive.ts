// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Splitter.tsx (separator ARIA);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import {
    ApplicationRef,
    Component,
    computed,
    Directive,
    effect,
    inject,
    input,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import {
    type AnyTypes,
    type BorderNode,
    createSplitterController,
    type DockableTypes,
    getSplitterPath,
    type RowNode,
    type SplitterAria,
    type SplitterController,
    type SplitterControllerState,
} from "@fragiola/dockable";
import {
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
} from "./context";
import {
    beforeInputs,
    bindStructuralStyle,
    dataAttr,
    injectHost,
    type StructuralStyle,
} from "./utils";

export interface SplitterState extends SplitterControllerState {
    /** `"vertical"` for a splitter between side by side children, as its `aria-orientation` */
    orientation: "horizontal" | "vertical";
    /** row splitters are hidden while a tabset is maximized */
    hidden: boolean;
}

/** A splitter's state and ARIA values before its input is set (see `beforeInputs`). */
const UNSET_SPLITTER_STATE: SplitterState = {
    dragging: false,
    previewOffset: undefined,
    orientation: "horizontal",
    hidden: false,
};
const UNSET_SPLITTER_ARIA: SplitterAria = {
    orientation: "horizontal",
    valueNow: undefined,
    valueMin: undefined,
    valueMax: undefined,
    valueText: undefined,
};

/**
 * A splitter between two children of a row, or between a border's panel and the layout
 * (`role="separator"`): `<div [dockableSplitter]="row" [index]="1" aria-label="Resize">`. Drag
 * it with the pointer, or focus it and use the arrow keys. While an outline (non-realtime) drag
 * is in progress it carries `data-dragging` and a structural `transform` previewing where it will
 * land. It has no name of its own: give it an `aria-label` (through the splitter template where a
 * row or a border inserts it).
 */
@Directive({
    selector: "[dockableSplitter]",
    exportAs: "dockableSplitter",
    host: {
        role: "separator",
        tabindex: "0",
        "[attr.aria-orientation]": "aria().orientation",
        "[attr.aria-valuenow]": "aria().valueNow ?? null",
        "[attr.aria-valuemin]": "aria().valueMin ?? null",
        "[attr.aria-valuemax]": "aria().valueMax ?? null",
        "[attr.aria-valuetext]": "aria().valueText ?? null",
        "[attr.data-layout-path]": "data().path",
        "[attr.data-orientation]": "data().orientation",
        "[attr.data-dragging]": "data().dragging",
        "(pointerdown)": "controller().onPointerDown($event)",
        "(keydown)": "onKeyDown($event)",
    },
})
export class DockableSplitter<T extends DockableTypes = AnyTypes> {
    /** the row (or border) the splitter resizes */
    readonly dockableSplitter = input.required<RowNode<T> | BorderNode<T>>();
    /** in a row, the splitter sits before child `index` (1-based); a border's splitter has none */
    readonly index = input<number | undefined>(undefined);

    private readonly context: DockableContext =
        injectDockableContext("[dockableSplitter]");
    private readonly layout = injectLayoutContext("[dockableSplitter]");
    private readonly host = injectHost();

    private readonly nodeId = computed(() => this.dockableSplitter().id);
    private readonly at = computed(() => this.index() ?? 0);
    /** the core's controller of this splitter (a new one for another node, index or engine) */
    protected readonly controller: Signal<SplitterController> = computed(() =>
        createSplitterController(
            this.layout.engine(),
            this.nodeId(),
            this.at(),
        ),
    );
    private readonly tick = signal(0);

    /** what the splitter shows as `data-*` */
    readonly state: Signal<SplitterState> = computed(() => {
        return beforeInputs(UNSET_SPLITTER_STATE, () => {
            this.tick();
            this.context.revision();
            const controller = this.controller();
            return {
                ...controller.getState(),
                orientation: controller.getAria().orientation,
                hidden: controller.isHidden(),
            };
        });
    });

    /**
     * The separator's ARIA values, as its `aria-*` attributes carry them: a template reads them
     * (`#s="dockableSplitter"`, `s.aria().valueText`) to show where the splitter sits, as React's
     * `render` and Vue's `#render` hand them over.
     */
    readonly aria: Signal<SplitterAria> = computed(() => {
        return beforeInputs(UNSET_SPLITTER_ARIA, () => {
            this.state();
            return this.controller().getAria();
        });
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            path: getSplitterPath(
                this.layout.engine().get("layout-path-by", {
                    nodeId: this.dockableSplitter().id,
                }),
                this.index() ?? 0,
            ),
            orientation: state.orientation,
            dragging: dataAttr(state.dragging),
        };
    });

    private readonly app = inject(ApplicationRef);

    /**
     * A resize from the keyboard is read back at once (a screen reader announces the new value, as
     * React's and Vue's adapters render it before the key's handlers return): the application
     * renders now, the measure-and-position cycle included, not on Angular's next frame.
     */
    protected onKeyDown(event: KeyboardEvent) {
        this.controller().onKeyDown(event);
        if (event.defaultPrevented) this.app.tick();
    }

    constructor() {
        effect((onCleanup) => {
            const controller = this.controller();
            untracked(() => {
                controller.attach(this.host);
                const unsubscribe = controller.subscribe(() => {
                    this.tick.update((value) => value + 1);
                });
                onCleanup(() => {
                    unsubscribe();
                    controller.attach(null);
                    controller.dispose();
                });
            });
        });
        bindStructuralStyle(this.host, () => {
            const state = this.state();
            const style: Record<string, string | undefined> = {};
            if (this.dockableSplitter().type === "border") {
                // an overlay border's content ignores presses (pointer-events: none), except its
                // splitter
                style.pointerEvents = "auto";
            }
            if (state.hidden) {
                style.display = "none";
            }
            if (state.previewOffset !== undefined) {
                style.transform =
                    state.orientation === "vertical"
                        ? `translateX(${state.previewOffset}px)`
                        : `translateY(${state.previewOffset}px)`;
            }
            return style as StructuralStyle;
        });
    }
}

/**
 * The splitter a `[dockableRow]` or a `[dockableBorderContent]` inserts when no splitter template
 * is given: a bare `div` with `[dockableSplitter]`.
 * @internal
 */
@Component({
    selector: "div[dockableDefaultSplitter]",
    template: "",
    hostDirectives: [
        { directive: DockableSplitter, inputs: ["dockableSplitter", "index"] },
    ],
})
export class DockableDefaultSplitter {
    constructor() {
        // the selector's attribute is how Angular names the host it creates: not the consumer's
        injectHost().removeAttribute("dockableDefaultSplitter");
    }
}
