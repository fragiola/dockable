import {
    createModel,
    Dockable,
    type DragEventLike,
    type ExternalDrag,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
    useDragNode,
} from "@fragiola/dockable-react";
import { type ReactNode, StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/fixture/fixture.css";

/**
 * Drags that are not the layout's own (caplin/FlexLayout#350, #497, #527, #528):
 * - "Lists": two lists whose items move by the app's own native drag and drop, a chip whose
 *   dragend and a sink whose drop stop their propagation (an editor that takes a drop);
 * - "Nested": a second layout (another model) inside a tab, which accepts files;
 * - a "Tabs" menu in each strip of the outer layout, whose items drag their tab and close the menu
 *   once the drag started (a source that unmounts mid-drag);
 * - a sidebar outside the layout, to let go of a drag there.
 * `?accept=all` gives the outer layout an onExternalDrag that accepts every drag as a new tab.
 */
type Types = {
    tabs: { testing: undefined; lists: undefined; nested: undefined };
};

const acceptAll =
    new URLSearchParams(window.location.search).get("accept") === "all";

const outerJson: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "lists", label: "Lists" }],
            },
            {
                type: "tabset",
                weight: 20,
                children: [
                    { component: "testing", label: "Other" },
                    { component: "testing", label: "Spare" },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "nested", label: "Nested" }],
            },
        ],
    },
};

const innerJson: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [{ component: "testing", label: "Inner A" }],
            },
            {
                type: "tabset",
                children: [{ component: "testing", label: "Inner B" }],
            },
        ],
    },
};

/** a tab of the menu: it drags its tab, and the menu closes once the drag started */
function MenuItem({
    tab,
    onDragStarted,
}: {
    tab: TabOf<Types>;
    onDragStarted: () => void;
}) {
    const { props } = useDragNode<Types>(tab);
    return (
        <div
            role="menuitem"
            tabIndex={-1}
            {...props}
            onDragStart={(event) => {
                props.onDragStart(event);
                onDragStarted();
            }}
        >
            {tab.label}
        </div>
    );
}

function TabMenu({ tabset }: { tabset: TabsetNode<Types> }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                Tabs
            </button>
            {open ? (
                <div
                    role="menu"
                    aria-label="Tabs"
                    style={{
                        position: "absolute",
                        zIndex: 20,
                        background: "white",
                    }}
                >
                    {tabset.children.map((tab) => (
                        <MenuItem
                            key={tab.id}
                            tab={tab}
                            // after the drag started: removing its source in dragstart cancels it
                            onDragStarted={() =>
                                setTimeout(() => setOpen(false))
                            }
                        />
                    ))}
                </div>
            ) : null}
        </>
    );
}

