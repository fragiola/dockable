import {
    Actions,
    LayoutEngine,
    Model,
    type Node,
    TabNode,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery } from "../../src/fixture/layouts";
import { renderNode } from "../../src/fixture/renderNode";
import { TabContent } from "../../src/fixture/TabContent";
import "../../src/fixture/fixture.css";

/**
 * Drop control fixture: a trash `Dockable.DropZone` outside the layout (a tab dropped on it is
 * deleted), and `?refuse=<layout path>` refuses every drop into or beside that tabset through
 * `Dockable.Root`'s `onAllowDrop`.
 */
const refused = new URLSearchParams(window.location.search).get("refuse");

function App() {
    const [model] = useState(() => Model.fromJson(layoutFromQuery()));
    const [lastDrop, setLastDrop] = useState("none");

    const onAllowDrop = refused
        ? (_dragNode: Node, dropInfo: { node: Node }) =>
              dropInfo.node.getPath() !== refused
        : undefined;

    return (
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            <Dockable.DropZone
                model={model}
                accepts={(node) => node instanceof TabNode}
                onDrop={(node) => {
                    LayoutEngine.of(model)?.doAction(
                        Actions.deleteTab(node.getId()),
                    );
                    setLastDrop(`trash:${(node as TabNode).getName()}`);
                }}
                data-testid="trash"
                style={{ width: 120, border: "1px dashed #999" }}
            >
                Trash
            </Dockable.DropZone>
            <output data-testid="last-drop">{lastDrop}</output>
            <Dockable.Root model={model} onAllowDrop={onAllowDrop}>
                <Dockable.Row>{renderNode}</Dockable.Row>
                <Dockable.Panels>
                    {(tab) => (
                        <Dockable.Panel node={tab}>
                            <TabContent tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator />
            </Dockable.Root>
        </div>
    );
}

const container = document.getElementById("app");
if (!container) throw new Error("no #app");
createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
