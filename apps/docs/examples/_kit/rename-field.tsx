"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * An inline text field that edits a tab's name: Enter confirms, Escape cancels, leaving the
 * field confirms. An empty name is refused (the field stays open and is marked invalid; leaving
 * it cancels). The caller dispatches `Actions.renameTab` in `onCommit`.
 */
export function RenameField({
    name,
    onCommit,
    onCancel,
}: {
    name: string;
    onCommit: (name: string) => void;
    onCancel: () => void;
}) {
    const [value, setValue] = useState(name);
    const [invalid, setInvalid] = useState(false);
    // Enter closes the field, and the unmount may still blur it: finish once
    const done = useRef(false);

    const finish = (commit: boolean, input: HTMLInputElement) => {
        if (done.current) {
            return;
        }
        const trimmed = value.trim();
        if (commit && trimmed === "") {
            setInvalid(true);
            return;
        }
        done.current = true;
        // hand focus back to the tab the field is in (unless it already went elsewhere)
        if (input.ownerDocument.activeElement === input) {
            input.closest<HTMLElement>('[role="tab"]')?.focus();
        }
        if (commit && trimmed !== name) {
            onCommit(trimmed);
        } else {
            onCancel();
        }
    };

    return (
        <input
            // focus and select on mount, so typing replaces the name
            ref={(input) => {
                if (
                    input &&
                    !done.current &&
                    input !== input.ownerDocument.activeElement
                ) {
                    input.focus();
                    input.select();
                }
            }}
            aria-label="Tab name"
            aria-invalid={invalid || undefined}
            value={value}
            size={Math.max(4, value.length)}
            className={cn(
                "h-6 min-w-0 rounded-sm border border-palette-line bg-palette-base px-1 text-palette-contrast outline-none",
                "focus-visible:ring-2 focus-visible:ring-palette-ring aria-invalid:border-palette-ring aria-invalid:ring-2",
            )}
            onChange={(event) => {
                setValue(event.target.value);
                setInvalid(false);
            }}
            onKeyDown={(event) => {
                // the tab handles Enter, Space, arrows, Home and End itself: keep them in the field
                event.stopPropagation();
                if (event.key === "Enter") {
                    finish(true, event.currentTarget);
                } else if (event.key === "Escape") {
                    finish(false, event.currentTarget);
                }
            }}
            // leaving the field confirms, or cancels when it is empty
            onBlur={(event) => finish(value.trim() !== "", event.currentTarget)}
        />
    );
}
