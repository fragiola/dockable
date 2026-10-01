"use client";

import {
    createModel,
    type LayoutJson,
    type Middleware,
    type Node,
    type RowNode,
    type TabInitOf,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { Siren } from "lucide-react";
import { useEffect, useState } from "react";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/cn";
import {
    EventsPanel,
    OverviewPanel,
    RunbookPanel,
    ServicePanel,
    type Types,
} from "./panels";
import { createSimulation, SERVICES, type ServiceId } from "./simulation";
import { INCIDENT_TABSET, MonitorTabSet } from "./tabs";

// A live operations console. A timer streams simulated metrics; each service panel reports its
// alert level to its tab (colour, data-status, alert badge); the overview tab is pinned; the
// incident region accepts only incident tabs (a `model.use` middleware); Ctrl+Shift+Arrow keys
// move focus between tabsets.

const service = (id: ServiceId): TabInitOf<Types> => ({
    id: `service-${id}`,
    component: "service",
    data: { name: SERVICES.find((s) => s.id === id)?.name ?? id, service: id },
});

const layout: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { enableClose: false } },
    root: {
        type: "row",
        children: [
            {
                type: "row",
                weight: 64,
                children: [
                    {
                        type: "tabset",
                        weight: 60,
                        children: [
                            {
                                component: "overview",
                                data: { name: "Overview" },
                                pinned: true,
                            },
                            service("api"),
                            service("payments"),
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 40,
                        children: [
                            service("search"),
                            service("auth"),
                            { component: "events", data: { name: "Events" } },
                        ],
                    },
                ],
            },
            {
                type: "tabset",
                id: INCIDENT_TABSET,
                weight: 36,
                children: [
                    {
                        component: "runbook",
                        data: { name: "Runbook", region: "incident" },
                    },
                    {
                        component: "timeline",
                        data: { name: "Timeline", region: "incident" },
                    },
                ],
            },
        ],
    },
};

/** An incident tab: its data says it belongs to the incident region. */
const isIncidentTab = (tab: TabOf<Types>) =>
    "region" in tab.data && tab.data.region === "incident";

const inIncidentRegion = (node: Node<Types> | undefined) =>
    node?.type === "tab" && isIncidentTab(node);

/**
 * The locked region, as middleware: incident tabs stay in the incident tabset (they move only
 * into its centre: an edge would split them off into a new tabset), nothing else goes into it or
 * beside it, and the incident tabset may be docked elsewhere but never merged into another one.
 * It vetoes the command itself, so it holds for every move, dragged or not; a drag asks the same
 * question (`model.can`) while hovering, so a refused target shows no drop indicator.
 */
const lockIncidentRegion: Middleware<Types> = (ctx, next) => {
    const refuse = () =>
        veto("Only incident tabs belong in the incident region");
    // the command narrows the payload
    if (ctx.command === "tab.move") {
        const { tab, to, location = "center" } = ctx.payload;
        const intoRegion = to === INCIDENT_TABSET && location === "center";
        if (inIncidentRegion(ctx.get("node", { node: tab }))) {
            return intoRegion ? next() : refuse();
        }
        return to === INCIDENT_TABSET ? refuse() : next();
    }
    if (ctx.command === "tabset.move") {
        const { tabset, to, location = "center" } = ctx.payload;
        if (tabset === INCIDENT_TABSET) {
            return location === "center" ? refuse() : next();
        }
        return to === INCIDENT_TABSET ? refuse() : next();
    }
    return next();
};

export default function OpsMonitor() {
    const [simulation] = useState(createSimulation);
    const [model] = useState(() => {
        const created = createModel<Types>(layout);
        created.use(lockIncidentRegion);
        return created;
    });
    const [live, setLive] = useState(true);
    const [target, setTarget] = useState<ServiceId>("payments");

    // the stream: started while live, and always stopped on unmount
    useEffect(
        () => (live ? simulation.start(1000) : undefined),
        [simulation, live],
    );

    const renderContent = (tab: TabOf<Types>) => {
        // `tab.data` narrows on `tab.component`: a service panel gets its service's data
        switch (tab.component) {
            case "service":
                return <ServicePanel tab={tab} simulation={simulation} />;
            case "overview":
                return <OverviewPanel simulation={simulation} />;
            case "events":
                return <EventsPanel simulation={simulation} />;
            case "timeline":
                return (
                    <EventsPanel
                        simulation={simulation}
                        only={["warning", "critical"]}
                    />
                );
            case "runbook":
                return <RunbookPanel simulation={simulation} />;
        }
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)">
            <div className="palette-surface flex flex-wrap items-center gap-2 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
                <div className="flex items-center gap-2 text-sm">
                    <Switch.Root
                        checked={live}
                        onCheckedChange={setLive}
                        aria-label="Live stream"
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span
                        className={cn(
                            live && "palette-green text-palette-accent",
                        )}
                    >
                        {live ? "Live" : "Paused"}
                    </span>
                </div>
                <span className="ms-auto hidden text-xs text-palette-accent/85 lg:inline">
                    <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>→</kbd> next panel
                </span>
                <Select.Root
                    items={SERVICES.map((s) => ({
                        value: s.id,
                        label: s.name,
                    }))}
                    value={target}
                    onValueChange={(value) => setTarget(value as ServiceId)}
                >
                    <Select.Trigger
                        aria-label="Service"
                        className="h-8 w-36 py-0 text-sm"
                    >
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        {SERVICES.map((s) => (
                            <Select.Item key={s.id} value={s.id}>
                                {s.name}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
                <button
                    type="button"
                    onClick={() => simulation.trigger(target)}
                    className={cn(
                        "palette-danger inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast",
                        "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
                >
                    <Siren aria-hidden="true" className="size-4" />
                    Trigger incident
                </button>
                <button
                    type="button"
                    onClick={() => simulation.resolveAll()}
                    className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md border border-palette-line bg-palette-base px-3 text-sm text-palette-contrast",
                        "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
                >
                    Resolve all
                </button>
            </div>
            {/* The root needs a size. Its row is `position: absolute; inset: 0`, so the gutter
                around the layout goes on a wrapper: padding on the root would not move the row. */}
            <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                <Dockable.Root
                    model={model}
                    keyMap={{
                        focusNextTabset: "Ctrl+Shift+ArrowRight",
                        focusPreviousTabset: "Ctrl+Shift+ArrowLeft",
                    }}
                    className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                >
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    {/* every service panel reports its status, so all of them mount, not only the
                        visible ones */}
                    <Dockable.Panels<Types> renderOnDemand={false}>
                        {(tab) => (
                            <Dockable.Panel
                                node={tab}
                                // panels sit in a layer above the tabsets, whose overflow cannot
                                // clip them: the panel repeats the tabset's inner radius on its
                                // corners
                                className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                            >
                                {renderContent(tab)}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Where a dragged tab would land (a refused target shows none). Panels are
                        portalled into the root after it, so it needs a stacking order to paint
                        above them. */}
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
        </div>
    );
}

/**
 * A row's child: a tabset (`MonitorTabSet`, in tabs.tsx), or a nested row rendered by this same
 * function.
 */
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
    return <MonitorTabSet node={node} />;
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
