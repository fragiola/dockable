<script setup lang="ts">
import {
    type Model,
    type TabOf,
    type TabsetNode,
    useDockable,
} from "@fragiola/dockable-vue";
import { X } from "@lucide/vue";
import { computed } from "vue";
import { ContextMenu } from "#/components/ui/context-menu";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import TabIcon from "./TabIcon.vue";
import { editorData } from "./workspace";

// A file tab with an icon, a dirty dot and a close button, and a context menu.

/** Whether a tab may be closed at all (its `closable`, else the layout default). */
function closable(model: Model<Types>, tab: TabOf<Types>) {
    return model.get("tab-settings-by", { tabId: tab.id })?.closable === true;
}

function closeAll(model: Model<Types>, tabs: readonly TabOf<Types>[]) {
    for (const tab of tabs) {
        if (closable(model, tab)) {
            // one command per tab: the workbench's middleware can still stop the dirty ones
            model.run("tab.close", { tabId: tab.id });
        }
    }
}

const props = defineProps<{ tab: TabOf<Types>; tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
const siblings = computed(() => props.tabset.children);
const index = computed(() =>
    siblings.value.findIndex((other) => other.id === props.tab.id),
);
const dirty = computed(() => editorData(props.tab)?.dirty === true);
const canClose = computed(() => closable(model, props.tab));
const close = () => model.run("tab.close", { tabId: props.tab.id });
const split = (location: "end" | "bottom") =>
    model.run("tab.move", {
        tabId: props.tab.id,
        to: props.tabset.id,
        location,
    });
</script>

<template>
    <ContextMenu.Root>
        <!-- `as-child` makes the context menu trigger the tab itself, with the tab's props -->
        <ContextMenu.Trigger as-child>
            <Dockable.Tab
                :node="tab"
                :data-dirty="dirty ? '' : undefined"
                :class="styles.tab"
            >
                <TabIcon :tab="tab" />
                <span :class="styles.tabName">{{ tab.label }}</span>
                <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard;
                     the press must not activate the tabset, and a click on the tab would select it -->
                <button
                    v-if="canClose"
                    type="button"
                    tabindex="-1"
                    :aria-label="`Close ${tab.label}`"
                    data-testid="close-tab"
                    :class="styles.closeButton"
                    @pointerdown.stop
                    @click.stop="close"
                >
                    <!-- VS Code's convention: a dot while modified, the cross on hover -->
                    <span
                        v-if="dirty"
                        data-testid="dirty-dot"
                        :class="styles.dirtyDot"
                    />
                    <X aria-hidden="true" :class="styles.closeIcon(dirty)" />
                </button>
            </Dockable.Tab>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
            <ContextMenu.Item :disabled="!canClose" @select="close">
                Close
            </ContextMenu.Item>
            <ContextMenu.Item
                :disabled="siblings.length < 2"
                @select="
                    closeAll(
                        model,
                        siblings.filter((other) => other.id !== tab.id),
                    )
                "
            >
                Close others
            </ContextMenu.Item>
            <ContextMenu.Item
                :disabled="index === siblings.length - 1"
                @select="closeAll(model, siblings.slice(index + 1))"
            >
                Close to the right
            </ContextMenu.Item>
            <ContextMenu.Item
                @select="
                    closeAll(
                        model,
                        siblings.filter(
                            (other) => editorData(other)?.dirty !== true,
                        ),
                    )
                "
            >
                Close saved
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <!-- moving a tab to its own tabset's edge splits it off into a new tabset -->
            <ContextMenu.Item
                :disabled="siblings.length < 2"
                @select="split('end')"
            >
                Split right
            </ContextMenu.Item>
            <ContextMenu.Item
                :disabled="siblings.length < 2"
                @select="split('bottom')"
            >
                Split down
            </ContextMenu.Item>
        </ContextMenu.Content>
    </ContextMenu.Root>
</template>
