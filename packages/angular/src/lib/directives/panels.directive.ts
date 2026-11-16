// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/LayoutController.tsx (renderTabContents: which tabs render);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import {
    Directive,
    type EmbeddedViewRef,
    effect,
    InjectionToken,
    Injector,
    inject,
    input,
    isSignal,
    type Signal,
    signal,
    TemplateRef,
    untracked,
    ViewContainerRef,
    type WritableSignal,
} from "@angular/core";
import {
    type AnyTypes,
    type DockableTypes,
    type LayoutEngine,
    MAIN_LAYOUT,
    type TabOf,
} from "@fragiola/dockable";
import {
    DOCKABLE,
    DOCKABLE_DRAG_GROUP,
    DOCKABLE_LAYOUT,
    type DockableContext,
    injectDockableContext,
    injectLayoutContext,
    type LayoutContext,
} from "../context";
import { onDestroy } from "../utils/helpers";
import { type SignalContext, signalContext } from "../utils/views";
import type { TypedBy } from "./templates.directive";

/** The context of the `[dockablePanels]` template. */
export interface PanelsContext<T extends DockableTypes = AnyTypes> {
    /** the tab whose panel the template renders (`let-tab`) */
    $implicit: TabOf<T>;
    tab: TabOf<T>;
}

/** What `renderOnDemand` takes: a bare attribute or a boolean, or a decision per tab. */
export type RenderOnDemand<T extends DockableTypes = AnyTypes> =
    | boolean
    | ((tab: TabOf<T>) => boolean);

/** @internal what a panel asks of the `[dockablePanels]` that renders it */
export interface PanelHost {
    /** renders the panel's view again from its template (its content remounts) */
    remount(): void;
}

/** @internal */
export const DOCKABLE_PANEL_HOST = new InjectionToken<PanelHost>(
    "DockablePanelHost",
);

/** A stable key per moveable element, for a drag group's content views. */
const moveableKeys = new WeakMap<HTMLElement, string>();
let nextMoveableKey = 0;
function keyOfMoveable(element: HTMLElement): string {
    let key = moveableKeys.get(element);
    if (key === undefined) {
        key = `moveable-${nextMoveableKey++}`;
        moveableKeys.set(element, key);
    }
    return key;
}

/**
 * An object that reads every property from `target()` when it is read: the context of a view
 * that may move to another root of a drag group.
 */
function delegate<V extends object>(target: Signal<V>): V {
    return new Proxy({} as V, {
        get: (_object, key) => {
            const current = target();
            const value = Reflect.get(current, key);
            return typeof value === "function" && !isSignal(value)
                ? (value as (...args: unknown[]) => unknown).bind(current)
                : value;
        },
        has: (_object, key) => Reflect.has(target(), key),
    });
}

/** The `[dockablePanels]` a view is in, as another layer of a drag group sees it. */
interface PanelsOwner {
    readonly container: ViewContainerRef;
    readonly views: Map<string, PanelView>;
    /** renders the view again from its template */
    remount(entry: PanelView): void;
}

/** A rendered panel view and what it was rendered with. */
interface PanelView {
    view: EmbeddedViewRef<PanelsContext>;
    context: SignalContext<PanelsContext> & PanelsContext;
    /** the roots the view's injections read (retargeted when another root takes the view) */
    dockable: WritableSignal<DockableContext>;
    layout: WritableSignal<LayoutContext>;
    /** the tab id the view renders now */
    tabId: string;
    /** the [dockablePanels] it is in now */
    owner: PanelsOwner;
}

/**
 * The panel layer: `<ng-template dockablePanels let-tab><div [dockablePanel]="tab">…</div>
 * </ng-template>`, once, directly inside `[dockableRoot]` (`[dockablePanels]="model"` types the
 * tab by the model's registry). It renders the template for every tab of every layout of the
 * model whose content should render: the selected tab once its content area has a size, a tab
 * rendered before (content is kept alive), and every tab not rendered on demand. A view is never
 * moved by Angular once rendered: its panel element goes where its layout is.
 */
@Directive({ selector: "ng-template[dockablePanels]" })
export class DockablePanels<T extends DockableTypes = AnyTypes> {
    /** the model, to type the template's tab by its registry (optional) */
    readonly dockablePanels = input<TypedBy<T>>(undefined);
    /**
     * render a tab's content only once it is first shown (default `true`); `false` renders every
     * tab's content at once. A function decides per tab.
     */
    readonly renderOnDemand = input<RenderOnDemand<T>, unknown>(true, {
        transform: (value: unknown): RenderOnDemand<T> =>
            typeof value === "function"
                ? (value as (tab: TabOf<T>) => boolean)
                : value === "" || (value !== "false" && value !== false),
    });

    private readonly context: DockableContext =
        injectDockableContext("[dockablePanels]");
    private readonly layout = injectLayoutContext("[dockablePanels]");
    private readonly template =
        inject<TemplateRef<PanelsContext<T>>>(TemplateRef);
    /** @internal */
    readonly container = inject(ViewContainerRef);
    private readonly injector = inject(Injector);
    private readonly group = inject(DOCKABLE_DRAG_GROUP, { optional: true });

