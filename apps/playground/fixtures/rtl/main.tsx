import {
    type BorderNode,
    createModel,
    Dockable,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable-react";
import { type ReactNode, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Types } from "../../src/fixture/layouts";
import { renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";
import "./rtl.css";

/**
 * A right-to-left page (`dir="rtl"` on `<html>`): borders on every side, a nested row, and
 * popouts, which take the layout's direction without `popoutMirrorRoot`. `start` is on the right. The page exposes the model on `window.__dockable`, so the
 * specs can run commands directly.
 */
declare global {
    interface Window {
        __dockable?: { model: Model<Types> };
    }
}

const tab = (label: string) => ({ component: "testing" as const, label });

const layout: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "a",
                weight: 50,
                data: { name: "A" },
                children: [tab("One"), tab("Two"), tab("Three")],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        id: "b",
                        data: { name: "B" },
                        children: [tab("Four")],
                    },
                    {
                        type: "tabset",
                        id: "c",
                        data: { name: "C" },
                        children: [tab("Five")],
                    },
                ],
            },
        ],
    },
    borders: [
        { location: "top", children: [tab("top1")] },
        { location: "bottom", children: [tab("bottom1")] },
        { location: "start", children: [tab("start1"), tab("start2")] },
        { location: "end", children: [tab("end1")] },
    ],
};

function renderNode(child: TabsetNode<Types> | RowNode<Types>): ReactNode {
    if (child.type === "tabset") {
        return (
            <Dockable.TabSet node={child}>
                <div style={{ display: "flex" }}>
                    <Dockable.TabList<Types>
                        aria-label={child.data?.name ?? "Tabs"}
                    >
                        {(tab) => (
                            <Dockable.Tab node={tab}>{tab.label}</Dockable.Tab>
                        )}
                    </Dockable.TabList>
                    <Dockable.PopoutTrigger
                        target="tabset"
                        data-testid="popout-tabset"
                    >
                        pop out
                    </Dockable.PopoutTrigger>
                </div>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    return <Dockable.Row node={child}>{renderNode}</Dockable.Row>;
}

function renderBar(border: BorderNode<Types>) {
    // the start border is on the right here, where side labels read down
    return (
        <Dockable.Border node={border} tabDirection="down">
            <Dockable.TabList<Types> aria-label={`${border.location} border`}>
                {(tab) => <Dockable.Tab node={tab}>{tab.label}</Dockable.Tab>}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

const EDGES = ["top", "bottom", "start", "end"] as const;

function App() {
    const [model] = useState(() => createModel<Types>(layout));
    // an effect, not the state initializer: StrictMode calls the initializer twice
    useEffect(() => {
        window.__dockable = { model };
    }, [model]);
    return (
        <Dockable.Root model={model} popoutURL="/popout.html" supportsPopout>
            <Dockable.Borders<Types> renderBar={renderBar}>
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
            </Dockable.Borders>
            <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
            <Dockable.DropIndicator />
            {EDGES.map((edge) => (
                <Dockable.EdgeIndicator key={edge} edge={edge} />
            ))}
            <Dockable.Popout<Types>>
                {() => (
                    <>
                        <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                        <Dockable.DropIndicator />
                    </>
                )}
            </Dockable.Popout>
        </Dockable.Root>
    );
}

const container = document.getElementById("app");
if (!container) throw new Error("no #app");
createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
