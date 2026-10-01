"use client";

import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type Middleware,
    type RowNode,
    type TabAddPayload,
    type TabJson,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { Ban, Lock } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/cn";
import { PanelBody } from "../_kit/card";

// Stop drops into part of the layout, in two layers:
//
// 1. A middleware (`model.use`) on the commands that place a tab or tabset: `tab.move`,
//    `tabset.move` and `tab.add`. Here the "Reference" tabset takes only tabs whose
//    `data.region` is "reference" (in its strip, its centre or its sides), and the layout's edge
//    beside a locked tabset refuses docking. It runs for every command, whoever issues it: a
//    drag asks it on every hover with `model.can` (a dry run, `ctx.dryRun`), so over a refused
//    target the outline hides, the browser shows its "not allowed" cursor, and the target
//    tabset and the root get `data-drop-refused`; a drop, or a command run from code, is vetoed
//    the same way.
// 2. Node flags: the "Console" tabset has `enableDrop: false` (nothing merges into it) and
//    `enableDivide: false` (nothing splits it), and its tabs `enableDrag: false`.
//

type Types = {
    tabs: {
        doc: { name: string; region: string };
        console: { name: string };
    };
    tabset: { name: string };
};

const REFERENCE = "reference";
const CONSOLE = "console";
const LOCKED = new Set([REFERENCE, CONSOLE]);

const doc = (name: string, region: string): TabJson<Types> => ({
    component: "doc",
    data: { name, region },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: REFERENCE,
                data: { name: "Reference" },
                weight: 30,
                children: [
                    doc("Spec", "reference"),
                    doc("Glossary", "reference"),
                ],
            },
            {
                type: "tabset",
                id: "workspace",
                data: { name: "Workspace" },
                weight: 45,
                children: [
                    doc("Draft", "workspace"),
                    // belongs to the reference region: it may be dropped there
                    doc("API reference", "reference"),
                    doc("Notes", "workspace"),
                ],
            },
            {
                type: "tabset",
                id: CONSOLE,
                data: { name: "Console" },
                weight: 25,
                enableDrop: false,
                enableDivide: false,
                children: [
                    {
                        component: "console",
                        data: { name: "Console" },
                        enableDrag: false,
                    },
                    {
                        component: "console",
                        data: { name: "Output" },
                        enableDrag: false,
                    },
                ],
            },
        ],
    },
};

/** A tab's region: only documents have one. */
function regionOf(tab: TabOf<Types> | TabAddPayload<Types> | undefined) {
    return tab?.component === "doc" ? tab.data.region : undefined;
}

/**
 * The drop rule, as middleware. Ids are stable; paths (`/ts0`) change as the layout changes.
 * `ctx.payload` is the payload of `ctx.command`: the fields it names tell which one it is.
 */
const lockedRegions: Middleware<Types> = (ctx, next) => {
    if (
        ctx.command !== "tab.move" &&
        ctx.command !== "tabset.move" &&
        ctx.command !== "tab.add"
    ) {
        return next();
    }
    const payload = ctx.payload;
    if (!("to" in payload)) {
        return next();
    }
    // what is placed: an existing tab (tab.move), a new tab (tab.add) or a tabset (tabset.move)
    const moving =
        "tab" in payload
            ? ctx.get("node", { node: payload.tab })
            : "component" in payload
              ? payload
              : undefined;
    const tab = moving && "component" in moving ? moving : undefined;
    const name = tab ? `"${tab.data.name}"` : "a tabset";

    if (payload.to === REFERENCE && regionOf(tab) !== REFERENCE) {
        return veto(`A middleware vetoed moving ${name} into Reference.`);
    }
    // docking at the layout's edge next to a locked tabset (`to` is the root row, or the layout)
    const target =
        payload.to === MAIN_LAYOUT
            ? ctx.state.root
            : ctx.get("node", { node: payload.to });
    if (target?.type === "row") {
        const children = target.children;
        const beside =
            payload.location === "left"
                ? children[0]
                : payload.location === "right"
                  ? children[children.length - 1]
                  : undefined;
        if (beside && LOCKED.has(beside.id)) {
            return veto(
                `A middleware vetoed docking ${name} beside a locked tabset.`,
            );
        }
    }
    return next();
};

