import {
    ApplicationRef,
    type ComponentRef,
    createComponent,
    type EmbeddedViewRef,
    EnvironmentInjector,
    Injector,
    inject,
    signal,
    type TemplateRef,
    type Type,
    untracked,
    type ViewContainerRef,
    type ViewRef,
    type WritableSignal,
} from "@angular/core";

/**
 * A template context whose fields are signals behind getters: a view reads them while it renders,
 * so setting a field renders that view again, and nothing else.
 */
export class SignalContext<V extends object> {
    private readonly fields: { [K in keyof V]: WritableSignal<V[K]> };

    constructor(initial: V) {
        const fields = {} as { [K in keyof V]: WritableSignal<V[K]> };
        for (const key of Object.keys(initial) as (keyof V)[]) {
            fields[key] = signal(initial[key]);
            Object.defineProperty(this, key, {
                enumerable: true,
                get: () => fields[key](),
            });
        }
        this.fields = fields;
    }

    /** Sets the fields that changed. */
    update(next: V): void {
        for (const key of Object.keys(next) as (keyof V)[]) {
            const field = this.fields[key];
            if (!Object.is(untracked(field), next[key])) {
                field.set(next[key]);
            }
        }
    }
}

/** A {@link SignalContext}, seen as the context type its template declares. */
export function signalContext<V extends object>(
    initial: V,
): SignalContext<V> & V {
    return new SignalContext(initial) as SignalContext<V> & V;
}

/** An entry of {@link KeyedViews.sync}: a key, how to create its view at an index, how to update it. */
export interface KeyedItem<R extends ViewRef = ViewRef> {
    key: string;
    create: (index: number) => R;
    update?: (view: R) => void;
}

/**
 * The views of a container, one per key, in the order of the last `sync`: a key that stays keeps
 * its view (moved when its place changed), a new key creates one, a key that goes destroys its
 * view. As a keyed `@for`, but for the parts that insert views of different templates.
 */
export class KeyedViews<R extends ViewRef = ViewRef> {
    private readonly views = new Map<string, R>();

    /** `null`: the views are in no container (their nodes are placed by the caller) */
    constructor(private readonly container: ViewContainerRef | null) {}

    sync(items: readonly KeyedItem<R>[]): void {
        untracked(() => {
            const keep = new Set(items.map((item) => item.key));
            for (const [key, view] of this.views) {
                if (!keep.has(key)) {
                    view.destroy();
                    this.views.delete(key);
                }
            }
            items.forEach((item, index) => {
                let view = this.views.get(item.key);
                if (!view) {
                    view = item.create(index);
                    this.views.set(item.key, view);
                } else if (
                    this.container &&
                    this.container.indexOf(view) !== index
                ) {
                    this.container.move(view, index);
                }
                item.update?.(view);
            });
        });
    }

    get(key: string): R | undefined {
        return this.views.get(key);
    }

    clear(): void {
        for (const view of this.views.values()) {
            view.destroy();
        }
        this.views.clear();
    }
}

/** The root nodes of an embedded view (its elements, text and anchors), as they are now. */
export function rootNodesOf(view: EmbeddedViewRef<unknown>): Node[] {
    return view.rootNodes as Node[];
}

/**
 * Creates views in no container, checked with the application: their nodes go where the caller
 * puts them. A container would add its anchor and its views to the root nodes of the view its
 * element is in, and a move of that view would take them along.
 */
export class DetachedViews {
    private readonly app = inject(ApplicationRef);
    private readonly environment = inject(EnvironmentInjector);
    private readonly injector = inject(Injector);

    embedded<C>(template: TemplateRef<C>, context: C): EmbeddedViewRef<C> {
        const view = template.createEmbeddedView(context, this.injector);
        this.app.attachView(view);
        return view;
    }

    component<C>(type: Type<C>): ComponentRef<C> {
        const ref = createComponent(type, {
            environmentInjector: this.environment,
            elementInjector: this.injector,
        });
        this.app.attachView(ref.hostView);
        return ref;
    }
}
