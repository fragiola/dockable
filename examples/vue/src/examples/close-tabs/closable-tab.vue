<script setup lang="ts">
import { type TabOf, useDockable, useModelState } from "@fragiola/dockable-vue";
import { Lock, X } from "@lucide/vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";

// A tab with its own close button, closed by a middle click too.
const props = defineProps<{ tab: TabOf<Types> }>();
const { model } = useDockable<Types>();
// whether `tab.close` would apply: the tab's `closable` (resolved against the layout
// defaults), not pinned, and no middleware veto. A dry run: nothing changes. `useModelState`
// asks again whenever the model changes.
const closeable = useModelState<Types, boolean>(() =>
    model.can("tab.close", { tabId: props.tab.id }),
);
const close = () => model.run("tab.close", { tabId: props.tab.id });

function onAuxclick(event: MouseEvent) {
    if (event.button === 1 && closeable.value) {
        event.preventDefault();
        close();
    }
}

function onClick(event: MouseEvent) {
    event.stopPropagation(); // a click on the tab would select it
    close();
}
</script>

<template>
    <Dockable.Tab :node="tab" :class="styles.tab" @auxclick="onAuxclick">
        <span :class="styles.tabName">{{ tab.label }}</span>
        <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard; the
             stopped pointerdown keeps the press from activating the tabset -->
        <button
            v-if="closeable"
            type="button"
            tabindex="-1"
            :aria-label="`Close ${tab.label}`"
            :class="styles.closeButton"
            @pointerdown.stop
            @click="onClick"
        >
            <X aria-hidden="true" :class="styles.closeIcon" />
        </button>
        <Lock v-else aria-hidden="true" :class="styles.lockIcon" />
    </Dockable.Tab>
</template>
