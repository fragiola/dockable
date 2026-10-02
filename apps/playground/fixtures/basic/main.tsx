import { createModel, Dockable } from "@fragiola/dockable-react";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { layoutFromQuery, type Types } from "../../src/fixture/layouts";
import { renderNode, renderPanel } from "../../src/fixture/renderNode";
import "../../src/fixture/fixture.css";

const params = new URLSearchParams(window.location.search);

function App() {
    const [model] = useState(() => createModel<Types>(layoutFromQuery()));
    return (
        <Dockable.Root
            model={model}
            realtimeResize={params.get("realtime") !== "false"}
            keyMap={{
                focusNextTabset: "Ctrl+]",
                focusPreviousTabset: "Ctrl+[",
                focusTabToggle: "F6",
            }}
        >
            <Dockable.Row<Types>>{renderNode}</Dockable.Row>
            <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
            <Dockable.DropIndicator />
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
