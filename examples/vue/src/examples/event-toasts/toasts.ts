import { onUnmounted, shallowRef } from "vue";
import type * as styles from "./styles";

// A small toast stack, written for this example (no library): what the layout's events turn into.
// Toasts are announced politely (`aria-live`, in toaster.vue), close themselves after a few
// seconds, and can carry one action (Undo).

export interface Toast {
    id: number;
    tone: styles.ToastTone;
    title: string;
    detail?: string;
    action?: { label: string; run: () => void };
}

const TIMEOUT = 5000;

/** The toasts on screen, a function to show one, and one to dismiss one. */
export function useToasts() {
    const toasts = shallowRef<Toast[]>([]);
    let next = 0;
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const dismiss = (id: number) => {
        clearTimeout(timers.get(id));
        timers.delete(id);
        toasts.value = toasts.value.filter((toast) => toast.id !== id);
    };
    const show = (toast: Omit<Toast, "id">) => {
        const id = next++;
        // the newest on top, at most four
        toasts.value = [{ ...toast, id }, ...toasts.value].slice(0, 4);
        timers.set(
            id,
            setTimeout(() => dismiss(id), TIMEOUT),
        );
    };
    onUnmounted(() => {
        for (const timer of timers.values()) clearTimeout(timer);
    });
    return { toasts, show, dismiss };
}
