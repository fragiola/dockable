import {
    Actions,
    DockLocation,
    type LayoutEngine,
    Model,
    type RowNode,
    type TabNode,
    TabSetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable, useDragNode } from "@fragiola/dockable-react";
import { type ReactNode, StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery } from "../../src/fixture/layouts";
import { TabContent } from "../../src/fixture/TabContent";
import "../../src/fixture/fixture.css";

/** drags a whole tabset (the lower-layer hook: tabsets have no built-in drag handle) */
function TabSetHandle({ tabset }: { tabset: TabSetNode }) {
    const drag = useDragNode(tabset);
    return (
        <button
            type="button"
            aria-label="Move tabset"
            ref={drag.ref}
            draggable={drag.draggable}
            onDragStart={drag.onDragStart}
            onDragEnd={drag.onDragEnd}
            data-testid="tabset-handle"
        >
            ⠿
        </button>
    );
}

/** the fixture's recursion: the shared one, plus popout triggers and a tabset drag handle */
function renderNode(child: TabSetNode | RowNode): ReactNode {
    if (child instanceof TabSetNode) {
        return (
            <Dockable.TabSet node={child}>
                <div style={{ display: "flex" }}>
                    <TabSetHandle tabset={child} />
                    <Dockable.TabList aria-label={child.getName() ?? "Tabs"}>
                        {(tab) => (
                            <Dockable.Tab node={tab}>
                                {tab.getName()}
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
    return <Dockable.Row node={child as RowNode}>{renderNode}</Dockable.Row>;
}

/** hands the main engine to the page's own controls, outside the layout */
function EngineRef({
    engineRef,
}: {
    engineRef: { current: LayoutEngine | null };
}) {
    engineRef.current = useDockable().engine;
    return null;
}

/** moves a popped out tab back into the main layout's first tabset */
function DockBack({ tab }: { tab: TabNode }) {
    const { mainEngine, model } = useDockable();
    if (tab.getLayoutId() === Model.MAIN_LAYOUT_ID) {
        return null;
    }
    const onClick = () => {
        let target: TabSetNode | undefined;
        model.visitLayoutNodes(Model.MAIN_LAYOUT_ID, (node) => {
            if (!target && node instanceof TabSetNode) {
                target = node;
            }
        });
        if (target) {
            mainEngine.doAction(
                Actions.moveNode(
                    tab.getId(),
                    target.getId(),
                    DockLocation.CENTER,
                    -1,
                ),
            );
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
        const created = Model.fromJson(layoutFromQuery());
        // every layout of this fixture can pop out (popout is opt-in per tab)
        created.doAction(
            Actions.updateModelAttributes({ tabEnablePopout: true }),
        );
        return created;
    });
    const engineRef = useRef<LayoutEngine | null>(null);

    const popOutSelected = () => {
        const engine = engineRef.current;
        const tabset = model.getActiveTabset() ?? model.getFirstTabSet();
        const tab = tabset?.getSelectedNode();
        if (engine && tab) {
            engine.doAction(Actions.popoutTab(tab.getId(), "window"));
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
                <EngineRef engineRef={engineRef} />
                <Dockable.Row>{renderNode}</Dockable.Row>
                <Dockable.Panels>
                    {(tab) => (
                        <Dockable.Panel node={tab}>
                            <TabContent tab={tab} />
                            <DockBack tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator />
                <Dockable.Popout>
                    {() => (
                        <>
                            <Dockable.Row>{renderNode}</Dockable.Row>
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
