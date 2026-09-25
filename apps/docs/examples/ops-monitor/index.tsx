"use client";

import {
    type DropInfo,
    type IJsonModel,
    Model,
    type Node,
    TabNode,
} from "@fragiola/dockable";
import { Siren } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { usePopupTheme } from "../_kit/example-theme";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import {
    EventsPanel,
    OverviewPanel,
    RunbookPanel,
    ServicePanel,
} from "./panels";
import { createSimulation, SERVICES, type ServiceId } from "./simulation";
import { INCIDENT_TABSET, MonitorTabSet } from "./tabs";

// A live operations console. A timer streams simulated metrics; each service panel reports its
// alert level to its tab (colour, data-status, alert badge); the overview tab is pinned; the
// incident region accepts only incident tabs (Model.setOnAllowDrop); Ctrl+Shift+Arrow keys move
// focus between tabsets.

const service = (id: ServiceId) => ({
    type: "tab" as const,
    id: `service-${id}`,
    name: SERVICES.find((s) => s.id === id)?.name ?? id,
    component: "service",
    config: { service: id },
});

const layout: IJsonModel = {
    global: {
        // every service panel reports its status, so all of them mount, not only the visible ones
        tabEnableRenderOnDemand: false,
        tabEnableRename: false,
        tabEnableClose: false,
    },
    borders: [],
    layout: {
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
                                type: "tab",
                                name: "Overview",
                                component: "overview",
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
                            {
                                type: "tab",
                                name: "Events",
                                component: "events",
                            },
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
                        type: "tab",
                        name: "Runbook",
                        component: "runbook",
                        config: { region: "incident" },
                    },
                    {
                        type: "tab",
                        name: "Timeline",
                        component: "timeline",
                        config: { region: "incident" },
                    },
                ],
            },
        ],
    },
};

const inIncidentRegion = (node: Node) =>
    node instanceof TabNode &&
    (node.getConfig() as { region?: string } | undefined)?.region ===
        "incident";

/**
 * The locked region: a drop into (or beside) the incident tabset is allowed only for incident
 * tabs, and incident tabs cannot leave it. A refused target shows no drop indicator.
 */
function allowDrop(dragNode: Node, dropInfo: DropInfo) {
    const intoIncident = dropInfo.node.getId() === INCIDENT_TABSET;
    return intoIncident === inIncidentRegion(dragNode);
}

export default function OpsMonitor() {
    const [simulation] = useState(createSimulation);
    const [model] = useState(() => {
        const created = Model.fromJson(layout);
        created.setOnAllowDrop(allowDrop);
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

    const renderContent = (tab: TabNode) => {
        switch (tab.getComponent()) {
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
            default:
                return null;
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
