import { createModel, type TabsetNode } from "@fragiola/dockable";
import {
    Dockable,
    useDockable,
    useTabOverflow,
} from "@fragiola/dockable-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { FixtureLayout, Types } from "../../src/fixture/layouts";
import { renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";
import "./overflow.css";

/**
 * Tab overflow (Epic #32): a tabset with six tabs next to a small one. The page's width drives the
 * strip's (the specs resize the viewport). The trigger toggles an unstyled list of the hidden tabs;
 * picking one selects it, which brings it into the strip.
 */
const json: FixtureLayout = {
    version: 1,
    root: {
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
                ].map((name) => ({ component: "testing", label: name })),
            },
            {
                type: "tabset",
                weight: 25,
                children: [{ component: "testing", label: "Other" }],
            },
        ],
    },
};

function OverflowMenu({ tabset }: { tabset: TabsetNode<Types> }) {
    const { hiddenTabs } = useTabOverflow(tabset);
    const { model } = useDockable<Types>();
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
            {open && hiddenTabs.length > 0 ? (
                <div
                    role="menu"
                    aria-label="Hidden tabs"
                    data-testid={`menu-${tabset.id}`}
                >
                    {hiddenTabs.map((tab) => (
                        <div key={tab.id} role="none">
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    model.run("tab.select", { tabId: tab.id });
                                    setOpen(false);
                                }}
                            >
                                {tab.label}
                            </button>
                        </div>
                    ))}
                </div>
            ) : null}
        </>
    );
}

function App() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <Dockable.Root model={model}>
            <Dockable.Row<Types>>
                {(child) =>
                    child.type === "tabset" ? (
                        <Dockable.TabSet node={child}>
                            <div className="header">
                                <Dockable.TabList<Types>
                                    aria-label={child.data?.name ?? "Tabs"}
                                >
                                    {(tab) => (
                                        <Dockable.Tab node={tab}>
                                            {tab.label}
                                        </Dockable.Tab>
                                    )}
                                </Dockable.TabList>
                                <OverflowMenu tabset={child} />
                            </div>
                            <Dockable.TabSetContent />
                        </Dockable.TabSet>
                    ) : null
                }
            </Dockable.Row>
            <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
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
