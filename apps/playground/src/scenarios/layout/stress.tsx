import {
    createModel,
    Dockable,
    type LayoutJson,
    type RowJson,
    type RowNode,
    type RowSplitterProps,
    type TabsetJson,
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { PanelBody } from "#/examples/_kit/card";
import { cn } from "#/lib/cn";

// A deep tree under load: rows three levels down, twelve tabsets, eight tabs each, tight minimum
// sizes, and a maximize button on every tabset (text arrows: this app has no icon package). For geometry (splitter limits, nested weights,
// maximize), a crowded strip, and hot reload with many panels mounted.

type Types = { tabs: { body: undefined } };

const TABS_PER_TABSET = 8;

let tabsetCount = 0;

function tabset(weight = 1): TabsetJson<Types> {
    tabsetCount += 1;
    const n = tabsetCount;
    return {
        type: "tabset",
        weight,
        minWidth: 80,
        minHeight: 60,
        children: Array.from({ length: TABS_PER_TABSET }, (_, i) => ({
            component: "body",
            label: `T${n}.${i + 1}`,
        })),
    };
}

function row(
    weight: number,
    children: (RowJson<Types> | TabsetJson<Types>)[],
): RowJson<Types> {
    return { type: "row", weight, children };
}

function layout(): LayoutJson<Types> {
    tabsetCount = 0;
    return {
        version: 1,
        root: {
            type: "row",
            children: [
                row(30, [tabset(), row(1, [tabset(), tabset()]), tabset()]),
                row(40, [
                    row(1, [tabset(2), row(1, [tabset(), tabset()])]),
                    tabset(),
                ]),
                row(30, [tabset(), tabset(), row(1, [tabset(), tabset()])]),
            ],
        },
    };
}

function MaximizeButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model, layoutId } = useDockable<Types>();
    const maximized = useModelState<Types, boolean>(
        (_state, model) =>
            model.get("maximized-tabset", { layoutId })?.id === tabset.id,
    );
    return (
        <button
            type="button"
            aria-label={maximized ? "Restore" : "Maximize"}
            aria-pressed={maximized}
            className="grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring"
            onClick={() =>
                model.run("tabset.maximize", {
                    tabsetId: tabset.id,
                    value: !maximized,
                })
            }
        >
            {maximized ? "⤡" : "⤢"}
        </button>
    );
}

/** where a tab sits: its tabset's id and its own */
function TabPlace({ id }: { id: string }) {
    const parent = useModelState<Types, string>(
        (_state, model) =>
            model.get("node-parent-by", { nodeId: id })?.id ?? "",
    );
    return <p className="text-palette-accent/85">{`${parent} · ${id}`}</p>;
}

export default function Stress() {
    const [model] = useState(() => createModel<Types>(layout()));
    return (
        <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
            <Dockable.Root
                model={model}
                className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
            >
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel
                            node={tab}
                            className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                        >
                            <PanelBody title={tab.label}>
                                <TabPlace id={tab.id} />
                            </PanelBody>
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator
                    className={(state) =>
                        cn(
                            "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]",
                            state.kind === "edge"
                                ? "palette-orange bg-palette-base/25"
                                : "palette-blue bg-palette-base/20",
                        )
                    }
                    style={(state) => ({
                        transitionDuration: `${state.tabDragSpeed}s`,
                    })}
                />
                {EDGES.map(([edge, arrow]) => (
                    <Dockable.EdgeIndicator
                        key={edge}
                        edge={edge}
                        className="palette-orange z-20 flex items-center justify-center rounded-sm bg-palette-base/40 text-palette-contrast transition-colors duration-(--dk-motion) data-drop-target:bg-palette-base"
                    >
                        <span aria-hidden="true" className="text-xs">
                            {arrow}
                        </span>
                    </Dockable.EdgeIndicator>
                ))}
            </Dockable.Root>
        </div>
    );
}

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset: the strip of tabs on top, the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-(--dk-strip-padding) pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => (
                        <Dockable.Tab
                            node={tab}
                            className={cn(
                                "relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                                // the active tabset's marker: the selected tab's ::after
                                "after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:hidden after:h-0.5 after:rounded-full after:bg-(--dk-tab-marker-color) in-data-active:data-selected:after:[display:var(--dk-tab-marker)]",
                            )}
                        >
                            <span className="truncate">{tab.label}</span>
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className="flex items-center gap-0.5 pe-1">
                    <MaximizeButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The bar between two children of a row, with a wider grab area (`::after`). */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                "after:absolute after:transition-colors after:duration-(--dk-motion)",
                "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
                "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
                "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
                    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
                    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
                )}
            />
        </Dockable.Splitter>
    );
}

/** The four edge targets, each with an arrow pointing at its edge (text: no icon package here). */
const EDGES = [
    ["top", "↑"],
    ["bottom", "↓"],
    ["start", "←"],
    ["end", "→"],
] as const;
