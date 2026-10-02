import { type BorderNode, createModel, type Model } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery, type Types } from "../../src/fixture/layouts";
import { renderNode, renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";
import "./borders.css";

/**
 * Borders around the layout (Epic #21). `?layout=` picks the layout (test_overlay by default),
 * `?edgeDockMargin=` sets the layout default of that name, `?thin` makes the tab strips 12px tall
 * (gap 11). Like FlexLayout's demo, the page exposes the model on `window.__dockable`, so the specs
 * can run commands directly (`border.configure`). A left border's tab direction is the
 * `Dockable.Border` prop, read from the border's data: `border.configure` with
 * `data: { tabDirection }` switches it.
 */
const params = new URLSearchParams(window.location.search);
if (params.has("thin")) {
    document.documentElement.dataset.thin = "";
}

declare global {
    interface Window {
        __dockable?: { model: Model<Types> };
    }
}

function renderBar(border: BorderNode<Types>) {
    return (
        <Dockable.Border node={border} tabDirection={border.data?.tabDirection}>
            <Dockable.TabList<Types> aria-label={`${border.location} border`}>
                {(tab) => <Dockable.Tab node={tab}>{tab.label}</Dockable.Tab>}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

const EDGES = ["top", "bottom", "left", "right"] as const;

function App() {
    const [model] = useState(() => {
        const json = layoutFromQuery("test_overlay");
        const margin = params.get("edgeDockMargin");
        if (margin !== null) {
            json.defaults = {
                ...json.defaults,
                layout: {
                    ...json.defaults?.layout,
                    edgeDockMargin: Number(margin),
                },
            };
        }
        return createModel<Types>(json);
    });
    // an effect, not the state initializer: StrictMode calls the initializer twice
    useEffect(() => {
        window.__dockable = { model };
    }, [model]);
    return (
        <Dockable.Root model={model}>
            <Dockable.Borders<Types> renderBar={renderBar}>
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
            </Dockable.Borders>
            <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
            <Dockable.DropIndicator />
            {EDGES.map((edge) => (
                <Dockable.EdgeIndicator key={edge} edge={edge} />
            ))}
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
