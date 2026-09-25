import {
    Actions,
    DockLocation,
    type LayoutEngine,
    Model,
    type TabNode,
    TabSetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery } from "../../src/fixture/layouts";
import { renderNode } from "../../src/fixture/renderNode";
import { TabContent } from "../../src/fixture/TabContent";
import "../../src/fixture/fixture.css";

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
    const [model] = useState(() => Model.fromJson(layoutFromQuery()));
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
                    {() => <Dockable.Row>{renderNode}</Dockable.Row>}
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
