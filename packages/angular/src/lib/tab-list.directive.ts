// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/TabSet.tsx (the tab strip's ARIA and key shortcuts);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import {
    computed,
    contentChild,
    Directive,
    effect,
    inject,
    input,
    type Signal,
    type TemplateRef,
    untracked,
} from "@angular/core";
import { getTabStripPath } from "@fragiola/dockable";
import {
    DOCKABLE_TAB_LIST,
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
} from "./context";
import { dropStateSignal, hiddenTabsSignal, registerElement } from "./internal";
import { injectTabContainer } from "./tabset.directive";
import { DockableTabListItem, type TabListItemContext } from "./templates";
import { booleanInput, dataAttr, injectHost } from "./utils";
import { KeyedViews, signalContext } from "./views";

export interface TabListState {
    orientation: "horizontal" | "vertical";
    /** the current drag would drop into this tab strip */
    dropTarget: boolean;
    /** while it is the drop target: the insertion index in the strip */
    dropIndex: number | undefined;
    /** some tabs do not fit, so they are hidden (list them with `[dockableTabOverflowTrigger]`) */
    overflowing: boolean;
}

/**
 * The tab strip (`role="tablist"`) of a tabset or a border: `<div dockableTabList
 * aria-label="…">`. Renders its `<ng-template dockableTabListItem let-tab>` per tab. Arrow keys
 * along the orientation (Left and Right swap in RTL, where a horizontal strip runs from the
 * right), Home and End move focus between tabs; Enter or Space selects.
 */
@Directive({
    selector: "[dockableTabList]",
    exportAs: "dockableTabList",
    providers: [
        {
            provide: DOCKABLE_TAB_LIST,
            // the tabs read the orientation the list resolved
            useFactory: () => inject(DockableTabList).resolvedOrientation,
        },
    ],
    host: {
        role: "tablist",
        "[attr.aria-orientation]": "state().orientation",
        "[attr.aria-keyshortcuts]": "keyShortcuts()",
        "[attr.data-layout-path]": "data().path",
        "[attr.data-orientation]": "state().orientation",
        "[attr.data-drop-target]": "data().dropTarget",
        "[attr.data-drop-index]": "data().dropIndex",
        "[attr.data-overflowing]": "data().overflowing",
    },
})
export class DockableTabList {
    /**
     * the direction the tabs are laid out in, for arrow key navigation; default horizontal
     * (vertical in a start or end border)
     */
    readonly orientation = input<"horizontal" | "vertical" | undefined>(
        undefined,
    );
    /**
     * tab overflow: the tabs that do not fit are hidden (the selected one stays), for a
     * `[dockableTabOverflowTrigger]` to list; `false` keeps every tab, for a strip that wraps or
     * scrolls. Default `true`
     */
    readonly overflow = input(true, { transform: booleanInput });

    private readonly context: DockableContext =
        injectDockableContext("[dockableTabList]");
    private readonly layout = injectLayoutContext("[dockableTabList]");
    private readonly host = injectHost();
    private readonly container = injectTabContainer("[dockableTabList]");
    private readonly item = contentChild(DockableTabListItem, {
        descendants: false,
    });
    private readonly id = computed(() => this.container().id);
    private readonly inBorder = computed(
        () => this.container().type === "border",
    );

    /** the list's orientation (its input, else the container's) */
    readonly resolvedOrientation: Signal<"horizontal" | "vertical"> = computed(
        () => {
            const given = this.orientation();
            if (given) {
                return given;
            }
            const container = this.container();
            return container.type === "border" &&
                (container.location === "start" || container.location === "end")
                ? "vertical"
                : "horizontal";
        },
    );
    private readonly hidden = hiddenTabsSignal(this.layout.engine, () =>
        this.id(),
    );
    private readonly drop = dropStateSignal(this.layout.engine, () =>
        this.id(),
    );

    /** what the list shows as `data-*` */
    readonly state: Signal<TabListState> = computed(() => ({
        orientation: this.resolvedOrientation(),
        dropTarget: this.drop().index !== undefined,
        dropIndex: this.drop().index,
        overflowing: this.hidden().length > 0,
    }));

    protected readonly keyShortcuts = computed(() => {
        this.context.revision();
        this.context.keyMap();
        return this.layout.engine().adapter.getKeyShortcuts("tablist") ?? null;
    });

    protected readonly data = computed(() => {
        // the path moves with the layout (a tabset inserted before this one): read the revision
        this.context.revision();
        const state = this.state();
        return {
            path: getTabStripPath(
                this.layout
                    .engine()
                    .get("layout-path-by", { nodeId: this.id() }),
            ),
            dropTarget: dataAttr(state.dropTarget),
            dropIndex: dataAttr(state.dropIndex),
            overflowing: dataAttr(state.overflowing),
        };
    });

    constructor() {
        // the strip is measured (a border's is measured as a whole by [dockableBorder]), and the
        // tabs that do not fit in the list are hidden (tab overflow)
        effect((onCleanup) => {
            const engine = this.layout.engine();
            const containerId = this.id();
            const inBorder = this.inBorder();
            const vertical = this.resolvedOrientation() === "vertical";
            const overflow = this.overflow();
            untracked(() => {
                const unregisterStrip = inBorder
                    ? undefined
                    : registerElement(
                          engine,
                          `tabstrip:${containerId}`,
                          this.host,
                          (registered) =>
                              engine.adapter.registerMeasurable(
                                  containerId,
                                  "tabstrip",
                                  registered,
                              ),
                      );
                const unregisterList = registerElement(
                    engine,
                    `tablist:${containerId}`,
                    this.host,
                    (registered) =>
                        engine.adapter.registerTabList(
                            containerId,
                            registered && overflow ? registered : null,
                            vertical,
                        ),
                );
                this.context.scheduleMeasure(engine);
                onCleanup(() => {
                    unregisterStrip?.();
                    unregisterList();
                });
            });
        });

        // a view per tab, in the container's order
        let views: KeyedViews | undefined;
        let template: object | undefined;
        effect(() => {
            const item = this.item();
            const tabs = this.container().children;
            untracked(() => {
                if (item !== template) {
                    views?.clear();
                    template = item;
                    views = item
                        ? new KeyedViews(item.viewContainer)
                        : undefined;
                }
                if (!item || !views) {
                    return;
                }
                views.sync(
                    tabs.map((tab) => ({
                        key: tab.id,
                        create: (index) =>
                            item.viewContainer.createEmbeddedView(
                                item.template as unknown as TemplateRef<TabListItemContext>,
                                signalContext<TabListItemContext>({
                                    $implicit: tab,
                                    tab,
                                }),
                                { index },
                            ),
                        update: (view) =>
                            (
                                view as unknown as {
                                    context: {
                                        update(next: TabListItemContext): void;
                                    };
                                }
                            ).context.update({ $implicit: tab, tab }),
                    })),
                );
            });
        });
    }
}
