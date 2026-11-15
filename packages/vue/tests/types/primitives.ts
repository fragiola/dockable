// Type fixtures, checked by `tsc` (not run): the registry `T` flows from the model into the parts'
// props and scoped slots (through `typedDockable<T>()`) and into the composables, with no cast.
import {
    createModel,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { h } from "vue";
import {
    typedDockable,
    type Dockable as Untyped,
    type UseDockableResult,
    useDockable,
    useDragGroup,
    useDragNode,
    useDragSource,
    useDropZone,
    useModelState,
    useTabOverflow,
    useTabSet,
} from "../../src";

type Types = {
    tabs: {
        editor: { name: string; path: string; dirty: boolean };
        chart: { name: string; series: string[] };
    };
    tabset: { name?: string };
};

const model = createModel<Types>({
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        component: "editor",
                        label: "a.ts",
                        data: { name: "a.ts", path: "/a.ts", dirty: false },
                    },
                ],
            },
        ],
    },
});

const Dockable = typedDockable<Types>();

/** what a component's scoped slot `K` receives */
type SlotScope<
    C extends abstract new (
        ...args: never
    ) => { $slots: object },
    K extends keyof InstanceType<C>["$slots"],
> = Parameters<NonNullable<InstanceType<C>["$slots"][K]>>[0];

/** `true` when `A` and `B` are the same type. */
type Equal<A, B> =
    (<V>() => V extends A ? 1 : 2) extends <V>() => V extends B ? 1 : 2
        ? true
        : false;

// Panels: `tab.data` narrows on `tab.component` in the default slot's scope
export function panel({ tab }: SlotScope<typeof Dockable.Panels, "default">) {
    switch (tab.component) {
        case "editor": {
            const path: string = tab.data.path;
            const dirty: boolean = tab.data.dirty;
            // @ts-expect-error: an editor has no series
            tab.data.series;
            return h(Dockable.Panel, { node: tab }, () => [
                path,
                String(dirty),
            ]);
        }
        case "chart": {
            const series: string[] = tab.data.series;
            // @ts-expect-error: a chart has no path
            tab.data.path;
            return h(Dockable.Panel, { node: tab }, () => series.join());
        }
    }
}

// TabList, Row, Borders and Popout hand typed plain nodes to their slots
export const tabScope: Equal<
    SlotScope<typeof Dockable.TabList, "default">,
    { tab: TabOf<Types> }
> = true;
export const rowScope: Equal<
    SlotScope<typeof Dockable.Row, "default">,
    { node: TabsetNode<Types> | RowNode<Types> }
> = true;
export const splitterScope: Equal<
    SlotScope<typeof Dockable.Row, "splitter">["props"]["node"],
    RowNode<Types>
> = true;
export const barScope: Equal<
    SlotScope<typeof Dockable.Borders, "bar">["border"]["location"],
    "top" | "bottom" | "start" | "end"
> = true;
export function windowLayout({
    layout,
}: SlotScope<typeof Dockable.Popout, "default">) {
    const first: TabsetNode<Types> | RowNode<Types> | undefined =
        layout.root.children[0];
    return first;
}
export function tabsetName({
    node,
}: SlotScope<typeof Dockable.Row, "default">) {
    if (node.type === "tabset") {
        const name: string | undefined = node.data?.name;
        return name;
    }
    return undefined;
}

// the untyped namespace takes any registry: its slots hand the erased nodes
export const untypedTab: Equal<
    SlotScope<typeof Untyped.TabList, "default">["tab"],
    TabOf<Types>
> = false;

// the render slot: the props to bind, the state, the content
export function renderTab({
    props,
    state,
    children,
}: SlotScope<typeof Dockable.Tab, "render">) {
    const selected: boolean = state.selected;
    return [
        h("button", { ...props, "data-selected": selected }, [h(children)]),
    ];
}

// props are checked: a part takes its node, a DragSource a `tab.add` init of the registry
export const props = [
    h(Dockable.Root, { model }),
    h(Dockable.DragSource, {
        model,
        tab: {
            component: "chart",
            label: "Sales",
            data: { name: "Sales", series: [] },
        },
    }),
    h(Dockable.DragSource, {
        model,
        // @ts-expect-error: `path` is not in the chart's data
        tab: { component: "chart", label: "x", data: { name: "x", path: "x" } },
    }),
    h(Dockable.DropZone, {
        model,
        accepts: (drag) =>
            drag.kind === "tab" && drag.tab.component === "chart",
        onDrop: (drag) => {
            if (drag.kind === "tab" && drag.tab.component === "editor") {
                const path: string = drag.tab.data.path;
                void path;
            }
        },
    }),
];

export function composables(tabset: TabsetNode<Types>) {
    useDragSource({
        model,
        tab: () => ({
            component: "editor",
            label: "b.ts",
            data: { name: "b.ts", path: "/b.ts", dirty: true },
        }),
    });
    useDragSource({
        model,
        // @ts-expect-error: an editor needs a path and a dirty flag
        tab: { component: "editor", label: "c.ts", data: { name: "c.ts" } },
    });
    const { model: typed, engine } = useDockable<Types>();
    typed.run("tab.add", {
        component: "chart",
        label: "Costs",
        data: { name: "Costs", series: ["q1"] },
        to: "main",
    });
    typed.run("tab.add", {
        component: "chart",
        label: "x",
        // @ts-expect-error: a chart's series are strings
        data: { name: "x", series: [1] },
        to: "main",
    });
    const names = useModelState<Types, string[]>((_state, m) =>
        m.get("all-tabs").map((tab) => tab.label),
    );
    const joined: string = names.value.join();
    const panelId: string = engine.get("tab-panel-dom-id-by", {
        tabId: "t0",
    });
    // @ts-expect-error: useDockable has no run; change the layout with model.run
    useDockable<Types>().run;

    // every part composable: `{ state, props }` as computed refs
    const set = useTabSet(tabset);
    const active: boolean = set.state.value.active;
    const drag = useDragNode(() => tabset);
    const draggable: boolean = drag.props.value.draggable;
    const zone = useDropZone({ model, onDrop: () => {} });
    const over: boolean = zone.state.value.over;
    const overflow = useTabOverflow(tabset);
    const hiddenTabs: TabOf<Types>[] = overflow.hiddenTabs.value;
    // @ts-expect-error: the ref goes on the element: it is in props
    void set.ref;
    const group = useDragGroup();
    group.onTransfer((transfer) => {
        const fromThis: boolean = transfer.from.model === model;
        void fromThis;
    });
    return [joined, panelId, active, draggable, over, hiddenTabs];
}

export const dockableResult: Equal<
    keyof UseDockableResult,
    "model" | "engine" | "layoutId"
> = true;
