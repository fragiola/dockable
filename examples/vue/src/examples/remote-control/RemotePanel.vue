<script setup lang="ts">
import {
    type CommandResult,
    MAIN_LAYOUT,
    type Model,
    type TabsetNode,
    useModelState,
} from "@fragiola/dockable-vue";
import { ref } from "vue";
import Action from "./Action.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

/**
 * The panel beside the layout: it reads a new snapshot on every commit, and the dry runs below
 * with it. A component of its own, so a commit re-renders it, not the layout.
 */
const props = defineProps<{ model: Model<Types> }>();
const last = ref("No command yet");
const snapshot = useModelState(
    (_state, model) => {
        const tabset = model.get("default-tabset");
        return {
            tabsets: model.get("tabsets"),
            tabset,
            tab: tabset
                ? model.get("selected-tab-by", { tabsetId: tabset.id })
                : undefined,
            maximized:
                tabset !== undefined &&
                model.is("tabset-maximized", { tabsetId: tabset.id }),
        };
    },
    { model: props.model },
);

/** Runs a command and reports its result in the status line. */
function report(command: string, result: CommandResult<unknown>) {
    last.value = result.ok
        ? `${command}: done`
        : `${command}: ${result.error.code} (${result.error.message})`;
}

/** The tabsets' names in the panel: the two of the JSON, then a number for each new one. */
function tabsetName(tabset: TabsetNode<Types>, index: number) {
    if (tabset.id === "left") return "Left";
    if (tabset.id === "right") return "Right";
    return `Tabset ${index + 1}`;
}
</script>

<template>
    <aside aria-label="Remote control" :class="styles.remote">
        <section :class="styles.section">
            <h2 :class="styles.heading">Layout</h2>
            <div
                v-for="(node, index) in snapshot.tabsets"
                :key="node.id"
                :class="styles.tree"
            >
                <button
                    type="button"
                    :aria-pressed="node.id === snapshot.tabset?.id"
                    :class="styles.treeTabset"
                    @click="
                        report(
                            'tabset.activate',
                            model.run('tabset.activate', { tabsetId: node.id }),
                        )
                    "
                >
                    {{ tabsetName(node, index) }}
                </button>
                <button
                    v-for="child in node.children"
                    :key="child.id"
                    type="button"
                    :aria-pressed="
                        child.id ===
                        model.get('selected-tab-by', { tabsetId: node.id })?.id
                    "
                    :class="styles.treeTab"
                    @click="
                        report(
                            'tab.select',
                            model.run('tab.select', { tabId: child.id }),
                        )
                    "
                >
                    {{ child.label }}
                </button>
            </div>
        </section>
        <template v-if="snapshot.tab && snapshot.tabset">
            <section :class="styles.section">
                <h2 :class="styles.heading">{{ `Tab: ${snapshot.tab.label}` }}</h2>
                <Action
                    v-for="other in snapshot.tabsets.filter(
                        (other) => other.id !== snapshot.tabset?.id,
                    )"
                    :key="other.id"
                    :dry-run="
                        model.check('tab.move', {
                            tabId: snapshot.tab.id,
                            to: other.id,
                        })
                    "
                    @click="
                        report(
                            'tab.move',
                            model.run('tab.move', {
                                tabId: snapshot.tab.id,
                                to: other.id,
                            }),
                        )
                    "
                >
                    {{ `Move to ${tabsetName(other, snapshot.tabsets.indexOf(other))}` }}
                </Action>
                <!-- `to` a layout id with an edge docks beside the whole layout -->
                <Action
                    :dry-run="
                        model.check('tab.move', {
                            tabId: snapshot.tab.id,
                            to: MAIN_LAYOUT,
                            location: 'bottom',
                        })
                    "
                    @click="
                        report(
                            'tab.move',
                            model.run('tab.move', {
                                tabId: snapshot.tab.id,
                                to: MAIN_LAYOUT,
                                location: 'bottom',
                            }),
                        )
                    "
                >
                    Dock at the bottom
                </Action>
                <Action
                    :dry-run="model.check('tab.close', { tabId: snapshot.tab.id })"
                    @click="
                        report(
                            'tab.close',
                            model.run('tab.close', { tabId: snapshot.tab.id }),
                        )
                    "
                >
                    Close tab
                </Action>
            </section>
            <section :class="styles.section">
                <h2 :class="styles.heading">
                    {{
                        `Tabset: ${tabsetName(snapshot.tabset, snapshot.tabsets.indexOf(snapshot.tabset))}`
                    }}
                </h2>
                <Action
                    :dry-run="
                        model.check('tabset.maximize', {
                            tabsetId: snapshot.tabset.id,
                            value: !snapshot.maximized,
                        })
                    "
                    @click="
                        report(
                            'tabset.maximize',
                            model.run('tabset.maximize', {
                                tabsetId: snapshot.tabset.id,
                                value: !snapshot.maximized,
                            }),
                        )
                    "
                >
                    {{ snapshot.maximized ? "Restore" : "Maximize" }}
                </Action>
                <!-- an edge of a tabset splits it: the new tab gets a tabset of its own -->
                <Action
                    :dry-run="
                        model.check('tab.add', {
                            component: 'table',
                            label: 'New table',
                            to: snapshot.tabset.id,
                            location: 'end',
                        })
                    "
                    @click="
                        report(
                            'tab.add',
                            model.run('tab.add', {
                                component: 'table',
                                label: `Table ${model.get('all-tabs').length + 1}`,
                                to: snapshot.tabset.id,
                                location: 'end',
                                select: true,
                            }),
                        )
                    "
                >
                    Add a tab beside
                </Action>
                <Action
                    :dry-run="
                        model.check('tabset.close', {
                            tabsetId: snapshot.tabset.id,
                        })
                    "
                    @click="
                        report(
                            'tabset.close',
                            model.run('tabset.close', {
                                tabsetId: snapshot.tabset.id,
                            }),
                        )
                    "
                >
                    Close tabset
                </Action>
            </section>
        </template>
        <p role="status" data-testid="last" :class="styles.status">{{ last }}</p>
    </aside>
</template>
