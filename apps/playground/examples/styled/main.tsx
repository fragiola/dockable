import {
    Actions,
    DockableLabel,
    DockLocation,
    type IJsonModel,
    Model,
    type RowNode,
    type TabNode,
    TabSetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { type ReactNode, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// the basic fixture's shape: three tabsets, the last two stacked in a nested row
const json: IJsonModel = {
    global: { tabEnablePopout: true },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "One", component: "card" },
                    { type: "tab", name: "Two", component: "card" },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Three", component: "card" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Four", component: "card" },
                        ],
                    },
                ],
            },
        ],
    },
};

/** The example's accessible names: the package has no text of its own. */
const labels: Partial<Record<DockableLabel, string>> = {
    [DockableLabel.Splitter]: "Resize",
};

/** Splitters: thickness, hover, focus and drag state, all from data-* and pseudo-classes. */
function renderSplitter(props: RowSplitterProps) {
    return (
        <Dockable.Splitter
            {...props}
            className="shrink-0 bg-palette-line outline-none transition-colors hover:bg-palette-ring focus-visible:bg-palette-ring data-dragging:bg-palette-ring data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:cursor-ns-resize data-[orientation=vertical]:w-1.5 data-[orientation=vertical]:cursor-ew-resize"
        />
    );
}

/** The consumer's own pop out button: an inline SVG and an accessible name, no package text. */
function PopoutButton({ tabset }: { tabset: TabSetNode }) {
    const { engine, mainEngine } = useDockable();
    const selected = tabset.getSelectedNode() as TabNode | undefined;
    if (
        !selected?.isEnablePopout() ||
        !mainEngine.isSupportsPopout() ||
        tabset.getLayoutId() !== Model.MAIN_LAYOUT_ID
    ) {
        return null;
    }
    return (
        <button
            type="button"
            aria-label={`Pop out ${selected.getName()}`}
            data-testid="popout"
            className="me-1 grid size-7 place-items-center self-center rounded-sm text-palette-accent/85 outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring"
            onClick={() =>
                engine.doAction(Actions.popoutTab(selected.getId(), "window"))
            }
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4 fill-none stroke-current stroke-[1.5]"
            >
                <path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" />
            </svg>
        </button>
    );
}

