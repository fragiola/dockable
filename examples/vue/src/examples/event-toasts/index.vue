<script setup lang="ts">
import {
    type CommandEvent,
    type CommandName,
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
} from "@fragiola/dockable-vue";
import { Plus } from "@lucide/vue";
import { onUnmounted, ref, shallowRef } from "vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";
import Toaster from "./Toaster.vue";
import { type Toast, useToasts } from "./toasts";

// The layout tells the app what happened: `model.subscribe` delivers one event per committed
// command, whoever issued it (a drag, a close button, a keyboard shortcut, the Add button). The app
// decides what deserves a reaction. Here: a toast per kind of command, each worded for that kind,
// and a closed tab's toast offers Undo, which adds the tab back where it was: the event carries
// the state before the close (`event.before`), where the tab, its tabset and its place are found.
// The switches mute kinds: the listener sees every command, the app picks.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar" },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "area" },
                    },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Orders",
                                data: { seed: 3 },
                            },
                            {
                                component: "kpi",
                                label: "Refunds",
                                data: { seed: 12 },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "chart",
                                label: "Share",
                                data: { kind: "donut" },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

/** The kinds of command that can raise a toast, and the switch that mutes each. */
const KINDS = [
    { command: "tab.close", label: "Close" },
    { command: "tab.move", label: "Move" },
    { command: "tabset.maximize", label: "Maximize" },
    { command: "tab.add", label: "Add" },
    { command: "tab.select", label: "Select" },
] as const satisfies readonly { command: CommandName; label: string }[];

/**
 * A field of an event's payload or result. `CommandEvent` types both as `unknown` (one listener
 * sees every command), so the example reads the fields it needs and checks their type.
 */
function field(value: unknown, key: string): unknown {
    return typeof value === "object" && value !== null
        ? Reflect.get(value, key)
        : undefined;
}

/** Where a tab is in a layout's state: its tabset and its place in the strip. */
interface Place {
    tab: TabOf<Types>;
    tabsetId: string;
    index: number;
}

/** Finds a tab in a row of a state: the event's `before` or `after`. */
function placeOf(row: RowNode<Types>, tabId: string): Place | undefined {
    for (const child of row.children) {
        if (child.type === "row") {
            const found = placeOf(child, tabId);
            if (found) return found;
            continue;
        }
        const index = child.children.findIndex((tab) => tab.id === tabId);
        const tab = child.children[index];
        if (tab) return { tab, tabsetId: child.id, index };
    }
    return undefined;
}

/** Adds a closed tab back where it was (its tabset, its place), or to the active tabset. */
function reopen(model: Model<Types>, { tab, tabsetId, index }: Place) {
    const home = model.get("node-by", { id: tabsetId });
    const to =
        home?.type === "tabset" ? home.id : model.get("default-tabset")?.id;
    if (!to) return;
    // a tab node says `type: "tab"`, which `tab.add` does not take: the rest is its init
    const { type: _type, ...init } = tab;
    model.run("tab.add", { ...init, to, index, select: true });
}

/** The words of a toast for one event, or nothing for a command the example does not announce. */
function describe(
    model: Model<Types>,
    event: CommandEvent<Types>,
): Omit<Toast, "id"> | undefined {
    if (event.command === "tabset.maximize") {
        return field(event.payload, "value") === true
            ? { tone: "info", title: "Maximized a tabset" }
            : { tone: "info", title: "Restored the layout" };
    }
    const tabId = field(event.result, "tabId");
    if (typeof tabId !== "string") return undefined;
    // a closed tab is only in the state before the event, an added one only in the state after it
    const before = placeOf(event.before.root, tabId);
    const after = placeOf(event.after.root, tabId);
    const name = (before ?? after)?.tab.label ?? "a tab";
    switch (event.command) {
        case "tab.close":
            return {
                tone: "danger",
                title: `Closed ${name}`,
                action: before && {
                    label: "Undo",
                    run: () => reopen(model, before),
                },
            };
        case "tab.move": {
            const location = field(event.payload, "location");
            return {
                tone: "info",
                title: `Moved ${name}`,
                detail:
                    typeof location === "string" && location !== "center"
                        ? `Docked ${location}`
                        : before?.tabsetId === after?.tabsetId
                          ? "Reordered in its tabset"
                          : "Into another tabset",
            };
        }
        case "tab.add":
            return { tone: "success", title: `Added ${name}` };
        case "tab.select":
            return { tone: "neutral", title: `Showing ${name}` };
        default:
            return undefined;
    }
}

const model = createModel<Types>(json);
const { toasts, show, dismiss } = useToasts();
const muted = shallowRef<ReadonlySet<CommandName>>(new Set(["tab.select"]));
const added = ref(0);

// one listener for the component's life: it reads the muted kinds when an event comes
const unsubscribe = model.subscribe((event) => {
    // a splitter drag commits many transient steps: none of them is news
    if (event.transient || muted.value.has(event.command)) return;
    const toast = describe(model, event);
    if (toast) show(toast);
});
onUnmounted(unsubscribe);

function toggleKind(command: CommandName) {
    const next = new Set(muted.value);
    if (!next.delete(command)) next.add(command);
    muted.value = next;
}

function addChart() {
    const tabset = model.get("default-tabset");
    if (!tabset) return;
    added.value += 1;
    model.run("tab.add", {
        component: "chart",
        label: `Chart ${added.value}`,
        data: { kind: "line" },
        to: tabset.id,
        select: true,
    });
}
</script>

<template>
    <div :class="styles.toolbar">
        <fieldset aria-label="Toast on" :class="styles.kinds">
            <button
                v-for="{ command, label } in KINDS"
                :key="command"
                type="button"
                :aria-pressed="!muted.has(command)"
                :class="styles.kind"
                @click="toggleKind(command)"
            >
                {{ label }}
            </button>
        </fieldset>
        <button type="button" :class="styles.button" @click="addChart">
            <Plus aria-hidden="true" :class="styles.icon" />
            Add a chart
        </button>
    </div>
    <div :class="styles.frame">
        <Dockable.Root :model="model" :class="styles.root">
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode :node="node" />
                </template>
                <template #splitter="{ props }">
                    <Splitter v-bind="props" />
                </template>
            </Dockable.Row>
            <Dockable.Panels v-slot="{ tab }">
                <Dockable.Panel :node="tab" :class="styles.panel">
                    <Content :tab="tab" />
                </Dockable.Panel>
            </Dockable.Panels>
            <Dockable.DropIndicator>
                <template #render="{ props, state }">
                    <div v-bind="props" :class="styles.dropIndicator(state)" />
                </template>
            </Dockable.DropIndicator>
        </Dockable.Root>
        <Toaster :toasts="toasts" :dismiss="dismiss" />
    </div>
</template>
