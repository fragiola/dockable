import { createModel, type RowNode, veto } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery, type Types } from "../../src/fixture/layouts";
import { renderNode, renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";

/**
 * Drop control fixture: a trash `Dockable.DropZone` outside the layout (a tab dropped on it is
 * closed), and `?refuse=<layout path>` refuses every drop into or beside that tabset through a
 * middleware that vetoes the commands a drop runs (`tab.move`, `tab.add`, `tabset.move`) when
 * their target is that tabset. The drop indicator asks the same chain (`model.can`), so the
 * refused target shows while dragging.
 */
const refused = new URLSearchParams(window.location.search).get("refuse");

/** the `data-layout-path` of a row or tabset of the main layout (`/r1/ts0`), by id */
function pathOf(
    row: RowNode<Types>,
    id: string,
    prefix = "",
): string | undefined {
    for (const [i, child] of row.children.entries()) {
        const path = `${prefix}/${child.type === "row" ? "r" : "ts"}${i}`;
        if (child.id === id) return path;
        if (child.type === "row") {
            const found = pathOf(child, id, path);
            if (found) return found;
        }
    }
    return undefined;
}

function createFixtureModel() {
    const model = createModel<Types>(layoutFromQuery());
    if (refused) {
        model.use((ctx, next) => {
            if (
                "to" in ctx.payload &&
                pathOf(ctx.state.root, ctx.payload.to) === refused
            ) {
                return veto(`drops on ${refused} are refused`);
            }
            return next();
        });
    }
    return model;
}

function App() {
    const [model] = useState(createFixtureModel);
    const [lastDrop, setLastDrop] = useState("none");

    return (
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            <Dockable.DropZone
                model={model}
                accepts={(drag) => drag.kind === "tab"}
                onDrop={(drag) => {
                    if (drag.kind !== "tab") return;
                    model.run("tab.close", { tab: drag.tab.id });
                    setLastDrop(`trash:${drag.tab.data.name}`);
                }}
                data-testid="trash"
                style={{ width: 120, border: "1px dashed #999" }}
            >
                Trash
            </Dockable.DropZone>
            <output data-testid="last-drop">{lastDrop}</output>
            <Dockable.Root model={model}>
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