function renderNode(child: TabSetNode | RowNode): ReactNode {
    if (child instanceof TabSetNode) {
        return (
            <Dockable.TabSet
                node={child}
                className="group palette-raised m-1 rounded-md border border-palette-line bg-palette-base data-active:border-palette-ring"
            >
                <div className="flex items-stretch border-b border-palette-line">
                    <Dockable.TabList
                        aria-label={child.getName() ?? "Tabs"}
                        className="flex min-h-9 flex-1 items-end gap-1 ps-2 pt-1"
                    >
                        {(tab) => (
                            <Dockable.Tab
                                node={tab}
                                className="relative cursor-pointer select-none rounded-t-sm px-3 py-1.5 text-palette-accent/85 outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring data-dragging:opacity-40 data-selected:bg-palette-soft data-selected:text-palette-contrast"
                            >
                                {tab.getName()}
                                {/* the active-tabset marker: selected tab of the active tabset only */}
                                <span
                                    aria-hidden="true"
                                    className="palette-blue absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base group-data-active:in-data-selected:block"
                                />
                            </Dockable.Tab>
                        )}
                    </Dockable.TabList>
                    <PopoutButton tabset={child} />
                </div>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    return (
        <Dockable.Row node={child} renderSplitter={renderSplitter}>
            {renderNode}
        </Dockable.Row>
    );
}

/** Tab content with observable state, and a dock-back button while popped out. */
function Card({ tab }: { tab: TabNode }) {
    const [count, setCount] = useState(0);
    const { mainEngine, model } = useDockable();
    const poppedOut = tab.getLayoutId() !== Model.MAIN_LAYOUT_ID;
    const dockBack = () => {
        const target = model.getFirstTabSet();
        if (target) {
            mainEngine.doAction(
                Actions.moveNode(
                    tab.getId(),
                    target.getId(),
                    DockLocation.CENTER,
                    -1,
                ),
            );
        }
    };
    return (
        <div className="flex flex-col gap-3 p-4" data-testid="content">
            <h2 className="text-base">{tab.getName()}</h2>
            <p className="text-palette-accent/85">
                Drag the tab, resize with the splitters, pop it out.
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    data-testid="counter"
                    className="palette-blue h-control rounded-md bg-palette-base px-3 text-palette-contrast hover:bg-palette-base-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palette-ring"
                    onClick={() => setCount((c) => c + 1)}
                >
                    {`Count: ${count}`}
                </button>
                <input
                    data-testid="input"
                    aria-label={`${tab.getName()} notes`}
                    placeholder="Notes"
                    className="h-control rounded-md border border-palette-line bg-palette-soft px-3 placeholder:text-palette-accent/85 focus-visible:outline-2 focus-visible:outline-palette-ring"
                />
                {poppedOut ? (
                    <button
                        type="button"
                        data-testid="dock-back"
                        className="h-control rounded-md border border-palette-line px-3 hover:bg-palette-soft"
                        onClick={dockBack}
                    >
                        Dock back
                    </button>
                ) : null}
            </div>
        </div>
    );
}

/**
 * Applies the page direction (RTL is a Fragiola MVP goal, so the example checks it holds up).
 * Workaround (see the gap report): flipping the direction mirrors the flex rows, which moves every
 * tabset without resizing any, so the engine's resize observers never fire. The measure pass is
 * re-run by hand after the flip.
 */
function Direction({ dir }: { dir: "ltr" | "rtl" }) {
    const { engine } = useDockable();
    useEffect(() => {
        document.documentElement.dir = dir;
        engine.sync();
    }, [engine, dir]);
    return null;
}

function App() {
    const [model] = useState(() => Model.fromJson(json));
    const [dir, setDir] = useState<"ltr" | "rtl">("ltr");
    const toggleDir = () => setDir((d) => (d === "ltr" ? "rtl" : "ltr"));

    return (
        <div className="flex h-screen flex-col">
            <header className="flex items-center gap-3 border-b border-palette-line px-4 py-2">
                <h1 className="text-sm">Dockable — styled example</h1>
                <button
                    type="button"
                    data-testid="dir"
                    className="ms-auto rounded-md border border-palette-line px-2 py-1 hover:bg-palette-soft"
                    onClick={toggleDir}
                >
                    {dir === "ltr" ? "Switch to RTL" : "Switch to LTR"}
                </button>
            </header>
            <Dockable.Root
                model={model}
                popoutURL="/popout.html"
                getLabel={(key) => labels[key]}
                className="palette-surface flex-1 bg-palette-base"
            >
                <Direction dir={dir} />
                <Dockable.Row renderSplitter={renderSplitter}>
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels>
                    {(tab) => (
                        // the panel sits over the tabset's content area but outside the tabset, so
                        // the tabset's rounded corners do not clip it: round its bottom corners to
                        // the tabset's inner radius (rounded-md minus the 1px border)
                        <Dockable.Panel
                            node={tab}
                            className="palette-surface overflow-hidden rounded-b-[calc(var(--radius-md)-1px)] bg-palette-base text-palette-contrast"
                        >
                            <Card tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* z-10: the panels are portalled into the root after the indicator, so without a
                    stacking order they would paint over it */}
                <Dockable.DropIndicator
                    className={(state) =>
                        state.kind === "edge"
                            ? "palette-orange z-10 rounded-sm border-2 border-dashed border-palette-base bg-palette-base/25"
                            : "palette-blue z-10 rounded-md border-2 border-palette-base bg-palette-base/20"
                    }
                    style={(state) => ({
                        transitionProperty: "left, top, width, height",
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                />
                <Dockable.Popout
                    title={() => "Dockable — popout"}
                    onOpen={(_layout, _window, doc) => {
                        // the palettes key off the root's data-theme and the body's palette class,
                        // which the popout document does not have (see the gap report)
                        doc.documentElement.dataset.theme =
                            document.documentElement.dataset.theme;
                        doc.body.classList.add("palette-surface");
                    }}
                    className="palette-surface bg-palette-base"
                >
                    {() => (
                        <Dockable.Row renderSplitter={renderSplitter}>
                            {renderNode}
                        </Dockable.Row>
                    )}
                </Dockable.Popout>
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