function renderNode(
    child: TabsetNode<Types> | RowNode<Types>,
    menu: boolean,
): ReactNode {
    if (child.type === "row") {
        return (
            <Dockable.Row node={child}>
                {(node) => renderNode(node, menu)}
            </Dockable.Row>
        );
    }
    return (
        <Dockable.TabSet node={child}>
            <div style={{ display: "flex" }}>
                <Dockable.TabList<Types> aria-label="Tabs" style={{ flex: 1 }}>
                    {(tab) => (
                        <Dockable.Tab node={tab}>{tab.label}</Dockable.Tab>
                    )}
                </Dockable.TabList>
                {menu ? <TabMenu tabset={child} /> : null}
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

type ListId = "a" | "b";

/** two lists with their own native drag and drop, a chip and a sink that stop their events */
function Lists() {
    const [lists, setLists] = useState<Record<ListId, string[]>>({
        a: ["Apple", "Banana"],
        b: ["Cherry"],
    });
    const [sunk, setSunk] = useState("none");
    const chip = useRef<HTMLSpanElement>(null);
    const sink = useRef<HTMLDivElement>(null);

    // native listeners: React's run on the app's container, after the layout's own, so they could
    // not keep an event from the layout
    useEffect(() => {
        const chipElement = chip.current;
        const sinkElement = sink.current;
        if (!chipElement || !sinkElement) return;
        const onChipStart = (event: DragEvent) =>
            event.dataTransfer?.setData("text/plain", "chip");
        const stop = (event: Event) => event.stopPropagation();
        const onSinkOver = (event: DragEvent) => event.preventDefault();
        const onSinkDrop = (event: DragEvent) => {
            event.preventDefault();
            event.stopPropagation();
            setSunk(event.dataTransfer?.getData("text/plain") || "?");
        };
        chipElement.addEventListener("dragstart", onChipStart);
        chipElement.addEventListener("dragend", stop);
        sinkElement.addEventListener("dragover", onSinkOver);
        sinkElement.addEventListener("drop", onSinkDrop);
        return () => {
            chipElement.removeEventListener("dragstart", onChipStart);
            chipElement.removeEventListener("dragend", stop);
            sinkElement.removeEventListener("dragover", onSinkOver);
            sinkElement.removeEventListener("drop", onSinkDrop);
        };
    }, []);

    const move = (name: string, to: ListId) =>
        setLists((prev) => {
            if (!name || prev[to].includes(name)) return prev;
            return {
                a:
                    to === "a"
                        ? [...prev.a, name]
                        : prev.a.filter((n) => n !== name),
                b:
                    to === "b"
                        ? [...prev.b, name]
                        : prev.b.filter((n) => n !== name),
            };
        });

    const list = (id: ListId) => (
        <ul
            data-testid={`list-${id}`}
            style={{ minHeight: 60, margin: 8, border: "1px solid #999" }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
                event.preventDefault();
                move(event.dataTransfer.getData("text/plain"), id);
            }}
        >
            {lists[id].map((name) => (
                <li
                    key={name}
                    draggable
                    data-testid={`item-${name}`}
                    onDragStart={(event) =>
                        event.dataTransfer.setData("text/plain", name)
                    }
                >
                    {name}
                </li>
            ))}
        </ul>
    );

    return (
        <div data-testid="lists">
            {list("a")}
            {list("b")}
            <span ref={chip} draggable data-testid="chip">
                Chip
            </span>
            <div
                ref={sink}
                data-testid="sink"
                style={{ height: 60, margin: 8, border: "1px solid #999" }}
            >
                Sink
            </div>
            <output data-testid="sunk">{sunk}</output>
        </div>
    );
}

/** a layout of another model inside a tab: it accepts files dragged in */
function Nested() {
    const [model] = useState(() => createModel<Types>(innerJson));
    const onExternalDrag = (
        event: DragEventLike,
    ): ExternalDrag<Types> | undefined =>
        event.dataTransfer?.types.includes("Files")
            ? { tab: { component: "testing", label: "File" } }
            : undefined;
    return (
        <div
            data-testid="inner"
            style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
            <Dockable.Root model={model} onExternalDrag={onExternalDrag}>
                <Dockable.Row<Types>>
                    {(child) => renderNode(child, false)}
                </Dockable.Row>
                <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
                <Dockable.DropIndicator />
            </Dockable.Root>
        </div>
    );
}

function renderPanel(tab: TabOf<Types>): ReactNode {
    return (
        <Dockable.Panel node={tab}>
            {tab.component === "lists" ? (
                <Lists />
            ) : tab.component === "nested" ? (
                <Nested />
            ) : (
                <p>{tab.label}</p>
            )}
        </Dockable.Panel>
    );
}

function App() {
    const [model] = useState(() => createModel<Types>(outerJson));
    const onExternalDrag = acceptAll
        ? (): ExternalDrag<Types> => ({
              tab: { component: "testing", label: "Dropped" },
          })
        : undefined;
    return (
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            <aside data-testid="outside" style={{ width: 120 }}>
                Outside
            </aside>
            <Dockable.Root model={model} onExternalDrag={onExternalDrag}>
                <Dockable.Row<Types>>
                    {(child) => renderNode(child, true)}
                </Dockable.Row>
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
