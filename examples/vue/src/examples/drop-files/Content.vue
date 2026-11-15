<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import CsvChart from "./CsvChart.vue";
import CsvTable from "./CsvTable.vue";
import type { Types } from "./dockable";
import ErrorNote from "./ErrorNote.vue";
import FileInfo from "./FileInfo.vue";
import ImageOf from "./ImageOf.vue";
import * as styles from "./styles";
import Welcome from "./Welcome.vue";

defineProps<{
    tab: TabOf<Types>;
    /** a dropped image's File, by its tab id */
    images: ReadonlyMap<string, File>;
}>();
</script>

<template>
    <CsvTable v-if="tab.component === 'table'" :csv="tab.data.csv" />
    <CsvChart v-else-if="tab.component === 'chart'" :csv="tab.data.csv" />
    <ImageOf
        v-else-if="tab.component === 'image'"
        :file="images.get(tab.id)"
    />
    <FileInfo
        v-else-if="tab.component === 'info'"
        :type="tab.data.type"
        :size="tab.data.size"
    />
    <ErrorNote
        v-else-if="tab.component === 'error'"
        :message="tab.data.message"
    />
    <p v-else-if="tab.component === 'pending'" :class="styles.note">
        Reading the file…
    </p>
    <Welcome v-else />
</template>
