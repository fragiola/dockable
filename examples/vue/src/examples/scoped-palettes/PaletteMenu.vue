<script setup lang="ts">
import { type TabsetNode, useDockable } from "@fragiola/dockable-vue";
import { Palette } from "@lucide/vue";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import type { Types } from "./dockable";
import { PALETTES, paletteOf } from "./palettes";
import * as styles from "./styles";

/** The tabset's palette picker: a Fragiola DropdownMenu with a radio group. */
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();

function pick(palette: string) {
    model.run("tabset.configure", {
        tabsetId: props.tabset.id,
        data: { ...props.tabset.data, palette },
    });
}
</script>

<template>
    <DropdownMenu.Root>
        <DropdownMenu.Trigger aria-label="Tabset palette" :class="styles.button">
            <Palette aria-hidden="true" :class="styles.buttonIcon" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
            <DropdownMenu.Group>
                <DropdownMenu.Label>Palette</DropdownMenu.Label>
                <DropdownMenu.RadioGroup
                    :model-value="paletteOf(tabset)"
                    @update:model-value="pick"
                >
                    <DropdownMenu.RadioItem
                        v-for="palette in PALETTES"
                        :key="palette.value"
                        :value="palette.value"
                    >
                        <span
                            aria-hidden="true"
                            :class="styles.swatch(palette.value)"
                        />
                        {{ palette.title }}
                    </DropdownMenu.RadioItem>
                </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
        </DropdownMenu.Content>
    </DropdownMenu.Root>
</template>
