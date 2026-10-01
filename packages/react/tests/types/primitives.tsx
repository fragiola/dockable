// Type fixtures, checked by `tsc` (not run): the registry `T` flows from the model into the parts'
// children functions and hooks with no cast, and a `render` function's props fit any element.
import {
    createModel,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import type * as React from "react";
import {
    Dockable,
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
                        data: { name: "a.ts", path: "/a.ts", dirty: false },
                    },
                ],
            },
        ],
    },
});

// Panels: `tab.data` narrows on `tab.component` inside each case
export const panels = (
    <Dockable.Panels<Types>>
        {(tab) => {
            switch (tab.component) {
                case "editor": {
                    const path: string = tab.data.path;
                    const dirty: boolean = tab.data.dirty;
                    // @ts-expect-error: an editor has no series
                    tab.data.series;
                    return (
                        <Dockable.Panel node={tab}>
                            {path}
                            {String(dirty)}
                        </Dockable.Panel>
                    );
                }
                case "chart": {
                    const series: string[] = tab.data.series;
                    // @ts-expect-error: a chart has no path
                    tab.data.path;
                    return (
                        <Dockable.Panel node={tab}>
                            {series.join()}
                        </Dockable.Panel>
                    );
                }
            }
        }}
    </Dockable.Panels>
);

// TabList and Row hand typed plain nodes to their children functions
function renderNode(
    child: TabsetNode<Types> | RowNode<Types>,
): React.ReactNode {
    if (child.type === "row") {
        return <Dockable.Row node={child}>{renderNode}</Dockable.Row>;
    }
    const name: string | undefined = child.data?.name;
    return (
        <Dockable.TabSet node={child} aria-label={name}>
            <Dockable.TabList<Types>>
                {(tab) => (
                    <Dockable.Tab node={tab}>{tab.data.name}</Dockable.Tab>
                )}
            </Dockable.TabList>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

export const root = (
    <Dockable.Root model={model}>
        <Dockable.Row<Types>>{renderNode}</Dockable.Row>
        {panels}
    </Dockable.Root>
);

// `render` functions: the props (a callback ref included) spread onto any element, no cast
export const rendered = (
    <Dockable.Root model={model} render={(props) => <section {...props} />}>
        <Dockable.Row<Types>
            render={(props, state) => (
                <div {...props} data-custom={state.orientation} />
            )}
        >
            {renderNode}
        </Dockable.Row>
        <Dockable.DropIndicator render={(props) => <span {...props} />} />
    </Dockable.Root>
);

// DragSource / useDragSource: the new tab is a `tab.add` init checked against the registry
export const source = (
    <Dockable.DragSource
        model={model}
        tab={{ component: "chart", data: { name: "Sales", series: [] } }}
    />
);

export const wrongSource = (
    <Dockable.DragSource
        model={model}
        // @ts-expect-error: `path` is not in the chart's data
        tab={{ component: "chart", data: { name: "x", path: "x" } }}
    />
);

export function Hooks() {
    useDragSource({
        model,
        tab: () => ({
            component: "editor",
            data: { name: "b.ts", path: "/b.ts", dirty: true },
        }),
    });
    useDragSource({
        model,
        // @ts-expect-error: an editor needs a path and a dirty flag
        tab: { component: "editor", data: { name: "c.ts" } },
    });
    const { model: typed, engine } = useDockable<Types>();
    typed.run("tab.add", {
        component: "chart",
        data: { name: "Costs", series: ["q1"] },
        to: "main",
    });
    typed.run("tab.add", {
        component: "chart",
        // @ts-expect-error: a chart's series are strings
        data: { name: "x", series: [1] },
        to: "main",
    });
    const first = typed.get("all-tabs")[0];
    if (first?.component === "editor") {
        const dirty: boolean = first.data.dirty;
        void dirty;
    }
    const names = useModelState<Types, string[]>((_state, m) =>
        m.get("all-tabs").map((tab) => tab.data.name),
    );
    // the engine of the layout this renders in: screen actions and view facts
    const panelId: string = engine.get("tab-panel-dom-id-by-tab-id", {
        tabId: "t0",
    });
    void panelId;
    // @ts-expect-error: useDockable has no run; change the layout with model.run
    useDockable<Types>().run;
    // @ts-expect-error: no main engine: every engine does page-wide work
    useDockable<Types>().mainEngine;
    return names.join();
}

/** `true` when `A` and `B` are the same union. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const dockableResult: Same<
    keyof UseDockableResult,
    "model" | "engine" | "layoutId"
> = true;

// every part hook: what it shows, and what goes on its element
export function PartHooks({ tabset }: { tabset: TabsetNode<Types> }) {
    const set = useTabSet(tabset);
    const active: boolean = set.state.active;
    const drag = useDragNode(tabset);
    const draggable: boolean = drag.props.draggable;
    const dragging: boolean = drag.state.dragging;
    const zone = useDropZone({ model, onDrop: () => {} });
    const over: boolean = zone.state.over;
    const overflow = useTabOverflow(tabset);
    const hiddenTabs: TabOf<Types>[] = overflow.hiddenTabs;
    void [active, draggable, dragging, over, hiddenTabs];
    // @ts-expect-error: the ref goes on the element: it is in props
    void set.ref;
    return <div {...set.props} {...drag.props} />;
}

// DropZone: callbacks get a typed drag subject
export const zone = (
    <Dockable.DropZone
        model={model}
        accepts={(drag) =>
            drag.kind === "tab" && drag.tab.component === "chart"
        }
        onDrop={(drag) => {
            if (drag.kind === "tab" && drag.tab.component === "editor") {
                const path: string = drag.tab.data.path;
                void path;
            }
        }}
    />
);

// DragGroup: models of different registries meet in one group; transfers compare with yours
type Other = { tabs: { note: { name: string; text: string } } };
const other = createModel<Other>();

export function Group() {
    const group = useDragGroup();
    group.transfer({ tab: "a", from: model, to: other, target: "main" });
    group.onTransfer((transfer) => {
        const intoOther: boolean = transfer.to.model === other;
        const fromMain: boolean = transfer.from.model === model;
        void intoOther;
        void fromMain;
    });
    return null;
}

// Names: a part is named by its own props (`aria-label`, `render`); there is no label resolver
export const named = (
    <Dockable.Root
        model={model}
        // @ts-expect-error: the root takes no label resolver
        getLabel={() => "Resize"}
    >
        <Dockable.Row<Types>
            renderSplitter={(props) => (
                <Dockable.Splitter {...props} aria-label="Resize" />
            )}
        >
            {() => null}
        </Dockable.Row>
    </Dockable.Root>
);

export function NoLabelResolver() {
    const dockable = useDockable<Types>();
    // @ts-expect-error: useDockable returns no label resolver
    void dockable.getLabel;
    return null;
}
