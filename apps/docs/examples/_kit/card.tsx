"use client";

import type { TabNode } from "@fragiola/dockable";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import * as styles from "./styles";

// Demo content: a panel body, and a card with state you can see. Nothing here is part of
// Dockable: a panel renders whatever the consumer gives it.

/** A padded, scrollable panel body with a title. */
export function PanelBody({
    title,
    children,
    className,
}: {
    title?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex min-h-full flex-col gap-3 p-4", className)}>
            {title ? <h2 className="text-base">{title}</h2> : null}
            {children}
        </div>
    );
}

/**
 * Content with state you can see: a counter and a text input. Move the tab to another tabset,
 * maximize it or pop it out, and both keep their value: the content is never remounted.
 */
export function Card({
    tab,
    children,
}: {
    tab: TabNode;
    children?: ReactNode;
}) {
    const [count, setCount] = useState(0);
    return (
        <PanelBody title={tab.getName()}>
            <p className="text-palette-accent/85">
                Drag the tab, resize with the splitters. The counter and the
                notes survive every move.
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    data-testid="counter"
                    className={cn("palette-blue", styles.solidButton)}
                    onClick={() => setCount((c) => c + 1)}
                >
                    {`Count: ${count}`}
                </button>
                <input
                    data-testid="notes"
                    aria-label={`${tab.getName()} notes`}
                    placeholder="Notes"
                    className="h-8 min-w-0 rounded-md border border-palette-line bg-palette-soft px-3 text-sm placeholder:text-palette-accent/85 focus-visible:outline-2 focus-visible:outline-palette-ring"
                />
            </div>
            {children}
        </PanelBody>
    );
}
