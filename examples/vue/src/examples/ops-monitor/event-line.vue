<script setup lang="ts">
import type { OpsEvent } from "./simulation";
import * as styles from "./styles";

defineProps<{ event: OpsEvent }>();
</script>

<template>
    <li :class="styles.eventLine">
        <span :class="styles.eventTime">{{ event.time }}</span>
        <span :class="styles.eventLevel(event.level)">{{ event.level }}</span>
        <span>{{ event.text }}</span>
    </li>
</template>
