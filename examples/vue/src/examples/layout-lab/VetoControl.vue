<script setup lang="ts">
import type { CommandInfo } from "@fragiola/dockable-vue";
import { computed } from "vue";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import type { Veto } from "./commands";
import * as styles from "./styles";

/** The switch and the command it vetoes, chosen from `model.get("commands")`. */
const props = defineProps<{
    veto: Veto;
    commands: readonly CommandInfo[];
}>();
const emit = defineEmits<{ change: [veto: Veto] }>();
const items = computed(() =>
    props.commands.map((info) => ({ value: info.name, label: info.name })),
);

function choose(value: unknown) {
    // the chosen item is one of the model's commands
    const command = props.commands.find((info) => info.name === value)?.name;
    if (command) emit("change", { ...props.veto, command });
}
</script>

<template>
    <div :class="styles.veto">
        <div :class="styles.vetoSwitch">
            <Switch.Root
                :model-value="veto.enabled"
                aria-label="Veto"
                @update:model-value="
                    (enabled: boolean) => emit('change', { ...veto, enabled })
                "
            >
                <Switch.Thumb />
            </Switch.Root>
            <span aria-hidden="true">Veto</span>
        </div>
        <Select.Root
            :items="items"
            :model-value="veto.command"
            @update:model-value="choose"
        >
            <Select.Trigger
                aria-label="Command to veto"
                :class="styles.vetoTrigger"
            >
                <Select.Value />
            </Select.Trigger>
            <Select.Content>
                <Select.Item
                    v-for="item in items"
                    :key="item.value"
                    :value="item.value"
                    :class="styles.vetoItem"
                >
                    {{ item.label }}
                </Select.Item>
            </Select.Content>
        </Select.Root>
    </div>
</template>
