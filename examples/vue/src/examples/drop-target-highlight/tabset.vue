<script setup lang="ts">
import { type TabOf, type TabsetNode, useTabSet } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

/** A tabset that marks itself while it is a drop target: the part the drop would take, or a caret in its strip. */
const props = defineProps<{ node: TabsetNode<Types> }>();
// the same state the tabset's data-* come from: is a strip drop aimed here, and where?
const { state } = useTabSet(() => props.node);

/** Where the strip's insertion point is drawn for this tab: before it, after it (the last), or none. */
function caret(tab: TabOf<Types>) {
    const { dropIndex } = state.value;
    const tabs = props.node.children;
    const index = tabs.findIndex((t) => t.id === tab.id);
    const before = dropIndex === index;
    const after = dropIndex === tabs.length && index === tabs.length - 1;
    return { show: before || after, after };
}
</script>

<template>
    <Dockable.TabSet :node="node" :class="styles.tabset">
        <div :class="styles.strip">
            <Dockable.TabList aria-label="Tabs" :class="styles.tabList">
                <template #default="{ tab }">
                    <Dockable.Tab :node="tab" :class="styles.tab">
                        <span :class="styles.tabName">{{ tab.label }}</span>
                        <!-- the strip's insertion point, before (or after) this tab -->
                        <span
                            v-if="caret(tab).show"
                            aria-hidden="true"
                            :class="styles.dropCaret(caret(tab).after)"
                        />
                    </Dockable.Tab>
                </template>
            </Dockable.TabList>
        </div>
        <Dockable.TabSetContent />
        <span aria-hidden="true" :class="styles.dropHighlight" />
    </Dockable.TabSet>
</template>
