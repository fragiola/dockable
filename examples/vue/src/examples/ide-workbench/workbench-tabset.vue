<script setup lang="ts">
import {
    type TabsetNode,
    useDockable,
    useModelState,
    useTabOverflow,
} from "@fragiola/dockable-vue";
import { Maximize2, Minimize2 } from "@lucide/vue";
import { Select } from "#/components/ui/select";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import WorkbenchTab from "./workbench-tab.vue";

// The workbench's tabset: file tabs (workbench-tab.vue), a Select listing the tabs that no longer
// fit (tab overflow hides them; the selected one always stays), and a maximize button.
// Everything is a consumer choice made of Dockable primitives, commands and data-*.

const props = defineProps<{ node: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
const { hiddenTabs } = useTabOverflow(() => props.node);
// maximizing changes no prop of this component: the ref follows the model
const maximized = useModelState(
    () => model.is("tabset-maximized", { tabsetId: props.node.id }),
    { model },
);

const select = (id: unknown) => {
    if (typeof id === "string") {
        model.run("tab.select", { tabId: id });
    }
};
</script>

<template>
    <Dockable.TabSet :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList
                :aria-label="node.id === 'panel' ? 'Panel' : 'Editors'"
                :class="styles.tabList"
            >
                <template #default="{ tab }">
                    <WorkbenchTab :tab="tab" :tabset="node" />
                </template>
            </Dockable.TabList>
            <div :class="styles.tabsetActions">
                <!-- the tabs that do not fit, one click away (rendered only while there are some) -->
                <Select.Root :model-value="null" @update:model-value="select">
                    <Dockable.TabOverflowTrigger
                        :as="Select.Trigger"
                        :aria-label="`${hiddenTabs.length} more tabs`"
                        data-testid="overflow-select"
                        :class="styles.overflowTrigger"
                    >
                        {{ `+${hiddenTabs.length}` }}
                    </Dockable.TabOverflowTrigger>
                    <Select.Content>
                        <Select.Item
                            v-for="tab in hiddenTabs"
                            :key="tab.id"
                            :value="tab.id"
                        >
                            {{ tab.label }}
                        </Select.Item>
                    </Select.Content>
                </Select.Root>
                <button
                    type="button"
                    :aria-label="maximized ? 'Restore' : 'Maximize'"
                    :aria-pressed="maximized"
                    :class="styles.maximizeButton"
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
                        :class="styles.maximizeIcon"
                    />
                    <Maximize2
                        v-else
                        aria-hidden="true"
                        :class="styles.maximizeIcon"
                    />
                </button>
            </div>
        </div>
        <!-- the content area renders nothing of its own: the render slot adds the empty state -->
        <Dockable.TabSetContent>
            <template #render="{ props: contentProps }">
                <div v-bind="contentProps">
                    <p v-if="node.children.length === 0" :class="styles.emptyState">
                        Open a file from the explorer.
                    </p>
                </div>
            </template>
        </Dockable.TabSetContent>
    </Dockable.TabSet>
</template>
