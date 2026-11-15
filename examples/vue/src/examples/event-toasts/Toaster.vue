<script setup lang="ts">
import { X } from "@lucide/vue";
import * as styles from "./styles";
import type { Toast } from "./toasts";

defineProps<{ toasts: Toast[]; dismiss: (id: number) => void }>();
</script>

<template>
    <ol aria-live="polite" aria-label="Notifications" :class="styles.toaster">
        <li
            v-for="toast in toasts"
            :key="toast.id"
            :class="styles.toast(toast.tone)"
        >
            <div :class="styles.toastText">
                <p :class="styles.toastTitle">{{ toast.title }}</p>
                <p v-if="toast.detail" :class="styles.toastDetail">
                    {{ toast.detail }}
                </p>
            </div>
            <button
                v-if="toast.action"
                type="button"
                :class="styles.toastAction"
                @click="
                    toast.action?.run();
                    dismiss(toast.id);
                "
            >
                {{ toast.action.label }}
            </button>
            <button
                type="button"
                aria-label="Dismiss"
                :class="styles.toastDismiss"
                @click="dismiss(toast.id)"
            >
                <X aria-hidden="true" :class="styles.icon" />
            </button>
        </li>
    </ol>
</template>
