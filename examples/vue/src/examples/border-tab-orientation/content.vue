<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import ChartPanel from "../_kit/chart-panel.vue";
import LogPanel from "../_kit/log-panel.vue";
import PanelBody from "../_kit/panel-body.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <PanelBody v-if="tab.component === 'outline'" :title="tab.label">
        <ol :class="styles.list">
            <li v-for="heading in tab.data.headings" :key="heading">
                {{ heading }}
            </li>
        </ol>
    </PanelBody>
    <PanelBody v-else-if="tab.component === 'search'" :title="tab.label">
        <p :class="styles.query">{{ `“${tab.data.query}”` }}</p>
        <ul :class="styles.list">
            <li v-for="result in tab.data.results" :key="result">
                {{ result }}
            </li>
        </ul>
    </PanelBody>
    <PanelBody v-else-if="tab.component === 'bookmarks'" :title="tab.label">
        <ul :class="styles.list">
            <li v-for="page in tab.data.pages" :key="page">{{ page }}</li>
        </ul>
    </PanelBody>
    <PanelBody v-else-if="tab.component === 'notes'" :title="tab.label">
        <p :class="styles.text">{{ tab.data.text }}</p>
    </PanelBody>
    <LogPanel v-else-if="tab.component === 'alerts'" />
    <PanelBody v-else :title="tab.label">
        <p :class="styles.text">{{ tab.data.summary }}</p>
        <ChartPanel
            :kind="tab.data.kind"
            :seed="21"
            :class="styles.documentChart"
        />
    </PanelBody>
</template>
