"use client";

import { useEffect, useState } from "react";

/**
 * The example theme of the element given to the returned ref (read from the nearest
 * `[data-example-theme]`, kept up to date).
 *
 * Fragiola menus, selects and tooltips portal into `document.body`, outside the stage that
 * carries `data-example-theme`, so they would take the page's colours. Their popup box has the
 * `palette-raised` class, and each theme's palette rules also match an element that carries both
 * the attribute and the class, so putting the attribute on the popup themes it:
 *
 * ```tsx
 * const [ref, theme] = useStageTheme();
 * <Menu.Trigger ref={ref} />
 * <Menu.Content data-example-theme={theme} />
 * ```
 *
 * An app that sets its theme on `<html>` or `<body>` does not need this.
 */
export function useStageTheme() {
    const [element, setElement] = useState<HTMLElement | null>(null);
    const [theme, setTheme] = useState<string | undefined>(undefined);
    useEffect(() => {
        const themed = element?.closest<HTMLElement>("[data-example-theme]");
        if (!themed) {
            return;
        }
        const read = () => setTheme(themed.dataset.exampleTheme);
        read();
        const observer = new MutationObserver(read);
        observer.observe(themed, { attributeFilter: ["data-example-theme"] });
        return () => observer.disconnect();
    }, [element]);
    return [setElement, theme] as const;
}
