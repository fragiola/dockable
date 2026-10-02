import {
    createModel,
    Dockable,
    type Model,
    type Transfer,
} from "@fragiola/dockable-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery, type Types } from "../../src/fixture/layouts";
import { renderNode, renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";

/**
 * Two independent layouts (two models) side by side. With a `Dockable.DragGroup` (the default)
 * they exchange tabs by drag and drop; `?group=0` leaves them ungrouped. `last-transfer` reports
 * the last transfer event.
 */
const grouped =
    new URLSearchParams(window.location.search).get("group") !== "0";

function Layout({ model, testId }: { model: Model<Types>; testId: string }) {
    return (
        <div
            data-testid={testId}
            style={{ display: "flex", flex: 1, minWidth: 0 }}
        >
            <Dockable.Root model={model}>
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
                <Dockable.DropIndicator />
            </Dockable.Root>
        </div>
    );
}

/** the name a transferred tab left with (its label, as the source model held it) */
function nameOf(transfer: Transfer): string {
    return transfer.init.label;
}

function App() {
    const [a] = useState(() => createModel<Types>(layoutFromQuery()));
    const [b] = useState(() => createModel<Types>(layoutFromQuery()));
    const [last, setLast] = useState("none");
    const onTransfer = (transfer: Transfer) =>
        setLast(
            `${nameOf(transfer)}:${transfer.from.model === a ? "a" : "b"}->${transfer.to.model === a ? "a" : "b"}`,
        );
    const layouts = (
        <div style={{ display: "flex", flex: 1, gap: 16, minHeight: 0 }}>
            <Layout model={a} testId="layout-a" />
            <Layout model={b} testId="layout-b" />
        </div>
    );
    return (
        <>
            <output data-testid="last-transfer">{last}</output>
            {grouped ? (
                <Dockable.DragGroup onTransfer={onTransfer}>
                    {layouts}
                </Dockable.DragGroup>
            ) : (
                layouts
            )}
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
