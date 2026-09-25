import type {
    IJsonModel,
    Model,
    RowNode,
    TabNode,
    TabSetNode,
} from "@fragiola/dockable";
import * as React from "react";
import { Dockable, type RootProps } from "../src";

export const twoTabsets: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    { type: "tab", id: "t0", name: "One" },
                    { type: "tab", id: "t1", name: "Two" },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                children: [{ type: "tab", id: "t2", name: "Three" }],
            },
        ],
    },
};

/** Tab content with observable state: a counter, an input, and a mount counter. */
export const mounts = new Map<string, number>();

export function Counter({ id }: { id: string }) {
    const [count, setCount] = React.useState(0);
    React.useEffect(() => {
        mounts.set(id, (mounts.get(id) ?? 0) + 1);
    }, [id]);
    return (
        <div data-testid={`content-${id}`}>
            <button
                type="button"
                data-testid={`inc-${id}`}
                onClick={() => setCount((c) => c + 1)}
            >
                {`count ${count}`}
            </button>
            <input data-testid={`input-${id}`} aria-label={`input ${id}`} />
        </div>
    );
}

export function renderNode(child: TabSetNode | RowNode): React.ReactNode {
    if (child.getType() === "tabset") {
        const tabset = child as TabSetNode;
        return (
            <Dockable.TabSet node={tabset}>
                <Dockable.TabList>
                    {(tab) => (
                        <Dockable.Tab node={tab}>{tab.getName()}</Dockable.Tab>
                    )}
                </Dockable.TabList>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    return <Dockable.Row node={child as RowNode}>{renderNode}</Dockable.Row>;
}

export function renderPanel(tab: TabNode) {
    return (
        <Dockable.Panel node={tab}>
            <Counter id={tab.getId()} />
        </Dockable.Panel>
    );
}

export interface LayoutProps extends Omit<RootProps, "model" | "children"> {
    model: Model;
    children?: React.ReactNode;
}

/** The fixture layout: every primitive, composed with child functions. */
export function Layout({ model, children, ...rest }: LayoutProps) {
    return (
        <Dockable.Root model={model} data-testid="root" {...rest}>
            <Dockable.Row>{renderNode}</Dockable.Row>
            <Dockable.Panels>{renderPanel}</Dockable.Panels>
            {children}
        </Dockable.Root>
    );
}
