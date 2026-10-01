import {
    createModel,
    MAIN_LAYOUT,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    useDockable,
    useDragNode,
    useModelState,
} from "@fragiola/dockable-react";
import { type ReactNode, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery, type Types } from "../../src/fixture/layouts";
import { TabContent } from "../../src/fixture/TabContent";
import "../../src/fixture/fixture.css";

/** drags a whole tabset (the lower-layer hook: tabsets have no built-in drag handle) */
function TabSetHandle({ tabset }: { tabset: TabsetNode<Types> }) {
    const drag = useDragNode(tabset);
    return (
        <button
            type="button"
            aria-label="Move tabset"
            {...drag.props}
            data-testid="tabset-handle"
        >
            ⠿
        </button>
    );
}

/** the fixture's recursion: the shared one, plus popout triggers and a tabset drag handle */
function renderNode(child: TabsetNode<Types> | RowNode<Types>): ReactNode {
    if (child.type === "tabset") {
        return (
            <Dockable.TabSet node={child}>
                <div style={{ display: "flex" }}>
                    <TabSetHandle tabset={child} />
                    <Dockable.TabList<Types>
                        aria-label={child.data?.name ?? "Tabs"}
                    >
                        {(tab) => (
                            <Dockable.Tab node={tab}>
                                {tab.data.name}
                            </Dockable.Tab>
                        )}
                    </Dockable.TabList>
                    <Dockable.PopoutTrigger data-testid="popout-tab">
                        tab
                    </Dockable.PopoutTrigger>
                    <Dockable.PopoutTrigger
                        target="tabset"
                        data-testid="popout-tabset"
                    >
                        tabset
                    </Dockable.PopoutTrigger>
                </div>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    return <Dockable.Row node={child}>{renderNode}</Dockable.Row>;
}

/** moves a popped out tab back into the main layout's first tabset */
function DockBack({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    const inWindow = useModelState<Types, boolean>(
        (_state, m) =>
            m.get("layout-id-by-node-id", { nodeId: tab.id }) !== MAIN_LAYOUT,
    );
    if (!inWindow) {
        return null;
    }
    const onClick = () => {
        const target = model.get("tabsets-by-layout-id", {
            layoutId: MAIN_LAYOUT,
        })[0];
        if (target) {
            model.run("tab.move", {
                tabId: tab.id,
                to: target.id,
                location: "center",
                index: -1,
            });
        }
    };
    return (
        <button type="button" data-testid="dock-back" onClick={onClick}>
            Dock back
        </button>
    );
}

function App() {
    const [model] = useState(() => {
        const created = createModel<Types>(layoutFromQuery());
        // every layout of this fixture can pop out (popout is opt-in per tab)
        created.run("layout.configure", {
            defaults: { tab: { enablePopout: true } },
        });
        return created;
    });

    const popOutSelected = () => {
        const tabset =
            model.get("active-tabset-by-layout-id") ??
            model.get("tabsets-by-layout-id")[0];
        const tab = tabset
            ? model.get("selected-tab-by-tabset-id", { tabsetId: tabset.id })
            : undefined;
        if (tab) {
            model.run("tab.popout", { tabId: tab.id });
        }
    };

    return (
        <>
            <div>
                <button
                    type="button"
                    data-testid="popout"
                    onClick={popOutSelected}
                >
                    Pop out selected tab
                </button>
            </div>
            <Dockable.Root
                model={model}
                popoutURL="/popout.html"
                supportsPopout
                popoutMirrorRoot
            >
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab}>
                            <TabContent tab={tab} />
                            <DockBack tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator />
                <Dockable.Popout<Types>>
                    {() => (
                        <>
                            <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                            <Dockable.DropIndicator />
                        </>
                    )}
                </Dockable.Popout>
            </Dockable.Root>
        </>
    );
}

const container = document.getElementById("app");
if (!container) throw new Error("no #app");
createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
