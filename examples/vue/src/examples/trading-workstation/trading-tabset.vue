<script setup lang="ts">
import {
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-vue";
import {
    ArrowDownToLine,
    Maximize2,
    Minimize2,
    SquareArrowOutUpRight,
} from "@lucide/vue";
import { computed } from "vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import { TABSET_NAMES } from "./tabs";
import TradingTab from "./trading-tab.vue";

// The desk's tabsets. Each one can pop its selected tab out into a window and be maximized; every
// tab can be dragged to another tabset, an edge or the border.
const props = defineProps<{ node: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
// maximizing changes no prop of this component: the ref follows the model
const maximized = useModelState(
    () => model.is("tabset-maximized", { tabsetId: props.node.id }),
    { model },
);
// a new tabset node (another selected tab) recomputes it
const name = computed(
    () =>
        model.get("selected-tab-by", { tabsetId: props.node.id })?.label ?? "",
);
</script>

<template>
    <Dockable.TabSet :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList
                :aria-label="TABSET_NAMES[node.id] ?? 'Panels'"
                :class="styles.tabList"
            >
                <template #default="{ tab }">
                    <TradingTab :tab="tab" />
                </template>
            </Dockable.TabList>
            <div :class="styles.tabsetButtons">
                <!-- pops the selected tab out, or docks it back from a window -->
                <Dockable.PopoutTrigger :class="styles.iconButton">
                    <template #render="{ props: trigger, state, children }">
                        <button
                            v-bind="trigger"
                            :aria-label="
                                state.mode === 'dock'
                                    ? `Dock ${name} back`
                                    : `Pop out ${name}`
                            "
                        >
                            <component :is="children" />
                        </button>
                    </template>
                    <SquareArrowOutUpRight
                        aria-hidden="true"
                        :class="styles.popoutIcon"
                    />
                    <ArrowDownToLine aria-hidden="true" :class="styles.dockIcon" />
                </Dockable.PopoutTrigger>
                <button
                    type="button"
                    :aria-label="maximized ? 'Restore' : 'Maximize'"
                    :aria-pressed="maximized"
                    :class="styles.iconButton"
                    @click="
                        model.run('tabset.maximize', {
                            tabsetId: node.id,
                            value: !maximized,
                        })
                    "
                >
                    <Minimize2
                        v-if="maximized"
                        aria-hidden="true"
                        :class="styles.buttonIcon"
                    />
                    <Maximize2 v-else aria-hidden="true" :class="styles.buttonIcon" />
                </button>
            </div>
        </div>
        <Dockable.TabSetContent />
    </Dockable.TabSet>
</template>
