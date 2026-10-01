"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabJson,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import {
    Calendar,
    FileText,
    House,
    type LucideIcon,
    Mail,
    Pin,
    PinOff,
    X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/cn";
import { Card } from "../_kit/card";

// Pinned tabs: kept at the start of the strip by the model, shown as icons, and not closable
// (`model.can("tab.close", …)` refuses a pinned tab). The styles read `data-pinned` on the tab.
// Whether a tab offers the pin button is the app's choice: here, `enablePin` in its data.

type Types = {
    tabs: { card: { name: string; icon?: string; enablePin: boolean } };
};

const ICONS: Record<string, LucideIcon> = {
    home: House,
    mail: Mail,
    calendar: Calendar,
};

const tab = (name: string, icon?: string, pinned = false): TabJson<Types> => ({
    component: "card",
    pinned,
    data: { name, enablePin: true, ...(icon ? { icon } : {}) },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    tab("Home", "home", true),
                    tab("Mail", "mail", true),
                    tab("Calendar", "calendar"),
                    tab("Report.pdf"),
                    tab("Budget.xlsx"),
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [tab("Notes"), tab("Drafts")],
            },
        ],
    },
};

export default function PinnedTabs() {
    const [model] = useState(() => createModel<Types>(json));
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
                            // panels sit in a layer above the tabsets, whose overflow cannot clip
                            // them: the panel repeats the tabset's inner radius on its corners
                            className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                        >
                            <Card name={tab.data.name}>
                                <p className="text-sm text-palette-accent/85">
                                    Pin or unpin the selected tab with the pin
                                    button in the header.
                                </p>
                            </Card>
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                {/* Panels are portalled into the root after the indicator: it needs a stacking
                    order to paint above them. */}
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

/** A tabset: the strip of tabs and the pin button on top, the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className="palette-raised rounded-(--dk-radius) border-(length:--dk-border) border-palette-line bg-palette-base text-palette-contrast shadow-(--dk-shadow) data-active:border-(--dk-tabset-active-line)"
        >
            <div className="flex min-h-(--dk-tab-height) items-stretch border-b border-palette-line">
                <Dockable.TabList<Types>
                    aria-label="Tabs"
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
                                // a pinned tab is a compact icon button; the first unpinned one
                                // keeps a gap after them
                                "data-pinned:px-2 [[data-pinned]+&:not([data-pinned])]:ms-2",
                            )}
                        >
                            <TabLabel tab={tab} />
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
                    <PinButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The inside of a tab: an icon when pinned (the name is kept for screen readers). */
function TabLabel({ tab }: { tab: TabOf<Types> }) {
    const { model, run } = useDockable<Types>();
    const Icon = ICONS[tab.data.icon ?? ""] ?? FileText;
    if (tab.pinned === true) {
        return (
            <>
                <Icon aria-hidden className="size-4" />
                <span className="sr-only">{tab.data.name}</span>
            </>
        );
    }
    return (
        <>
            <span className="truncate">{tab.data.name}</span>
            {model.can("tab.close", { tab: tab.id }).ok ? (
                <button
                    type="button"
                    // the tab is the tab stop; the close button is reached with the mouse
                    // (the keyboard closes with Ctrl+Delete on the tab)
                    tabIndex={-1}
                    aria-label={`Close ${tab.data.name}`}
                    className={cn(
                        "-me-1.5 grid size-5 shrink-0 place-items-center self-center rounded-sm text-current",
                        "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-40",
                    )}
                    onClick={(event) => {
                        event.stopPropagation(); // not a click on the tab
                        run("tab.close", { tab: tab.id });
                    }}
                >
                    <X aria-hidden className="size-3" />
                </button>
            ) : null}
        </>
    );
}

/** Pins or unpins the tabset's selected tab. */
function PinButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model, run } = useDockable<Types>();
    const selected = model.selectedTab(tabset.id);
    if (!selected?.data.enablePin) {
        return null;
    }
    const pinned = selected.pinned === true;
    return (
        <button
            type="button"
            aria-label={`${pinned ? "Unpin" : "Pin"} ${selected.data.name}`}
            aria-pressed={pinned}
            className={cn(
                "grid size-6 shrink-0 place-items-center self-center rounded-sm text-palette-accent/85",
                "outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring",
                "disabled:pointer-events-none disabled:opacity-40",
            )}
            onClick={() => run("tab.pin", { tab: selected.id, value: !pinned })}
        >
            {pinned ? (
                <PinOff aria-hidden className="size-3.5" />
            ) : (
                <Pin aria-hidden className="size-3.5" />
            )}
        </button>
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
