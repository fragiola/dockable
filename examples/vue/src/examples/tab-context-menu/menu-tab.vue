<script setup lang="ts">
import {
    type BatchEntry,
    type TabOf,
    useDockable,
} from "@fragiola/dockable-vue";
import { shallowRef } from "vue";
import { ContextMenu } from "#/components/ui/context-menu";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

// A tab with its menu. The tab IS the menu's trigger: `as-child` puts ContextMenu.Trigger's
// behaviour (right-click, long press) on the Dockable.Tab's element.
const props = defineProps<{ tab: TabOf<Types> }>();
const { model } = useDockable<Types>();

/**
 * What the menu offers, asked without applying anything (`model.can` answers through the
 * middleware). The tab does not re-render when another tab changes: ask again when the menu opens.
 */
function menuState() {
    const tab = props.tab;
    // a tab lives in a tabset or a border; maximize is a tabset's
    const parent = model.get("node-parent-by", { nodeId: tab.id });
    const tabset = parent?.type === "tabset" ? parent : undefined;
    const siblings = parent && parent.type !== "row" ? parent.children : [];
    const right = siblings.slice(
        siblings.findIndex((t) => t.id === tab.id) + 1,
    );
    const closable = (tabs: readonly TabOf<Types>[]) =>
        tabs.filter((t) => model.can("tab.close", { tabId: t.id }));
    const pinned = tab.pinned === true;
    const maximized =
        tabset !== undefined &&
        model.is("tabset-maximized", { tabsetId: tabset.id });
    return {
        tabset,
        others: closable(siblings.filter((t) => t.id !== tab.id)),
        toTheRight: closable(right),
        pinned,
        maximized,
        canClose: model.can("tab.close", { tabId: tab.id }),
        // refused for a tab in a border (only a tabset has a pinned run)
        canPin: model.can("tab.pin", { tabId: tab.id, value: !pinned }),
        canMaximize:
            tabset !== undefined &&
            model.can("tabset.maximize", {
                tabsetId: tabset.id,
                value: !maximized,
            }),
    };
}

// several closes are one command (one change event, one undo step): all apply or none
function closeAll(tabs: readonly TabOf<Types>[]) {
    model.run("batch", {
        commands: tabs.map(
            (t): BatchEntry<Types> => ({
                command: "tab.close",
                payload: { tabId: t.id },
            }),
        ),
    });
}

const state = shallowRef(menuState());
function onOpen(open: boolean) {
    if (open) state.value = menuState();
}

function toggleMaximized() {
    const { tabset, maximized } = state.value;
    if (tabset) {
        model.run("tabset.maximize", {
            tabsetId: tabset.id,
            value: !maximized,
        });
    }
}
</script>

<template>
    <ContextMenu.Root @update:open="onOpen">
        <ContextMenu.Trigger as-child>
            <Dockable.Tab :node="tab" :class="styles.tab">
                <span :class="styles.tabName">{{ tab.label }}</span>
            </Dockable.Tab>
        </ContextMenu.Trigger>
        <ContextMenu.Content>
            <ContextMenu.Item
                :disabled="!state.canClose"
                @select="model.run('tab.close', { tabId: tab.id })"
            >
                Close
            </ContextMenu.Item>
            <ContextMenu.Item
                :disabled="state.others.length === 0"
                @select="closeAll(state.others)"
            >
                Close others
            </ContextMenu.Item>
            <ContextMenu.Item
                :disabled="state.toTheRight.length === 0"
                @select="closeAll(state.toTheRight)"
            >
                Close to the right
            </ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item
                :disabled="!state.canPin"
                @select="
                    model.run('tab.pin', {
                        tabId: tab.id,
                        value: !state.pinned,
                    })
                "
            >
                {{ state.pinned ? "Unpin" : "Pin" }}
            </ContextMenu.Item>
            <ContextMenu.Item
                :disabled="!state.canMaximize"
                @select="toggleMaximized"
            >
                {{ state.maximized ? "Restore tabset" : "Maximize tabset" }}
            </ContextMenu.Item>
        </ContextMenu.Content>
    </ContextMenu.Root>
</template>
