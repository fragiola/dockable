<script setup lang="ts">
import {
    createModel,
    type LayoutJson,
    type Middleware,
    type Node,
    type TabInitOf,
    veto,
} from "@fragiola/dockable-vue";
import { Siren } from "@lucide/vue";
import { ref, watchEffect } from "vue";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import { createSimulation, SERVICES, type ServiceId } from "./simulation";
import * as styles from "./styles";
import { INCIDENT_TABSET } from "./tabs";

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
    defaults: { tab: { closable: false } },
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
                    },
                    {
                        component: "timeline",
                        label: "Timeline",
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

// the simulation and the model, created once (never in a ref)
const simulation = createSimulation();
const model = createModel<Types>(layout);
model.use(lockIncidentRegion);

const live = ref(true);
const target = ref<ServiceId>("payments");
const serviceItems = SERVICES.map((s) => ({ value: s.id, label: s.name }));

// the stream: started while live (after the mount: `flush: "post"`), and always stopped on
// unmount (the cleanup also runs when `live` changes)
watchEffect(
    (onCleanup) => {
        if (live.value) onCleanup(simulation.start(1000));
    },
    { flush: "post" },
);

function setTarget(value: unknown) {
    target.value = value as ServiceId;
}
</script>

<template>
    <div :class="styles.shell">
        <div :class="styles.toolbar">
            <div :class="styles.liveControl">
                <Switch.Root v-model="live" aria-label="Live stream">
                    <Switch.Thumb />
                </Switch.Root>
                <span :class="styles.liveLabel(live)">
                    {{ live ? "Live" : "Paused" }}
                </span>
            </div>
            <span :class="styles.shortcutHint">
                <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>→</kbd> next panel
            </span>
            <Select.Root
                :items="serviceItems"
                :model-value="target"
                @update:model-value="setTarget"
            >
                <Select.Trigger aria-label="Service" :class="styles.serviceSelect">
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    <Select.Item v-for="s in SERVICES" :key="s.id" :value="s.id">
                        {{ s.name }}
                    </Select.Item>
                </Select.Content>
            </Select.Root>
            <button
                type="button"
                :class="styles.dangerButton"
                @click="simulation.trigger(target)"
            >
                <Siren aria-hidden="true" :class="styles.buttonIcon" />
                Trigger incident
            </button>
            <button
                type="button"
                :class="styles.button"
                @click="simulation.resolveAll()"
            >
                Resolve all
            </button>
        </div>
        <div :class="styles.frame">
            <Dockable.Root
                :model="model"
                :key-map="{
                    focusNextTabset: 'Ctrl+Shift+ArrowRight',
                    focusPreviousTabset: 'Ctrl+Shift+ArrowLeft',
                }"
                :class="styles.root"
            >
                <Dockable.Row>
                    <template #default="{ node }">
                        <LayoutNode :node="node" />
                    </template>
                    <template #splitter="{ props }">
                        <Splitter v-bind="props" />
                    </template>
                </Dockable.Row>
                <!-- every service panel reports its status, so all of them mount, not only the
                     visible ones -->
                <Dockable.Panels v-slot="{ tab }" :render-on-demand="false">
                    <Dockable.Panel :node="tab" :class="styles.panel">
                        <Content :tab="tab" :simulation="simulation" />
                    </Dockable.Panel>
                </Dockable.Panels>
                <!-- Where a dragged tab would land (a refused target shows none). -->
                <Dockable.DropIndicator>
                    <template #render="{ props, state }">
                        <div v-bind="props" :class="styles.dropIndicator(state)" />
                    </template>
                </Dockable.DropIndicator>
            </Dockable.Root>
        </div>
    </div>
</template>
