// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/Tab.tsx and src/view/TabContentRenderer.tsx (panel container and content portal);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import {
    computed,
    Directive,
    effect,
    inject,
    input,
    type Signal,
    untracked,
} from "@angular/core";
import {
    type AnyTypes,
    type DockableTypes,
    MAIN_LAYOUT,
    MOVEABLE_ATTRIBUTE,
    type TabOf,
} from "@fragiola/dockable";
import { type DockableContext, injectDockableContext } from "../context";
import {
    bindStructuralStyle,
    booleanInput,
    dataAttr,
    injectHost,
    onDestroy,
} from "../utils/helpers";
import { DOCKABLE_PANEL_HOST } from "./panels.directive";

export interface PanelState {
    /** the tab is its tabset's selected tab */
    selected: boolean;
    /** the panel is shown (selected, and not hidden by another tabset being maximized) */
    visible: boolean;
    /** the tab's tabset is its layout's active tabset (always false in a border) */
    tabsetActive: boolean;
}

/**
 * A tab's content panel (`role="tabpanel"`): `<div [dockablePanel]="tab">…content…</div>`, the
 * root element of the `[dockablePanels]` template. The engine positions it over its tabset's
 * content area (or a border's, or a popout window's) and shows or hides it (structural style
 * only). Its content is moved into the tab's moveable element, which the engine re-parents into
 * whichever panel is current: moving a tab to another tabset, border or window never re-creates
 * the content.
 */
@Directive({
    selector: "[dockablePanel]",
    exportAs: "dockablePanel",
    host: {
        role: "tabpanel",
        tabindex: "-1",
        "[attr.id]": "aria().id",
        "[attr.aria-labelledby]": "aria().labelledBy",
        "[attr.aria-keyshortcuts]": "aria().keyShortcuts",
        "[attr.data-layout-path]": "data().path",
        "[attr.data-selected]": "data().selected",
        "[attr.data-visible]": "data().visible",
        "[attr.data-tabset-active]": "data().tabsetActive",
        "(pointerdown)": "onPointerDown()",
        "(keydown)": "onKeyDown($event)",
    },
})
export class DockablePanel<T extends DockableTypes = AnyTypes> {
    readonly dockablePanel = input.required<TabOf<T>>();
    /** the content element scrolls its overflow (default `true`); `false` clips it */
    readonly scrollable = input(true, { transform: booleanInput });
    /**
     * remount the content when the tab moves to another window (default `false`: the same
     * content moves, keeping its state). For content bound to its document (an iframe, a canvas
     * context).
     */
    readonly remountInWindow = input(false, { transform: booleanInput });

    private readonly context: DockableContext =
        injectDockableContext("[dockablePanel]");
    private readonly panels = inject(DOCKABLE_PANEL_HOST, { optional: true });
    private readonly host = injectHost();
    private readonly id = computed(() => this.dockablePanel().id);
    private readonly layoutId = computed(() => {
        this.context.revision();
        return (
            this.context.model().get("layout-id-by", { nodeId: this.id() }) ??
            MAIN_LAYOUT
        );
    });
    /** the engine of the layout the tab is in */
    private readonly layoutEngine = computed(() => {
        // a window's engine comes and goes with its window, not only with the tab's layout
        this.context.revision();
        this.layoutId();
        return this.context.engine().adapter.engineOf(this.id());
    });
    /** the content nodes moved into the moveable element */
    private content: Node[] | undefined;
    /** the moveable element the content was moved into */
    private moveable: HTMLElement | undefined;
    /** the layer the panel was put in last */
    private placedIn: HTMLElement | undefined;

    /** what the panel shows as `data-*` */
    readonly state: Signal<PanelState> = computed(() => {
        this.context.revision();
        const tabId = this.id();
        return {
            selected: this.context.model().is("tab-selected", { tabId }),
            // the engine's own rule, so the state always matches what it displays
            visible: this.context.engine().is("tab-panel-visible", { tabId }),
            tabsetActive: this.context
                .model()
                .is("tab-in-active-tabset", { tabId }),
        };
    });

    protected readonly aria = computed(() => {
        this.context.revision();
        this.context.keyMap();
        const engine = this.context.engine();
        const tabId = this.id();
        return {
            id: engine.get("tab-panel-dom-id-by", { tabId }),
            labelledBy: engine.get("tab-button-dom-id-by", { tabId }),
            keyShortcuts: engine.adapter.getKeyShortcuts("panel") ?? null,
        };
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            path: this.layoutEngine().get("layout-path-by", {
                nodeId: this.id(),
            }),
            selected: dataAttr(state.selected),
            visible: dataAttr(state.visible),
            tabsetActive: dataAttr(state.tabsetActive),
        };
    });

    constructor() {
        // absolute from the start, so it never joins the layout's flow before the engine positions
        // it; the engine writes the geometry and the display
        bindStructuralStyle(this.host, () => ({ position: "absolute" }));

        // the panel goes into its layout's layer and is registered with that layout's engine; the
        // content goes into the moveable element, which goes into the panel. With no layer (the
        // window is still opening) the content is parked, so it stays in a document
        let lastLayout: string | undefined;
        effect((onCleanup) => {
            const tabId = this.id();
            const layoutId = this.layoutId();
            const engine = this.layoutEngine();
            const main = this.context.engine();
            const layer = this.context.layers().get(layoutId);
            const scrollable = this.scrollable();
            const remountInWindow = this.remountInWindow();
            untracked(() => {
                if (
                    remountInWindow &&
                    lastLayout !== undefined &&
                    lastLayout !== layoutId &&
                    this.panels
                ) {
                    // content bound to its document: a new view in the new window
                    this.panels.remount();
                    return;
                }
                lastLayout = layoutId;
                const moveable = main.adapter.getMoveableElement(tabId);
                if (this.content === undefined) {
                    this.content = [...this.host.childNodes].filter(
                        (node) => node !== moveable,
                    );
                    moveable.append(...this.content);
                }
                this.moveable = moveable;
                if (!layer) {
                    main.adapter.releaseMoveable(tabId, this.host, {
                        remountInWindow,
                    });
                    this.host.remove();
                    this.placedIn = undefined;
                    return;
                }
                if (this.placedIn !== layer || this.host.parentNode !== layer) {
                    // after the layout's other children: panels paint above them
                    layer.appendChild(this.host);
                    this.placedIn = layer;
                }
                engine.adapter.registerTabPanel(tabId, this.host);
                main.adapter.attachMoveable(tabId, this.host, { scrollable });
                this.context.scheduleMeasure(engine);
                onCleanup(() => engine.adapter.registerTabPanel(tabId, null));
            });
        });

        onDestroy(() => {
            const tabId = untracked(this.id);
            const main = untracked(this.context.engine);
            // the content is this view's, the blocks it rendered later included: it goes with it
            // (only this view renders into the tab's moveable element)
            if (this.moveable?.hasAttribute(MOVEABLE_ATTRIBUTE)) {
                this.moveable.replaceChildren();
            }
            main.adapter.releaseMoveable(tabId, this.host, {
                remountInWindow: untracked(this.remountInWindow),
            });
        });
    }

    protected onPointerDown(): void {
        this.context.engine().adapter.handlePanelPointerDown(this.id());
    }

    /**
     * the key map's focus key (pressed anywhere within the tab content) returns focus to the tab
     * button
     */
    protected onKeyDown(event: KeyboardEvent): void {
        if (
            this.context
                .engine()
                .adapter.handlePanelKeyDown(this.id(), event, this.host)
        ) {
            event.stopPropagation();
        }
    }
}
