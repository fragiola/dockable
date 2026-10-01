"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
export function useToasts() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const next = useRef(0);
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
    const dismiss = useCallback((id: number) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);
    const show = useCallback(
        (toast: Omit<Toast, "id">) => {
            const id = next.current++;
            // the newest on top, at most four
            setToasts((current) => [{ ...toast, id }, ...current].slice(0, 4));
            timers.current.set(
                id,
                setTimeout(() => dismiss(id), TIMEOUT),
            );
        },
        [dismiss],
    );
    useEffect(() => {
        const pending = timers.current;
        return () => {
            for (const timer of pending.values()) clearTimeout(timer);
        };
    }, []);
    return { toasts, show, dismiss };
}

export function Toaster({
    toasts,
    dismiss,
}: {
    toasts: Toast[];
    dismiss: (id: number) => void;
}) {
    return (
        <ol
            aria-live="polite"
            aria-label="Notifications"
            className={styles.toaster}
        >
            {toasts.map((toast) => (
                <li key={toast.id} className={styles.toast(toast.tone)}>
                    <div className={styles.toastText}>
                        <p className={styles.toastTitle}>{toast.title}</p>
                        {toast.detail ? (
                            <p className={styles.toastDetail}>{toast.detail}</p>
                        ) : null}
                    </div>
                    {toast.action ? (
                        <button
                            type="button"
                            className={styles.toastAction}
                            onClick={() => {
                                toast.action?.run();
                                dismiss(toast.id);
                            }}
                        >
                            {toast.action.label}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        aria-label="Dismiss"
                        className={styles.toastDismiss}
                        onClick={() => dismiss(toast.id)}
                    >
                        <X aria-hidden="true" className={styles.icon} />
                    </button>
                </li>
            ))}
        </ol>
    );
}
