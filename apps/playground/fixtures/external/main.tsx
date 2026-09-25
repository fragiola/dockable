import {
    Actions,
    type IExternalDrag,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery } from "../../src/fixture/layouts";
import { renderNode } from "../../src/fixture/renderNode";
import { TabContent } from "../../src/fixture/TabContent";
import "../../src/fixture/fixture.css";

/**
 * External drag fixture: a sidebar of drag sources outside the layout (each creates a tab), and an
 * `onExternalDrag` that accepts files dragged in from the OS (the tab is renamed after the file on
 * drop, when the data is readable). `data-testid="last-drop"` reports what the last drop did.
 */
function App() {
    const [model] = useState(() => Model.fromJson(layoutFromQuery()));
    const [lastDrop, setLastDrop] = useState("none");
    const count = useRef(0);

    const onExternalDrag = (event: {
        dataTransfer: DataTransfer | null;
    }): IExternalDrag | undefined => {
        if (!event.dataTransfer?.types.includes("Files")) {
            return undefined;
        }
        return {
            json: { type: "tab", name: "File", component: "testing" },
            onDrop: (tab, dropEvent) => {
                const file = dropEvent.dataTransfer?.files[0];
                if (tab && file) {
                    LayoutEngine.of(model)?.doAction(
                        Actions.renameTab(tab.getId(), file.name),
                    );
                }
                setLastDrop(tab ? `file:${file?.name ?? "?"}` : "vetoed");
            },
        };
    };

    return (
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            <ul data-testid="sidebar" style={{ width: 160, margin: 0 }}>
                <Dockable.DragSource
                    model={model}
                    render={<li />}
                    data-testid="source-chart"
                    json={() => ({
                        type: "tab",
                        name: `Chart ${++count.current}`,
                        component: "testing",
                    })}
                    onDrop={(tab) =>
                        setLastDrop(tab ? `added:${tab.getName()}` : "vetoed")
                    }
                >
                    Chart
                </Dockable.DragSource>
                <Dockable.DragSource
                    model={model}
                    render={<li />}
                    data-testid="source-table"
                    json={{ type: "tab", name: "Table", component: "testing" }}
                    onDrop={(tab) =>
                        setLastDrop(tab ? `added:${tab.getName()}` : "vetoed")
                    }
                >
                    Table
                </Dockable.DragSource>
            </ul>
            <output data-testid="last-drop">{lastDrop}</output>
            <Dockable.Root model={model} onExternalDrag={onExternalDrag}>
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