    static ngTemplateContextGuard<T extends DockableTypes>(
        _directive: DockablePanels<T>,
        _context: unknown,
    ): _context is PanelsContext<T> {
        return true;
    }

    /** @internal the views this layer renders, by key */
    readonly views = new Map<string, PanelView>();
    /** bumped when a view is destroyed to be rendered again (`remountInWindow`) */
    private readonly remounts = signal(0);
    private engine: LayoutEngine | undefined;

    constructor() {
        effect(() => {
            this.context.revision();
            const engine = this.context.engine();
            const layers = this.context.layers();
            this.remounts();
            const renderOnDemand = this.renderOnDemand();
            untracked(() => {
                if (engine !== this.engine) {
                    // another model: none of its views can be kept
                    this.clear();
                    this.engine = engine;
                }
                if (!layers.has(MAIN_LAYOUT)) {
                    return; // the root is not attached yet: nothing can host content
                }
                // every layout's tabs, including those whose panel layer is not mounted (yet): the
                // content of a tab moving to a window that is still opening must stay rendered
                const tabs = this.context
                    .model()
                    .get("all-tabs")
                    .filter((tab) =>
                        engine.adapter.shouldRender(
                            tab.id,
                            typeof renderOnDemand === "function"
                                ? renderOnDemand(tab as unknown as TabOf<T>)
                                : renderOnDemand,
                        ),
                    );
                tabs.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
                this.sync(tabs, engine);
            });
        });
        onDestroy(() => this.clear());
    }

    private keyOf(tab: TabOf<AnyTypes>, engine: LayoutEngine): string {
        // in a drag group a view follows the tab's moveable element, which a transferred tab
        // adopts (two models' tabs may share an id)
        return this.group
            ? keyOfMoveable(engine.adapter.getMoveableElement(tab.id))
            : tab.id;
    }

    /** views to render again from the template on the next pass */
    private readonly stale = new Set<PanelView>();

    /** @internal renders a view again from the template, on the next pass */
    remount(entry: PanelView): void {
        this.stale.add(entry);
        this.remounts.update((value) => value + 1);
    }

    private sync(tabs: readonly TabOf<AnyTypes>[], engine: LayoutEngine) {
        const keep = new Map(tabs.map((tab) => [this.keyOf(tab, engine), tab]));
        for (const [key, entry] of this.views) {
            if (!keep.has(key)) {
                this.views.delete(key);
                this.drop(key, entry);
            }
        }
        for (const [key, tab] of keep) {
            const current = this.views.get(key);
            if (current && this.stale.has(current)) {
                this.stale.delete(current);
                this.views.delete(key);
                current.view.destroy();
            }
            const entry =
                this.views.get(key) ?? this.adopt(key) ?? this.create(key, tab);
            entry.tabId = tab.id;
            entry.context.update({ $implicit: tab, tab });
        }
    }

    /** A view another layer of the drag group renders under `key` (a tab that moved here). */
    private adopt(key: string): PanelView | undefined {
        const owned = this.group?.views.get(key);
        if (!owned) {
            return undefined;
        }
        const entry = owned.view as PanelView;
        if (entry.owner !== this) {
            const from = entry.owner.container;
            const index = from.indexOf(entry.view);
            if (index !== -1) {
                from.detach(index);
            }
            entry.owner.views.delete(key);
            this.container.insert(entry.view);
            entry.owner = this;
            entry.dockable.set(this.context);
            entry.layout.set(this.layout);
        } else if (this.container.indexOf(entry.view) === -1) {
            this.container.insert(entry.view);
        }
        this.group?.views.set(key, this, entry);
        this.views.set(key, entry);
        return entry;
    }

    private create(key: string, tab: TabOf<AnyTypes>): PanelView {
        const dockable = signal(this.context);
        const layout = signal(this.layout);
        // the layer that renders the view now (another root's, after a drag group transfer)
        const host: PanelHost = { remount: () => entry.owner.remount(entry) };
        const providers = [{ provide: DOCKABLE_PANEL_HOST, useValue: host }];
        if (this.group) {
            providers.push(
                { provide: DOCKABLE, useValue: delegate(dockable) as never },
                {
                    provide: DOCKABLE_LAYOUT,
                    useValue: delegate(layout) as never,
                },
            );
        }
        const context = signalContext<PanelsContext>({ $implicit: tab, tab });
        const view = this.container.createEmbeddedView(
            this.template as unknown as TemplateRef<PanelsContext>,
            context,
            {
                injector: Injector.create({
                    providers,
                    parent: this.injector,
                }),
            },
        );
        const entry: PanelView = {
            view,
            context,
            dockable,
            layout,
            tabId: tab.id,
            owner: this,
        };
        this.views.set(key, entry);
        this.group?.views.set(key, this, entry);
        return entry;
    }

    /** Destroys a view that no longer renders; in a drag group, another layer may take it first. */
    private drop(key: string, entry: PanelView) {
        if (!this.group) {
            entry.view.destroy();
            return;
        }
        const index = this.container.indexOf(entry.view);
        if (index !== -1) {
            this.container.detach(index);
        }
        this.group.views.release(key, this, () => entry.view.destroy());
    }

    private clear() {
        for (const [key, entry] of this.views) {
            this.drop(key, entry);
        }
        this.views.clear();
    }
}
