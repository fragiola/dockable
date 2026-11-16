<script setup lang="ts">
import { type TabsetNode, useDockable } from "@fragiola/dockable-vue";
import { Plus } from "@lucide/vue";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import type { Kind, Types } from "./dockable";
import { TEMPLATES } from "./factory";
import * as styles from "./styles";

// The "Add" menu of a tabset: a new tab of any kind, with its own data.
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();

const KINDS: { kind: Kind; title: string }[] = [
    { kind: "chart", title: "Chart" },
    { kind: "table", title: "Table" },
    { kind: "markdown", title: "Markdown" },
    { kind: "form", title: "Form" },
];

function add(kind: Kind) {
    model.run("tab.add", {
        ...TEMPLATES[kind],
        to: props.tabset.id,
        select: true, // select it: its content mounts now
    });
}
</script>

<template>
    <DropdownMenu.Root>
        <DropdownMenu.Trigger aria-label="Add a tab" :class="styles.iconButton">
            <Plus aria-hidden="true" :class="styles.iconButtonIcon" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
            <DropdownMenu.Item
                v-for="{ kind, title } in KINDS"
                :key="kind"
                @select="add(kind)"
            >
                {{ title }}
            </DropdownMenu.Item>
        </DropdownMenu.Content>
    </DropdownMenu.Root>
</template>
