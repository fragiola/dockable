<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import { computed } from "vue";
import { Dockable, type Types } from "./dockable";
import * as styles from "./styles";
import { ICONS } from "./tabs";

// A tab shows what its panel reported into its data: the positions tab the sign of the open P&L
// (`data-pnl`), the news tab its unread headlines (`data-unread` and a count).
const props = defineProps<{ tab: TabOf<Types> }>();
// `tab.data` narrows on `tab.component`: only these two carry a badge
const pnl = computed(() =>
    props.tab.component === "positions" ? props.tab.data.pnl : undefined,
);
const unread = computed(() =>
    props.tab.component === "news" ? (props.tab.data.unread ?? 0) : 0,
);
</script>

<template>
    <Dockable.Tab
        :node="tab"
        :data-pnl="pnl"
        :data-unread="unread > 0 ? '' : undefined"
        :class="styles.tab"
    >
        <component
            :is="ICONS[tab.component]"
            aria-hidden="true"
            :class="styles.tabIcon"
        />
        <span :class="styles.tabName">{{ tab.label }}</span>
        <span v-if="pnl" :class="styles.pnlBadge(pnl)">
            <span aria-hidden="true">{{ pnl === "up" ? "+" : "−" }}</span>
            <span :class="styles.srOnly">{{
                pnl === "up" ? "in profit" : "at a loss"
            }}</span>
        </span>
        <span
            v-if="unread > 0"
            data-testid="unread-count"
            :class="styles.unreadBadge"
            >{{ unread }}<span :class="styles.srOnly"> unread</span></span
        >
    </Dockable.Tab>
</template>
