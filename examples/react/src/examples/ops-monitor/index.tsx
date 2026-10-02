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
import {
    EventsPanel,
    OverviewPanel,
    RunbookPanel,
    ServicePanel,
    type Types,
} from "./panels";
import { createSimulation, SERVICES, type ServiceId } from "./simulation";
import * as styles from "./styles";
import { INCIDENT_TABSET, MonitorTabSet } from "./tabs";

// A live operations console. A timer streams simulated metrics; each service panel reports its
// alert level to its tab (colour, data-status, alert badge); the overview tab is pinned; the
// incident region accepts only incident tabs (a `model.use` middleware); Ctrl+Shift+Arrow keys
// move focus between tabsets.

const service = (id: ServiceId): TabInitOf<Types> => ({
    id: `service-${id}`,
    component: "service",
    label: SERVICES.find((s) => s.id === id)?.name ?? id,
    data: { service: id },
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
                                label: "Overview",
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
                            { component: "events", label: "Events" },
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
                        label: "Runbook",
                        data: { region: "incident" },
                    },
                    {
                        component: "timeline",
                        label: "Timeline",
                        data: { region: "incident" },
                    },
                ],
            },
        ],
    },
};

/** An incident tab: a runbook or a timeline, the components of the incident region. */
const inIncidentRegion = (node: Node<Types> | undefined) =>
    node?.type === "tab" &&
    (node.component === "runbook" || node.component === "timeline");

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
    if (ctx.command === "tab.move") {
        const { tabId, to, location = "center" } = ctx.payload;
        const intoRegion = to === INCIDENT_TABSET && location === "center";
        if (inIncidentRegion(ctx.get("node-by", { id: tabId }))) {
            return intoRegion ? next() : refuse();
        }
        return to === INCIDENT_TABSET ? refuse() : next();
    }
    if (ctx.command === "tabset.move") {
        const { tabsetId, to, location = "center" } = ctx.payload;
        if (tabsetId === INCIDENT_TABSET) {
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
        <div className={styles.shell}>
            <div className={styles.toolbar}>
                <div className={styles.liveControl}>
                    <Switch.Root
                        checked={live}
                        onCheckedChange={setLive}
                        aria-label="Live stream"
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span className={styles.liveLabel(live)}>
                        {live ? "Live" : "Paused"}
                    </span>
                </div>
                <span className={styles.shortcutHint}>
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
                        className={styles.serviceSelect}
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
                    className={styles.dangerButton}
                >
                    <Siren aria-hidden="true" className={styles.buttonIcon} />
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
            <div className={styles.frame}>
                <Dockable.Root
                    model={model}
                    keyMap={{
                        focusNextTabset: "Ctrl+Shift+ArrowRight",
                        focusPreviousTabset: "Ctrl+Shift+ArrowLeft",
                    }}
                    className={styles.root}
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
                            <Dockable.Panel node={tab} className={styles.panel}>
                                {renderContent(tab)}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Where a dragged tab would land (a refused target shows none). */}
                    <Dockable.DropIndicator className={styles.dropIndicator} />
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

function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}
