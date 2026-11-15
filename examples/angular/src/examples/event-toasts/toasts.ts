import { Component, input, signal } from "@angular/core";
import { LucideX } from "@lucide/angular";
import * as styles from "./styles";

// A small toast stack, written for this example (no library): what the layout's events turn into.
// Toasts are announced politely (`aria-live`), close themselves after a few seconds, and can carry
// one action (Undo).

export interface Toast {
    id: number;
    tone: styles.ToastTone;
    title: string;
    detail?: string;
    action?: { label: string; run: () => void };
}

const TIMEOUT = 5000;

/** The toasts on screen, a function to show one, and one to dismiss one. */
export class Toasts {
    readonly toasts = signal<Toast[]>([]);
    private next = 0;
    private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

    dismiss = (id: number) => {
        clearTimeout(this.timers.get(id));
        this.timers.delete(id);
        this.toasts.update((current) =>
            current.filter((toast) => toast.id !== id),
        );
    };

    show = (toast: Omit<Toast, "id">) => {
        const id = this.next++;
        // the newest on top, at most four
        this.toasts.update((current) =>
            [{ ...toast, id }, ...current].slice(0, 4),
        );
        this.timers.set(
            id,
            setTimeout(() => this.dismiss(id), TIMEOUT),
        );
    };

    /** Stops the pending timers (when the example goes away). */
    destroy() {
        for (const timer of this.timers.values()) clearTimeout(timer);
        this.timers.clear();
    }
}

@Component({
    selector: "example-toaster",
    imports: [LucideX],
    host: { class: "contents" },
    template: `
        <ol aria-live="polite" aria-label="Notifications" [class]="styles.toaster">
            @for (toast of store().toasts(); track toast.id) {
                <li [class]="styles.toast(toast.tone)">
                    <div [class]="styles.toastText">
                        <p [class]="styles.toastTitle">{{ toast.title }}</p>
                        @if (toast.detail) {
                            <p [class]="styles.toastDetail">{{ toast.detail }}</p>
                        }
                    </div>
                    @if (toast.action; as action) {
                        <button type="button" [class]="styles.toastAction" (click)="run(toast)">
                            {{ action.label }}
                        </button>
                    }
                    <button
                        type="button"
                        aria-label="Dismiss"
                        [class]="styles.toastDismiss"
                        (click)="store().dismiss(toast.id)"
                    >
                        <svg lucideX aria-hidden="true" [class]="styles.icon"></svg>
                    </button>
                </li>
            }
        </ol>
    `,
})
export class Toaster {
    readonly store = input.required<Toasts>();
    protected readonly styles = styles;

    protected run(toast: Toast) {
        toast.action?.run();
        this.store().dismiss(toast.id);
    }
}
