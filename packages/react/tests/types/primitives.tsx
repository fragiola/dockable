// Type fixtures, checked by `tsc` (not run): the registry `T` flows from the model into the parts'
// children functions and hooks with no cast, and a `render` function's props fit any element.
import { createModel, type RowNode, type TabsetNode } from "@fragiola/dockable";
import type * as React from "react";
import {
    Dockable,
    useDockable,
    useDragGroup,
    useDragSource,
    useModelState,
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
    const { run, model: typed } = useDockable<Types>();
    run("tab.add", {
        component: "chart",
        data: { name: "Costs", series: ["q1"] },
        to: "main",
    });
    run("tab.add", {
        component: "chart",
        // @ts-expect-error: a chart's series are strings
        data: { name: "x", series: [1] },
        to: "main",
    });
    const first = typed.tabs()[0];
    if (first?.component === "editor") {
        const dirty: boolean = first.data.dirty;
        void dirty;
    }
    const names = useModelState<Types, string[]>((_state, m) =>
        m.tabs().map((tab) => tab.data.name),
    );
    return names.join();
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
