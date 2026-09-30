import type {
    LayoutJson,
    Model,
    RowNode,
    TabOf,
    TabsetNode,
} from "@fragiola/dockable";
import * as React from "react";
import { Dockable, type RootProps } from "../src";

/** The registry of the fixture layouts: every tab has a name. */
export type Types = { tabs: { test: { name: string } } };

export const twoTabsets: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    { id: "t0", component: "test", data: { name: "One" } },
                    { id: "t1", component: "test", data: { name: "Two" } },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                children: [
                    { id: "t2", component: "test", data: { name: "Three" } },
                ],
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

export function renderNode(
    child: TabsetNode<Types> | RowNode<Types>,
): React.ReactNode {
    if (child.type === "tabset") {
        return (
            <Dockable.TabSet node={child}>
                <Dockable.TabList<Types>>
                    {(tab) => (
                        <Dockable.Tab node={tab}>{tab.data.name}</Dockable.Tab>
                    )}
                </Dockable.TabList>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    return <Dockable.Row node={child}>{renderNode}</Dockable.Row>;
}

export function renderPanel(tab: TabOf<Types>) {
    return (
        <Dockable.Panel node={tab}>
            <Counter id={tab.id} />
        </Dockable.Panel>
    );
}

export interface LayoutProps
    extends Omit<RootProps<Types>, "model" | "children"> {
    model: Model<Types>;
    children?: React.ReactNode;
}

/** The fixture layout: every primitive, composed with child functions. */
export function Layout({ model, children, ...rest }: LayoutProps) {
    return (
        <Dockable.Root model={model} data-testid="root" {...rest}>
            <Dockable.Row<Types>>{renderNode}</Dockable.Row>
            <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
            {children}
        </Dockable.Root>
    );
}

/** The commands a model ran, recorded by a middleware (engine-issued and direct alike). */
export function recordCommands(
    model: Model<Types>,
): { command: string; payload: unknown; transient: boolean }[] {
    const commands: {
        command: string;
        payload: unknown;
        transient: boolean;
    }[] = [];
    model.use((ctx, next) => {
        if (!ctx.dryRun && !ctx.inBatch) {
            commands.push({
                command: ctx.command,
                payload: ctx.payload,
                transient: ctx.transient,
            });
        }
        return next();
    });
    return commands;
}
