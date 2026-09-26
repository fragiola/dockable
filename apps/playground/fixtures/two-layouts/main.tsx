import { type ITransfer, Model } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery } from "../../src/fixture/layouts";
import { renderNode } from "../../src/fixture/renderNode";
import { TabContent } from "../../src/fixture/TabContent";
import "../../src/fixture/fixture.css";

/**
 * Two independent layouts (two models) side by side. With a `Dockable.DragGroup` (the default)
 * they exchange tabs by drag and drop; `?group=0` leaves them ungrouped. `last-transfer` reports
 * the last transfer event.
 */
const grouped =
    new URLSearchParams(window.location.search).get("group") !== "0";

function Layout({ model, testId }: { model: Model; testId: string }) {
    return (
        <div
            data-testid={testId}
            style={{ display: "flex", flex: 1, minWidth: 0 }}
        >
            <Dockable.Root model={model}>
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

function App() {
    const [a] = useState(() => Model.fromJson(layoutFromQuery()));
    const [b] = useState(() => Model.fromJson(layoutFromQuery()));
    const [last, setLast] = useState("none");
    const onTransfer = (transfer: ITransfer) =>
        setLast(
            `${transfer.tab.getName()}:${transfer.from.model === a ? "a" : "b"}->${transfer.to.model === a ? "a" : "b"}`,
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
