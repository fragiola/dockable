<script setup lang="ts">
import * as styles from "./styles";

defineProps<{
    code: string;
    message: string;
    path: string | undefined;
    issues: readonly { path: string; message: string }[];
}>();
</script>

<template>
    <div role="alert" :class="styles.error">
        <p>
            <span :class="styles.errorCode">{{ code }}</span>: {{ message
            }}<template v-if="path">
                at <code :class="styles.code">{{ path }}</code>
            </template>
        </p>
        <ul v-if="issues.length > 1" :class="styles.errorIssues">
            <li v-for="issue in issues" :key="`${issue.path} ${issue.message}`">
                <code :class="styles.code">{{ issue.path }}</code>
                {{ issue.message }}
            </li>
        </ul>
    </div>
</template>
