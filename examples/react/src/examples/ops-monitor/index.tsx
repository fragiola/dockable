"use client";

import {
    createModel,
    type LayoutJson,
    type Middleware,
    type Node,
    type TabInitOf,
    type TabOf,
    veto,
} from "@fragiola/dockable";
import { Siren } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/cn";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { usePopupTheme } from "../_kit/theme";
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
 * The locked region, as middleware: a move into (or beside) the incident tabset is allowed only
 * for incident tabs, and incident tabs cannot leave it. It vetoes the command itself, so it holds
 * for every move, dragged or not; a drag asks the same question (`model.can`) while hovering, so
 * a refused target shows no drop indicator.
 */
const lockIncidentRegion: Middleware<Types> = (ctx, next) => {
    // a moved tab (`tab.move`) or tabset (`tabset.move`): the command narrows the payload
    const moved =
        ctx.command === "tab.move"
            ? { node: ctx.get(ctx.payload.tab), to: ctx.payload.to }
            : ctx.command === "tabset.move"
              ? { node: ctx.get(ctx.payload.tabset), to: ctx.payload.to }
              : undefined;
    if (
        moved &&
        (moved.to === INCIDENT_TABSET) !== inIncidentRegion(moved.node)
    ) {
        return veto("Only incident tabs belong in the incident region");
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
    const toolbar = useRef<HTMLDivElement | null>(null);
    const popupTheme = usePopupTheme(toolbar);

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
            <div ref={toolbar} className={styles.toolbar}>
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
                    <Select.Content {...popupTheme}>
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
                    className={cn("palette-danger", styles.solidButton)}
                >
                    <Siren aria-hidden="true" className="size-4" />
                    Trigger incident
                </button>
                <button
                    type="button"
                    onClick={() => simulation.resolveAll()}
                    className={styles.button}
                >
                    Resolve all
                </button>
            </div>
            <DockLayout
                model={model}
                renderContent={renderContent}
                // every service panel reports its status, so all of them mount, not only the
                // visible ones
                renderOnDemand={false}
                renderTabSet={(node) => <MonitorTabSet node={node} />}
                rootProps={{
                    keyMap: {
                        focusNextTabset: "Ctrl+Shift+ArrowRight",
                        focusPreviousTabset: "Ctrl+Shift+ArrowLeft",
                    },
                }}
            />
        </div>
    );
}
