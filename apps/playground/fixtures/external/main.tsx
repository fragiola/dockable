import {
    createModel,
    type DragEventLike,
    type ExternalDrag,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery, type Types } from "../../src/fixture/layouts";
import { renderNode, renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";

/**
 * External drag fixture: a sidebar of drag sources outside the layout (each creates a tab), and an
 * `onExternalDrag` that accepts files dragged in from the OS (the tab is renamed after the file on
 * drop, when the data is readable). `data-testid="last-drop"` reports what the last drop did.
 */
function App() {
    const [model] = useState(() => createModel<Types>(layoutFromQuery()));
    const [lastDrop, setLastDrop] = useState("none");
    const count = useRef(0);

    /** the name of a tab the model holds, for the report */
    const nameOf = (id: string | undefined) => {
        const tab = id === undefined ? undefined : model.get("node-by", { id });
        return tab?.type === "tab" ? tab.label : "?";
    };

    const onExternalDrag = (
        event: DragEventLike,
    ): ExternalDrag<Types> | undefined => {
        if (!event.dataTransfer?.types.includes("Files")) {
            return undefined;
        }
        return {
            tab: { component: "testing", label: "File" },
            onDrop: (tab, dropEvent) => {
                const file = dropEvent.dataTransfer?.files[0];
                if (tab && file) {
                    model.run("tab.configure", {
                        tabId: tab,
                        label: file.name,
                    });
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
                    tab={() => ({
                        component: "testing",
                        label: `Chart ${++count.current}`,
                    })}
                    onDrop={(tab) =>
                        setLastDrop(tab ? `added:${nameOf(tab)}` : "vetoed")
                    }
                >
                    Chart
                </Dockable.DragSource>
                <Dockable.DragSource
                    model={model}
                    render={<li />}
                    data-testid="source-table"
                    tab={{ component: "testing", label: "Table" }}
                    onDrop={(tab) =>
                        setLastDrop(tab ? `added:${nameOf(tab)}` : "vetoed")
                    }
                >
                    Table
                </Dockable.DragSource>
            </ul>
            <output data-testid="last-drop">{lastDrop}</output>
            <Dockable.Root model={model} onExternalDrag={onExternalDrag}>
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
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
