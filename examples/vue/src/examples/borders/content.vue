<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import LogPanel from "../_kit/log-panel.vue";
import PanelBody from "../_kit/panel-body.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();

const FILES = ["src/app.ts", "src/store.ts", "src/theme.css", "README.md"];
</script>

<template>
    <PanelBody v-if="tab.component === 'explorer'" title="Explorer">
        <ul :class="styles.files">
            <li v-for="file in FILES" :key="file" :class="styles.file">
                {{ file }}
            </li>
        </ul>
    </PanelBody>
    <PanelBody v-else-if="tab.component === 'search'" title="Search">
        <input
            aria-label="Search files"
            placeholder="Search"
            :class="styles.searchInput"
        />
    </PanelBody>
    <LogPanel v-else-if="tab.component === 'terminal'" />
    <PanelBody v-else-if="tab.component === 'outline'" title="Outline">
        <p :class="styles.outline">createApp · render · mount</p>
    </PanelBody>
    <pre v-else :class="styles.source">{{ tab.data.source }}</pre>
</template>