export default function LockedRegions() {
    // the rule is installed once, with the model: it guards every command from the start
    const [model] = useState(() => {
        const created = createModel<Types>(json);
        created.use(lockedRegions);
        return created;
    });
    const [notice, setNotice] = useState<string | undefined>(undefined);

    return (
        <>
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                <Lock aria-hidden className="size-4 text-palette-accent/85" />
                <p className="text-sm text-palette-accent/85">
                    Reference takes reference tabs only; Console takes nothing.
                </p>
                <p role="status" className="ms-auto text-sm">
                    {notice}
                </p>
            </div>
            {/* The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter
                around the layout goes on a wrapper: padding on the root would not move the row. */}
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
                                // panels sit in a layer above the tabsets, whose overflow cannot
                                // clip them: the panel repeats the tabset's inner radius on its
                                // corners
                                className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                            >
                                {tab.component === "doc" ? (
                                    <DocPanel tab={tab} onNotice={setNotice} />
                                ) : (
                                    <PanelBody title={tab.data.name}>
                                        <p className="text-palette-accent/85">
                                            Locked in place: this tab cannot be
                                            dragged, and nothing can be dropped
                                            into or beside it.
                                        </p>
                                    </PanelBody>
                                )}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Panels are portalled into the root after the indicator: it needs a
                        stacking order to paint above them. */}
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
                    {/* inside the root: shown while the root has data-drop-refused */}
                    <div
                        role="status"
                        className="palette-danger pointer-events-none absolute start-1/2 top-3 z-30 hidden -translate-x-1/2 items-center gap-2 rounded-full bg-palette-base px-3 py-1.5 text-sm text-palette-contrast shadow-md in-data-drop-refused:flex rtl:translate-x-1/2"
                    >
                        <Ban aria-hidden className="size-4" />
                        Not allowed here
                    </div>
                </Dockable.Root>
            </div>
        </>
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

/** A tabset: the strip of tabs and its lock on top, the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className={cn(
                "palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)",
                LOCKED.has(node.id) && "border-dashed",
                // a tabset refusing the current drag is marked by data-drop-refused
                "data-drop-refused:opacity-60",
            )}
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    // a tabset created by a drop has no name of its own
                    aria-label={node.data?.name || "Tabs"}
                    // the start padding is load-bearing: a tab flush with the tabset's edge could
                    // not take a drop before it (that edge is the tabset's side drop)
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
                            {/* the active tabset's marker: `in-data-active:` reads the enclosing
                                TabSet's data-active, `group-data-selected/tab:` this tab's */}
                            <span
                                aria-hidden="true"
                                className="palette-blue pointer-events-none absolute inset-x-2 bottom-0 hidden h-0.5 rounded-full bg-palette-base in-data-active:group-data-selected/tab:[display:var(--dk-tab-marker)]"
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className="flex items-center gap-0.5 pe-1">
                    <LockBadge tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A lock on locked tabsets, with a Fragiola tooltip saying why. */
function LockBadge({ tabset }: { tabset: TabsetNode<Types> }) {
    if (!LOCKED.has(tabset.id)) {
        return null;
    }
    const why =
        tabset.id === REFERENCE
            ? "Only reference tabs can be dropped here"
            : "Nothing can be dropped here, and its tabs stay put";
    return (
        <Tooltip.Root>
            <Tooltip.Trigger
                aria-label={`Locked: ${why}`}
                className={cn(
                    "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                    "outline-none hover:bg-palette-soft hover:text-palette-contrast",
                    "focus-visible:ring-2 focus-visible:ring-palette-ring",
                    "disabled:pointer-events-none disabled:opacity-40",
                )}
            >
                <Lock aria-hidden className="size-3.5" />
            </Tooltip.Trigger>
            <Tooltip.Content>{why}</Tooltip.Content>
        </Tooltip.Root>
    );
}

/** The content of a document tab, with a button that tries to break the rule from code. */
function DocPanel({
    tab,
    onNotice,
}: {
    tab: Extract<TabOf<Types>, { component: "doc" }>;
    onNotice: (notice: string | undefined) => void;
}) {
    const { model } = useDockable<Types>();
    const region = tab.data.region;
    // a command from code goes through the same middleware: the result says why it was refused
    const moveToReference = () => {
        const result = model.run("tab.move", {
            tab: tab.id,
            to: REFERENCE,
            location: "center",
            index: -1,
        });
        onNotice(result.ok ? undefined : result.error.message);
    };
    return (
        <PanelBody title={tab.data.name}>
            <p className="text-palette-accent/85">
                {`Region: ${region}. `}
                {region === REFERENCE
                    ? "This tab may be dropped into Reference."
                    : "Reference refuses this tab: try dragging it there."}
            </p>
            {region !== REFERENCE &&
            model.get("parent", { node: tab.id })?.id !== REFERENCE ? (
                <div>
                    <button
                        type="button"
                        className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm",
                            "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                            "disabled:pointer-events-none disabled:opacity-50",
                        )}
                        onClick={moveToReference}
                    >
                        Move to Reference from code
                    </button>
                </div>
            ) : null}
        </PanelBody>
    );
}

/**
 * The bar between two children of a row: `--dk-splitter-size` thick (the engine measures it), with
 * a wider grab area (`::after`) and a grip for the themes that show one (`--dk-grip`).
 */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                "after:absolute after:transition-colors after:duration-(--dk-motion)",
                "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                // side by side: a vertical bar
                "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                // stacked: a horizontal bar
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
