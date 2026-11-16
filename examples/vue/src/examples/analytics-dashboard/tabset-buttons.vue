<script setup lang="ts">
import {
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-vue";
import { ExternalLink, Maximize2, Minimize2, PanelTopClose } from "@lucide/vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

// The tabset's header buttons: maximize, and pop out (or dock back when already popped out).
// They read the model outside a Dockable part: `useModelState` follows it (maximizing changes
// the layout, not this tabset's node, so the props alone would not re-render them).
const props = defineProps<{ tabset: TabsetNode<Types> }>();
const { model } = useDockable<Types>();
const selected = useModelState<Types, string | undefined>(
    (_, model) =>
        model.get("selected-tab-by", { tabsetId: props.tabset.id })?.label,
);
const inPopout = useModelState<Types, boolean>((_, model) =>
    model.is("node-in-window", { nodeId: props.tabset.id }),
);
const maximized = useModelState<Types, boolean>((_, model) =>
    model.is("tabset-maximized", { tabsetId: props.tabset.id }),
);

function toggleMaximized() {
    model.run("tabset.maximize", {
        tabsetId: props.tabset.id,
        value: !maximized.value,
    });
}
</script>

<template>
    <!-- one trigger both ways: it pops the selected tab out, and in the window docks it back -->
    <Dockable.PopoutTrigger v-if="selected !== undefined" :class="styles.button">
        <template #render="{ props: trigger, state }">
            <button
                v-if="state.mode === 'dock'"
                v-bind="trigger"
                :aria-label="`Dock ${selected} back`"
                data-testid="dock-back"
            >
                <PanelTopClose aria-hidden="true" :class="styles.dockBackIcon" />
            </button>
            <button
                v-else
                v-bind="trigger"
                :aria-label="`Pop out ${selected}`"
                data-testid="popout"
            >
                <ExternalLink aria-hidden="true" :class="styles.buttonIcon" />
            </button>
        </template>
    </Dockable.PopoutTrigger>
    <button
        v-if="!inPopout"
        type="button"
        :aria-label="maximized ? 'Restore' : 'Maximize'"
        :aria-pressed="maximized"
        data-testid="maximize"
        :class="styles.button"
        @click="toggleMaximized"
    >
        <Minimize2 v-if="maximized" aria-hidden="true" :class="styles.buttonIcon" />
        <Maximize2 v-else aria-hidden="true" :class="styles.buttonIcon" />
    </button>
</template>
