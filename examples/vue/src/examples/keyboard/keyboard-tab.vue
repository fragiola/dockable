<script setup lang="ts">
import {
    type TabOf,
    toAriaKeyShortcuts,
    useDockable,
    useModelState,
} from "@fragiola/dockable-vue";
import { computed } from "vue";
import { Tooltip } from "#/components/ui/tooltip";
import { Dockable, keys, type Types } from "./dockable";
import * as styles from "./styles";

/**
 * Each tab is a Tooltip trigger. `as-child` puts Tooltip.Trigger's props (hover and focus
 * handlers, `aria-describedby`, the ref) on the tab, so the tooltip opens when the tab gets
 * keyboard focus too. It lists the tab's `aria-keyshortcuts`: the package advertises the same
 * bindings it handles, so what the tooltip reads is what the keyboard does.
 */
const props = defineProps<{ tab: TabOf<Types> }>();
const { model } = useDockable<Types>();
// the same two bindings `Dockable.Tab` puts in its aria-keyshortcuts; the model says whether the
// tab may close (a dry run of `tab.close`), asked again whenever the model changes
const closeable = useModelState<Types, boolean>(() =>
    model.can("tab.close", { tabId: props.tab.id }),
);
const shortcuts = computed(() =>
    [
        { name: "Enter or leave the content", spec: keys.focusTabToggle },
        { name: "Close", spec: closeable.value ? keys.closeTab : undefined },
    ].filter((item) => item.spec !== undefined),
);
</script>

<template>
    <Tooltip.Root>
        <Tooltip.Trigger as-child>
            <Dockable.Tab :node="tab" :class="styles.tab">
                <span :class="styles.tabName">{{ tab.label }}</span>
            </Dockable.Tab>
        </Tooltip.Trigger>
        <Tooltip.Content>
            <div data-testid="tab-shortcuts" :class="styles.shortcuts">
                <div
                    v-for="item in shortcuts"
                    :key="item.name"
                    :class="styles.shortcut"
                >
                    <span>{{ item.name }}</span>
                    <code :class="styles.shortcutKeys">
                        {{ toAriaKeyShortcuts(item.spec) }}
                    </code>
                </div>
            </div>
        </Tooltip.Content>
    </Tooltip.Root>
</template>
