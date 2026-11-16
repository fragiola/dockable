import {
    DragGroup as CoreDragGroup,
    type TransferListener,
} from "@fragiola/dockable";
import {
    defineComponent,
    Fragment,
    h,
    type InjectionKey,
    inject,
    onUnmounted,
    type PropType,
    provide,
    shallowRef,
    Teleport,
    type VNodeChild,
} from "vue";
import {
    type DockableContextValue,
    DockableKey,
    type LayoutContextValue,
    LayoutKey,
    ModelKey,
} from "../context";
import type { DockableComponent, SlotFunction } from "../utils/primitive";

/** What a panel hands the group's host: its content and the context the content needs. */
interface ContentEntry {
    owner: object;
    container: HTMLElement;
    render: () => VNodeChild;
    dockable: DockableContextValue;
    layout: LayoutContextValue;
}

/**
 * Where the content of every tab of a drag group renders: one place for all the group's roots,
 * keyed by the tab's moveable element (which a transferred tab adopts). A panel registers its
 * content (and the context it needs) here instead of teleporting it itself, so a tab moving from
 * one root to another keeps its key, its teleport and the state of the components under it.
 */
export class ContentRegistry {
    private readonly entries = new Map<string, ContentEntry>();
    private readonly removals = new Map<
        string,
        ReturnType<typeof setTimeout>
    >();
    /** bumped on every change: the host renders again */
    readonly version = shallowRef(0);

    /** Adds (or updates) the content under `key`; `entry.owner` identifies the panel rendering it. */
    set(key: string, entry: ContentEntry) {
        const pending = this.removals.get(key);
        if (pending !== undefined) {
            clearTimeout(pending);
            this.removals.delete(key);
        }
        this.entries.set(key, entry);
        this.version.value++;
    }

    /**
     * Removes the content under `key` if `owner` still renders it. Deferred to the next task: a
     * tab moving to another root unmounts its old panel and mounts the new one, possibly in two
     * renders, and the content must not unmount in between.
     */
    remove(key: string, owner: object) {
        if (this.entries.get(key)?.owner !== owner || this.removals.has(key)) {
            return;
        }
        this.removals.set(
            key,
            setTimeout(() => {
                this.removals.delete(key);
                if (this.entries.get(key)?.owner === owner) {
                    this.entries.delete(key);
                    this.version.value++;
                }
            }, 0),
        );
    }

    render(): VNodeChild[] {
        return [...this.entries].map(([key, entry]) =>
            h(Teleport, { to: entry.container, key }, [
                h(ContentContext, { entry }),
            ]),
        );
    }
}

/**
 * Renders a panel's content with the panel's context: the injections of the layout it is in
 * now, which change when the tab moves to another root of the group.
 */
const ContentContext = defineComponent({
    name: "DockableContentContext",
    props: {
        entry: { type: Object as PropType<ContentEntry>, required: true },
    },
    setup(props) {
        provide(
            DockableKey,
            delegate(() => props.entry.dockable),
        );
        provide(
            LayoutKey,
            delegate(() => props.entry.layout),
        );
        provide(
            ModelKey,
            delegate(() => props.entry.dockable.model),
        );
        return () => props.entry.render();
    },
});

/** An object that reads every property from `current()` when it is read. */
function delegate<V extends object>(current: () => V): V {
    return new Proxy({} as V, {
        get: (_target, key) => Reflect.get(current(), key),
        has: (_target, key) => Reflect.has(current(), key),
    });
}

/** Renders every content of the group's registry, each teleported into its moveable element. */
const ContentHost = defineComponent({
    name: "DockableContentHost",
    props: {
        registry: { type: Object as PropType<ContentRegistry>, required: true },
    },
    setup(props) {
        return () => {
            props.registry.version.value;
            return h(Fragment, props.registry.render());
        };
    },
});

export interface DragGroupContextValue {
    group: CoreDragGroup;
    registry: ContentRegistry;
}

export const DragGroupKey: InjectionKey<DragGroupContextValue> =
    Symbol("DockableDragGroup");

export interface DragGroupProps {
    /**
     * called after a tab moved from one layout to another, with where it came from and where it
     * went (what an app's undo needs)
     */
    onTransfer?: TransferListener | undefined;
}

export interface DragGroupSlots {
    /** the layouts (`Dockable.Root`s) that exchange tabs, anywhere below */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * Layouts of different models that exchange tabs by drag and drop. Wrap the `Dockable.Root`s in
 * it: a tab dragged from one drops into another (a `tab.add` in the target model and a `tab.close`
 * in the source, each through its model's middleware, which can veto), and its content keeps its
 * state. Renders no element of its own.
 */
export const DragGroup: DockableComponent<DragGroupProps, DragGroupSlots> =
    defineComponent({
        name: "DockableDragGroup",
        props: ["onTransfer"],
        setup(props, { slots }) {
            const value: DragGroupContextValue = {
                group: new CoreDragGroup(),
                registry: new ContentRegistry(),
            };
            onUnmounted(
                value.group.onTransfer((transfer) =>
                    (props.onTransfer as TransferListener | undefined)?.(
                        transfer,
                    ),
                ),
            );
            provide(DragGroupKey, value);
            // the host is a component of its own: a change of the content re-renders it alone, not
            // the layouts (whose panels register their content again on every update)
            return () =>
                h(Fragment, [
                    slots.default?.(),
                    h(ContentHost, { registry: value.registry }),
                ]);
        },
    }) as unknown as DockableComponent<DragGroupProps, DragGroupSlots>;

/**
 * The drag group of the enclosing `Dockable.DragGroup`, for code that moves tabs between its
 * layouts (`group.transfer(…)`, an undo) or listens to transfers.
 */
export function useDragGroup(): CoreDragGroup {
    const context = inject(DragGroupKey, null);
    if (!context) {
        throw new Error("useDragGroup must be used inside Dockable.DragGroup");
    }
    return context.group;
}
