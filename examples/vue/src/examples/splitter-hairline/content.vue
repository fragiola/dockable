<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import LogPanel from "../_kit/log-panel.vue";
import PanelBody from "../_kit/panel-body.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <PanelBody v-if="tab.component === 'files'" :title="tab.label">
        <ul :class="styles.fileList">
            <li v-for="file in tab.data.files" :key="file">{{ file }}</li>
        </ul>
    </PanelBody>
    <pre v-else-if="tab.component === 'source'" :class="styles.code">{{ tab.data.code }}</pre>
    <LogPanel v-else />
</template>
