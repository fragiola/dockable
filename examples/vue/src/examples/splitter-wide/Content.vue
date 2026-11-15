<script setup lang="ts">
import type { TabOf } from "@fragiola/dockable-vue";
import KpiPanel from "../_kit/KpiPanel.vue";
import PanelBody from "../_kit/PanelBody.vue";
import type { Types } from "./dockable";
import * as styles from "./styles";

defineProps<{ tab: TabOf<Types> }>();
</script>

<template>
    <KpiPanel
        v-if="tab.component === 'stats'"
        :label="tab.data.caption"
        :seed="tab.data.seed"
    />
    <PanelBody v-else-if="tab.component === 'draft'" :title="tab.label">
        <p
            v-for="paragraph in tab.data.paragraphs"
            :key="paragraph"
            :class="styles.paragraph"
        >
            {{ paragraph }}
        </p>
    </PanelBody>
    <PanelBody v-else-if="tab.component === 'outline'" :title="tab.label">
        <ol :class="styles.outline">
            <li v-for="heading in tab.data.headings" :key="heading">
                {{ heading }}
            </li>
        </ol>
    </PanelBody>
    <PanelBody v-else :title="tab.label">
        <ul :class="styles.comments">
            <li v-for="comment in tab.data.comments" :key="comment.text">
                <span :class="styles.commentAuthor">{{ comment.author }}</span>
                {{ comment.text }}
            </li>
        </ul>
    </PanelBody>
</template>
