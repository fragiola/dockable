import {
    Actions,
    type IJsonModel,
    Model,
    type TabSetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    useDockable,
    useTabOverflow,
} from "@fragiola/dockable-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";
import "./overflow.css";

/**
 * Tab overflow (Epic #32): a tabset with six tabs next to a small one. The page's width drives the
 * strip's (the specs resize the viewport). The trigger toggles an unstyled list of the hidden tabs;
 * picking one selects it, which brings it into the strip.
 */
const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 75,
                children: [
                    "Alpha",
                    "Bravo",
                    "Charlie",
                    "Delta",
                    "Echo",
                    "Foxtrot",
                ].map((name) => ({
                    type: "tab" as const,
                    name,
                    component: "testing",
                })),
            },
            {
                type: "tabset",
                weight: 25,
                children: [
                    { type: "tab", name: "Other", component: "testing" },
                ],
            },
        ],
    },
};

function OverflowMenu({ tabset }: { tabset: TabSetNode }) {
    const { hidden } = useTabOverflow(tabset);
    const { engine } = useDockable();
    const [open, setOpen] = useState(false);
    return (
        <>
            <Dockable.TabOverflowTrigger
                aria-label="Hidden tabs"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                <span aria-hidden="true">»</span>
            </Dockable.TabOverflowTrigger>
            {open && hidden.length > 0 ? (
                <div
                    role="menu"
                    aria-label="Hidden tabs"
                    data-testid={`menu-${tabset.getId()}`}
                >
                    {hidden.map((tab) => (
                        <div key={tab.getId()} role="none">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    engine.doAction(
                                        Actions.selectTab(tab.getId()),
                                    );
                                    setOpen(false);
                                }}
                            >
                                {tab.getName()}
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
        </>
    );
}

function App() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <Dockable.Root model={model}>
            <Dockable.Row>
                {(child) => {
                    const tabset = child as TabSetNode;
                    return (
                        <Dockable.TabSet node={tabset}>
                            <div className="header">
                                <Dockable.TabList
                                    aria-label={tabset.getName() ?? "Tabs"}
                                >
                                    {(tab) => (
                                        <Dockable.Tab node={tab}>
                                            {tab.getName()}
                                        </Dockable.Tab>
                                    )}
                                </Dockable.TabList>
                                <OverflowMenu tabset={tabset} />
                            </div>
                            <Dockable.TabSetContent />
                        </Dockable.TabSet>
                    );
                }}
            </Dockable.Row>
            <Dockable.Panels>{renderPanel}</Dockable.Panels>
            <Dockable.DropIndicator />
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
