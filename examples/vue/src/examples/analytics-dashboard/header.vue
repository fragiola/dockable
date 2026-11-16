<script setup lang="ts">
import type { Model } from "@fragiola/dockable-vue";
import { Plus, Redo2, Undo2 } from "@lucide/vue";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { Select } from "#/components/ui/select";
import type { UndoManager, UndoSnapshot } from "../_kit/undo";
import { type Filters, REGIONS, type Types, WIDGETS } from "./data";
import * as styles from "./styles";

// The header OUTSIDE the layout: shared filters (`v-model:filters`, provided to every widget by
// index.vue), the "Add widget" menu (a `tab.add` command on the model), and undo/redo (the
// UndoManager).

const REGION_ITEMS = [
    { value: "all", label: "All regions" },
    ...REGIONS.map((region) => ({ value: region, label: region })),
];
const RANGE_ITEMS = [
    { value: 3, label: "Last 3 months" },
    { value: 6, label: "Last 6 months" },
    { value: 12, label: "Last 12 months" },
];

const props = defineProps<{
    model: Model<Types>;
    undo: UndoManager<Types>;
    history: UndoSnapshot;
}>();
const filters = defineModel<Filters>("filters", { required: true });

function setRegion(region: unknown) {
    filters.value = { ...filters.value, region: region as Filters["region"] };
}

function setMonths(months: unknown) {
    filters.value = { ...filters.value, months: months as Filters["months"] };
}

/** Adds a widget to the active tabset (or the first one) and selects it. */
function addWidget(index: number) {
    const widget = WIDGETS[index];
    const target = props.model.get("default-tabset");
    if (!widget || !target) return;
    // no id: the model assigns a unique one
    props.model.run("tab.add", { ...widget.tab, to: target.id, select: true });
}
</script>

<template>
    <header :class="styles.header">
        <h1 :class="styles.title">Sales overview</h1>

        <Select.Root
            :items="REGION_ITEMS"
            :model-value="filters.region"
            @update:model-value="setRegion"
        >
            <Select.Trigger aria-label="Region" :class="styles.selectTrigger">
                <Select.Value />
            </Select.Trigger>
            <Select.Content>
                <Select.Item
                    v-for="item in REGION_ITEMS"
                    :key="item.value"
                    :value="item.value"
                >
                    {{ item.label }}
                </Select.Item>
            </Select.Content>
        </Select.Root>

        <Select.Root
            :items="RANGE_ITEMS"
            :model-value="filters.months"
            @update:model-value="setMonths"
        >
            <Select.Trigger
                aria-label="Date range"
                :class="styles.selectTrigger"
            >
                <Select.Value />
            </Select.Trigger>
            <Select.Content>
                <Select.Item
                    v-for="item in RANGE_ITEMS"
                    :key="item.value"
                    :value="item.value"
                >
                    {{ item.label }}
                </Select.Item>
            </Select.Content>
        </Select.Root>

        <div :class="styles.history">
            <button
                type="button"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                :disabled="!history.canUndo"
                :class="styles.undoButton"
                @click="undo.undo()"
            >
                <Undo2 aria-hidden="true" :class="styles.headerIcon" />
            </button>
            <button
                type="button"
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                :disabled="!history.canRedo"
                :class="styles.redoButton"
                @click="undo.redo()"
            >
                <Redo2 aria-hidden="true" :class="styles.headerIcon" />
            </button>
        </div>

        <DropdownMenu.Root>
            <DropdownMenu.Trigger :class="styles.addButton">
                <Plus aria-hidden="true" :class="styles.headerIcon" />
                Add widget
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
                <DropdownMenu.Item
                    v-for="(widget, index) in WIDGETS"
                    :key="widget.label"
                    @select="addWidget(index)"
                >
                    {{ widget.label }}
                </DropdownMenu.Item>
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </header>
</template>
