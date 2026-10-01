import {
    type CommandResult,
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { useRef, useState } from "react";
import { Card } from "#/examples/_kit/card";
import { cn } from "#/lib/cn";
import { useInspector } from "../../inspector/context";

// The command catalogue, run through `model.run` as any consumer would: one button per common
// command against the active tabset (else the first) and its selected tab, and the whole catalogue
// (`model.get("commands")`, what an assistant would get as tools) listed below them. The Inspector is
// on: each click is one entry in its log (name, payload, result), and the model JSON follows.

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", data: { name: "One" } },
                    { component: "card", data: { name: "Two" } },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Three" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Four" } },
                        ],
                    },
                ],
            },
        ],
    },
};

function activeTabset(model: Model<Types>): TabsetNode<Types> | undefined {
    return (
        model.get("active-tabset-by-layout-id") ??
        model.get("tabsets-by-layout-id")[0]
    );
}

function describe(result: CommandResult<unknown> | undefined): string {
    if (!result) return "nothing to do";
    return result.ok
        ? `ok ${JSON.stringify(result.value)}`
        : `${result.error.code}: ${result.error.message}`;
}

export default function CommandsScenario() {
    const [model] = useState(() => createModel<Types>(json));
    const added = useRef(0);
    const [last, setLast] = useState("");
    useInspector(model);

    const newTab = () => {
        added.current += 1;
        return {
            component: "card" as const,
            data: { name: `New ${added.current}` },
        };
    };

    const buttons: [string, () => CommandResult<unknown> | undefined][] = [
        [
            "Add tab",
            () => {
                const tabset = activeTabset(model);
                if (!tabset) return undefined;
                return model.run("tab.add", {
                    ...newTab(),
                    to: tabset.id,
                    select: true,
                });
            },
        ],
        [
            "Add two (group)",
            () => {
                const tabset = activeTabset(model);
                if (!tabset) return undefined;
                return model.run("batch", {
                    commands: [
                        {
                            command: "tab.add",
                            payload: { ...newTab(), to: tabset.id },
                        },
                        {
                            command: "tab.add",
                            payload: { ...newTab(), to: tabset.id },
                        },
                    ],
                });
            },
        ],
        [
            "Select next",
            () => {
                const tabset = activeTabset(model);
                if (!tabset || tabset.children.length === 0) return undefined;
                const next =
                    tabset.children[
                        (tabset.selected + 1) % tabset.children.length
                    ];
                return next
                    ? model.run("tab.select", { tabId: next.id })
                    : undefined;
            },
        ],
        [
            "Move to next tabset",
            () => {
                const all = model.get("tabsets-by-layout-id");
                const tabset = activeTabset(model);
                const tab = tabset
                    ? model.get("selected-tab-by-tabset-id", {
                          tabsetId: tabset.id,
                      })
                    : undefined;
                if (!tabset || !tab || all.length < 2) return undefined;
                const index = all.findIndex((t) => t.id === tabset.id);
                const target = all[(index + 1) % all.length];
                if (!target) return undefined;
                return model.run("tab.move", {
                    tabId: tab.id,
                    to: target.id,
                    select: true,
                });
            },
        ],
        [
            "Rename",
            () => {
                const tabset = activeTabset(model);
                const tab = tabset
                    ? model.get("selected-tab-by-tabset-id", {
                          tabsetId: tabset.id,
                      })
                    : undefined;
                if (!tab) return undefined;
                return model.run("tab.update", {
                    tabId: tab.id,
                    component: tab.component,
                    data: { ...tab.data, name: `${tab.data.name}*` },
                });
            },
        ],
        [
            "Maximize",
            () => {
                const tabset = activeTabset(model);
                if (!tabset) return undefined;
                return model.run("tabset.maximize", {
                    tabsetId: tabset.id,
                    value:
                        model.get("maximized-tabset-by-layout-id")?.id !==
                        tabset.id,
                });
            },
        ],
        [
            "Even weights",
            () => {
                const row = model.get("root-row-by-layout-id");
                if (!row) return undefined;
                return model.run("row.resize", {
                    rowId: row.id,
                    weights: row.children.map(() => 50),
                });
            },
        ],
        [
            "Delete tab",
            () => {
                const tabset = activeTabset(model);
                const tab = tabset
                    ? model.get("selected-tab-by-tabset-id", {
                          tabsetId: tabset.id,
                      })
                    : undefined;
                return tab
                    ? model.run("tab.close", { tabId: tab.id })
                    : undefined;
            },
        ],
    ];

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                {buttons.map(([name, run]) => (
                    <button
                        key={name}
                        type="button"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring"
                        onClick={() => setLast(`${name}: ${describe(run())}`)}
                    >
                        {name}
                    </button>
                ))}
                <output className="truncate text-xs text-palette-accent/85">
                    {last}
                </output>
            </div>
            <details className="px-3 text-xs">
                <summary className="cursor-pointer py-1">
                    {`The catalogue: ${model.get("commands").length} commands`}
                </summary>
                <dl className="grid max-h-48 grid-cols-[max-content_1fr] gap-x-3 gap-y-1 overflow-auto pb-2">
                    {model.get("commands").map((command) => (
                        <div key={command.name} className="contents">
                            <dt className="font-mono font-semibold">
                                {command.transient
                                    ? `${command.name} (transient)`
                                    : command.name}
                            </dt>
                            <dd className="text-palette-accent/85">
                                {command.description}
                            </dd>
                        </div>
                    ))}
                </dl>
            </details>
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
                                <Card name={tab.data.name} />
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
                    className="flex min-w-0 flex-1 items-end gap-(--dk-tab-gap) overflow-hidden bg-(--dk-strip-bg) ps-[max(0.25rem,var(--dk-strip-padding))] pt-[calc(var(--dk-strip-padding)/2)]"
                >
                    {(tab) => (
                        <Dockable.Tab
                            node={tab}
                            className={cn(
                                "group/tab relative flex h-(--dk-tab-height) max-w-60 shrink-0 cursor-pointer select-none items-center gap-1.5 px-3",
                                "rounded-t-(--dk-tab-radius) font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                "border-e-(length:--dk-tab-divider) border-palette-line outline-none transition-colors duration-(--dk-motion) hover:bg-palette-soft",
                                "focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                "data-selected:bg-(--dk-tab-selected-bg) data-selected:text-(--dk-tab-selected-fg) data-dragging:opacity-40",
                            )}
                        >
                            <span className="truncate">{tab.data.name}</span>
                            <span
                                aria-hidden="true"
                                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
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
    ["left", "←"],
    ["right", "→"],
] as const;
