// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabButton.tsx (APG keyboard handling, roving tab stop, ARIA);
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
    getTabButtonPath,
    type TabOf,
} from "@fragiola/dockable";
import {
    DOCKABLE_TAB_LIST,
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
} from "./context";
import { DragNodeBinding } from "./drag-node.directive";
import { hiddenTabsSignal, registerElement } from "./internal";
import {
    beforeInputs,
    bindStructuralStyle,
    dataAttr,
    injectHost,
} from "./utils";

export interface TabState {
    /** the tab is its tabset's selected tab */
    selected: boolean;
    /** the tab is pinned */
    pinned: boolean;
    /** the tab is being dragged */
    dragging: boolean;
    /** the tab can be popped out into a window */
    poppable: boolean;
    /** the tab does not fit in its strip, so it is hidden (tab overflow) */
    overflowHidden: boolean;
}

/** A tab's state before its input is set (see `beforeInputs`). */
const UNSET_TAB_STATE: TabState = {
    selected: false,
    pinned: false,
    dragging: false,
    poppable: false,
    overflowHidden: false,
};

/**
 * A tab button (`role="tab"`): `<div [dockableTab]="tab">{{ tab.label }}</div>`, following the APG
 * tabs pattern with manual activation: arrow keys (along the tab list's orientation, mirrored in
 * RTL), Home and End move focus; click, Enter or Space selects. Enter or Space on the selected tab
 * moves focus into its panel. It renders only its own content, and is its tab's drag handle.
 */
@Directive({
    selector: "[dockableTab]",
    exportAs: "dockableTab",
    host: {
        role: "tab",
        "[attr.id]": "aria().id",
        "[attr.aria-selected]": "aria().selected",
        "[attr.aria-controls]": "aria().controls",
        "[attr.aria-keyshortcuts]": "aria().keyShortcuts",
        "[attr.tabindex]": "aria().tabindex",
        "[attr.draggable]": "drag.draggable()",
        "[attr.data-layout-path]": "data().path",
        "[attr.data-selected]": "data().selected",
        "[attr.data-pinned]": "data().pinned",
        "[attr.data-dragging]": "data().dragging",
        "[attr.data-poppable]": "data().poppable",
        "[attr.data-overflow-hidden]": "data().overflowHidden",
        "(dragstart)": "drag.onDragStart($event)",
        "(dragend)": "drag.onDragEnd()",
        "(click)": "onClick()",
        "(keydown)": "onKeyDown($event)",
    },
})
export class DockableTab<T extends DockableTypes = AnyTypes> {
    readonly dockableTab = input.required<TabOf<T>>();

    private readonly context: DockableContext =
        injectDockableContext("[dockableTab]");
    private readonly layout = injectLayoutContext("[dockableTab]");
    private readonly host = injectHost();
    private readonly list = inject(DOCKABLE_TAB_LIST, { optional: true });
    private readonly id = computed(() => this.dockableTab().id);
    private readonly containerId = computed(() => {
        this.context.revision();
        return (
            this.context.model().get("node-parent-by", { nodeId: this.id() })
                ?.id ?? ""
        );
    });
    private readonly hidden = hiddenTabsSignal(this.layout.engine, () =>
        this.containerId(),
    );
    protected readonly drag = new DragNodeBinding(
        this.context,
        this.layout.engine,
        this.context.model,
        () => this.id(),
        this.host,
    );

    /** what the tab shows as `data-*` */
    readonly state: Signal<TabState> = computed(() => {
        return beforeInputs(UNSET_TAB_STATE, () => {
            this.context.revision();
            const tabId = this.id();
            return {
                selected: this.context.model().is("tab-selected", { tabId }),
                pinned: this.dockableTab().pinned === true,
                dragging: this.drag.state().dragging,
                // supported, and the model accepts `tab.popout` for it now
                poppable: this.layout.engine().can("popout", { nodeId: tabId }),
                overflowHidden: this.hidden().includes(tabId),
            };
        });
    });

    protected readonly aria = computed(() => {
        this.context.keyMap();
        const state = this.state();
        const engine = this.layout.engine();
        const tabId = this.id();
        return {
            id: engine.get("tab-button-dom-id-by", { tabId }),
            selected: state.selected ? "true" : "false",
            controls: engine.get("tab-panel-dom-id-by", { tabId }),
            keyShortcuts: engine.adapter.getKeyShortcuts("tab", tabId) ?? null,
            tabindex: engine.is("tab-tabbable", { tabId }) ? "0" : "-1",
        };
    });

    protected readonly data = computed(() => {
        const state = this.state();
        return {
            path: getTabButtonPath(
                this.layout
                    .engine()
                    .get("layout-path-by", { nodeId: this.id() }),
            ),
            selected: dataAttr(state.selected),
            pinned: dataAttr(state.pinned),
            dragging: dataAttr(state.dragging),
            poppable: dataAttr(state.poppable),
            overflowHidden: dataAttr(state.overflowHidden),
        };
    });

    constructor() {
        effect((onCleanup) => {
            const engine = this.layout.engine();
            const tabId = this.id();
            untracked(() => {
                onCleanup(
                    registerElement(
                        engine,
                        `tabbutton:${tabId}`,
                        this.host,
                        (registered) =>
                            engine.adapter.registerMeasurable(
                                tabId,
                                "tabbutton",
                                registered,
                            ),
                    ),
                );
                this.context.scheduleMeasure(engine);
            });
        });
        // a tab that does not fit is taken out of the strip (tab overflow)
        bindStructuralStyle(this.host, () =>
            this.state().overflowHidden ? { display: "none" } : {},
        );
    }

    /** the core's rules: a press selects (or closes a border's open panel) */
    protected onClick(): void {
        this.layout.engine().adapter.handleTabClick(this.id());
    }

    /** the APG tab keys and the key map's tab keys */
    protected onKeyDown(event: KeyboardEvent): void {
        this.layout.engine().adapter.handleTabKeyDown(this.id(), event, {
            element: this.host,
            orientation: this.list?.() ?? "horizontal",
        });
    }
}
