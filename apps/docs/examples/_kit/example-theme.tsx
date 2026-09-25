"use client";

import { type RefObject, useEffect, useState } from "react";

/** The name of the example theme around `ref`, kept up to date (as `useExampleTheme` in
 * `charts.tsx`, which this file does not import so that menus do not pull in the chart). */
function useThemeName(ref: RefObject<HTMLElement | null>) {
    const [theme, setTheme] = useState<string | undefined>(undefined);
    useEffect(() => {
        let frame = 0;
        let observer: MutationObserver | undefined;
        const attach = () => {
            const themed = ref.current?.closest<HTMLElement>(
                "[data-example-theme]",
            );
            if (!themed) {
                frame = requestAnimationFrame(attach);
                return;
            }
            const read = () => setTheme(themed.dataset.exampleTheme);
            read();
            observer = new MutationObserver(read);
            observer.observe(themed, {
                attributeFilter: ["data-example-theme"],
            });
        };
        attach();
        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
        };
    }, [ref]);
    return theme;
}

/**
 * Menus, selects and dialogs render in a portal on `document.body`, outside the element that
 * carries the example theme, so they would take the page's colours. Spread the result on the
 * popup (`<Select.Content {...popupTheme}>`): the themes also match `[data-example-theme]` on
 * the palette element itself, so the popup gets the theme's palettes back.
 *
 * In an app with one theme on `<body>` this is not needed.
 */
export function usePopupTheme(ref: RefObject<HTMLElement | null>) {
    return { "data-example-theme": useThemeName(ref) };
}
