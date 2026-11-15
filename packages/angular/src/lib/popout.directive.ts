// Behaviour adapted from FlexLayout (https://github.com/caplin/FlexLayout), src/view/layout/FloatingWindowContainer.tsx and src/view/PopoutWindow.tsx (per-window rendering);
// the markup and class names are not copied. Copyright (c) 2017 Caplin Systems Ltd. MIT licence,
// see LICENSE.

import {
    computed,
    Directive,
    type EmbeddedViewRef,
    effect,
    forwardRef,
    inject,
    input,
    type Signal,
    TemplateRef,
    untracked,
    ViewContainerRef,
} from "@angular/core";
import type {
    AnyTypes,
    DockableTypes,
    LayoutEngine,
    WindowLayout,
} from "@fragiola/dockable";
import {
    DOCKABLE_LAYOUT,
    type DockableContext,
    injectDockableContext,
    type LayoutContext,
} from "./context";
import type { TypedBy } from "./templates";
import { bindStructuralStyle, fromStore, injectHost, onDestroy } from "./utils";
import { type SignalContext, signalContext } from "./views";

export interface PopoutState {
    /** the id of the window layout */
    layoutId: string;
}

/** The context of the `[dockablePopout]` template. */
export interface PopoutContext<T extends DockableTypes = AnyTypes> {
    /** the window layout the template renders (`let-layout`) */
    $implicit: WindowLayout<T>;
    layout: WindowLayout<T>;
}

/** a key per engine, so a window that gets another engine renders its layout again */
const engineKeys = new WeakMap<LayoutEngine, number>();
let nextEngineKey = 0;
function keyOfEngine(engine: LayoutEngine): number {
    let key = engineKeys.get(engine);
    if (key === undefined) {
        key = nextEngineKey++;
        engineKeys.set(engine, key);
    }
    return key;
}

/**
 * The popout windows: `<ng-template dockablePopout let-layout><div [dockablePopoutLayout]="layout">
 * <div dockableRow>…</div></div></ng-template>`, once, directly inside `[dockableRoot]`. The core
 * keeps a native window open for every window layout of the state; once one is ready (styles
 * copied), the template is rendered into it. A bare `dockableRow` inside the
 * `[dockablePopoutLayout]` renders that layout's root row, and the panels of the tabs in that
 * layout are positioned in it. Pop a tab out with `tab.popout`.
 */
@Directive({ selector: "ng-template[dockablePopout]" })
export class DockablePopout<T extends DockableTypes = AnyTypes> {
    /** the model, to type the template's layout by its registry (optional) */
    readonly dockablePopout = input<TypedBy<T>>(undefined);

    static ngTemplateContextGuard<T extends DockableTypes>(
        _directive: DockablePopout<T>,
        _context: unknown,
    ): _context is PopoutContext<T> {
        return true;
    }

    private readonly context: DockableContext =
        injectDockableContext("[dockablePopout]");
    private readonly template =
        inject<TemplateRef<PopoutContext<T>>>(TemplateRef);
    private readonly container = inject(ViewContainerRef);
    private readonly manager = computed(() =>
        this.context.engine().adapter.getPopoutManager(),
    );
    private readonly windows = fromStore(
        () => this.manager().subscribe,
        () => this.manager().getSnapshot(),
    );
    private readonly views = new Map<
        string,
        {
            view: EmbeddedViewRef<PopoutContext>;
            context: SignalContext<PopoutContext>;
        }
    >();

    constructor() {
        effect(() => {
            this.context.revision();
            this.windows();
            const manager = this.manager();
            const layouts = this.context.model().get("windows");
            untracked(() => {
                const keep = new Set<string>();
                for (const layout of layouts) {
                    // the core owns the window (it opens one per window layout while the root is
                    // attached); nothing renders until it is ready
                    const contentRoot = manager.getContentRoot(layout.id);
                    const engine = manager.getLayoutEngine(layout.id);
                    if (!contentRoot || !engine) {
                        continue;
                    }
                    const key = `${layout.id}:${keyOfEngine(engine)}`;
                    keep.add(key);
                    const existing = this.views.get(key);
                    if (existing) {
                        existing.context.update({ $implicit: layout, layout });
                        continue;
                    }
                    const context = signalContext<PopoutContext>({
                        $implicit: layout,
                        layout,
                    });
                    const view = this.container.createEmbeddedView(
                        this.template as unknown as TemplateRef<PopoutContext>,
                        context,
                    );
                    contentRoot.append(...(view.rootNodes as Node[]));
                    this.views.set(key, { view, context });
                }
                for (const [key, { view }] of this.views) {
                    if (!keep.has(key)) {
                        view.destroy();
                        this.views.delete(key);
                    }
                }
            });
        });
        onDestroy(() => {
            for (const { view } of this.views.values()) {
                view.destroy();
            }
            this.views.clear();
        });
    }
}

/**
 * The root of a window layout, inside the popout document: the root element of the
 * `[dockablePopout]` template (`<div [dockablePopoutLayout]="layout">`). It fills the window and
 * is the containing block its panels are positioned in; the parts inside it render that layout.
 */
@Directive({
    selector: "[dockablePopoutLayout]",
    exportAs: "dockablePopoutLayout",
    providers: [
        {
            provide: DOCKABLE_LAYOUT,
            useExisting: forwardRef(() => DockablePopoutLayout),
        },
    ],
    host: {
        "[attr.data-layout-path]": "path()",
    },
})
export class DockablePopoutLayout<T extends DockableTypes = AnyTypes>
    implements LayoutContext
{
    readonly dockablePopoutLayout = input.required<WindowLayout<T>>();

    private readonly context: DockableContext = injectDockableContext(
        "[dockablePopoutLayout]",
    );
    private readonly host = injectHost();
    private readonly manager = computed(() =>
        this.context.engine().adapter.getPopoutManager(),
    );
    private readonly windows = fromStore(
        () => this.manager().subscribe,
        () => this.manager().getSnapshot(),
    );

    readonly layoutId: Signal<string> = computed(
        () => this.dockablePopoutLayout().id,
    );
    readonly engine: Signal<LayoutEngine> = computed(() => {
        this.windows();
        const engine = this.manager().getLayoutEngine(this.layoutId());
        if (!engine) {
            throw new Error(
                `[dockablePopoutLayout]: window "${this.layoutId()}" is not open`,
            );
        }
        return engine;
    });

    /** what the window layout shows */
    readonly state: Signal<PopoutState> = computed(() => ({
        layoutId: this.layoutId(),
    }));

    protected readonly path = computed(() => {
        this.context.revision();
        return (
            this.engine().get("layout-path-by", {
                nodeId: this.dockablePopoutLayout().root.id,
            }) || `/${this.layoutId()}`
        );
    });

    constructor() {
        // fills the popout window and is the containing block its panels are positioned in
        bindStructuralStyle(this.host, () => ({
            position: "absolute",
            inset: 0,
        }));
        effect((onCleanup) => {
            const engine = this.engine();
            const layoutId = this.layoutId();
            untracked(() => {
                engine.adapter.attachRoot(this.host);
                // the window's panels are positioned in this element
                this.context.setLayer(layoutId, this.host);
                this.context.scheduleMeasure(engine);
            });
            onCleanup(() => {
                engine.adapter.detachRoot();
                this.context.setLayer(layoutId, null);
            });
        });
        // the window layout's measure-and-position cycle, after every render of the layout
        effect(() => {
            this.context.revision();
            const engine = this.engine();
            untracked(() => {
                engine.adapter.prepare();
                this.context.scheduleMeasure(engine);
            });
        });
    }
}
