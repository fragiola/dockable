import { Actions, type BorderNode, Model } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery } from "../../src/fixture/layouts";
import { renderNode, renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";
import "./borders.css";

/**
 * Borders around the layout (Epic #21). `?layout=` picks the layout (test_overlay by default),
 * `?edgeDockMargin=` sets the global of that name, `?thin` makes the tab strips 12px tall (gap 11).
 * Like FlexLayout's demo, the page exposes the model and the actions on `window.__dockable`, so
 * the specs can dispatch actions (`setBorderType`, `updateModelAttributes`) directly.
 */
const params = new URLSearchParams(window.location.search);
if (params.has("thin")) {
    document.documentElement.dataset.thin = "";
}

declare global {
    interface Window {
        __dockable?: { model: Model; Actions: typeof Actions };
    }
}

function renderBar(border: BorderNode) {
    return (
        <Dockable.Border node={border}>
            <Dockable.TabList
                aria-label={`${border.getLocation().getName()} border`}
            >
                {(tab) => (
                    <Dockable.Tab node={tab}>{tab.getName()}</Dockable.Tab>
                )}
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
            json.global = { ...json.global, edgeDockMargin: Number(margin) };
        }
        return Model.fromJson(json);
    });
    // an effect, not the state initializer: StrictMode calls the initializer twice
    useEffect(() => {
        window.__dockable = { model, Actions };
    }, [model]);
    return (
        <Dockable.Root model={model}>
            <Dockable.Borders renderBar={renderBar}>
                <Dockable.Row>{renderNode}</Dockable.Row>
            </Dockable.Borders>
            <Dockable.Panels>{renderPanel}</Dockable.Panels>
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
