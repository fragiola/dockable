"use client";

import {
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

/**
 * The docs' example theme around an element: the `data-example-theme` of its nearest ancestor,
 * kept up to date. An app with one theme on `<html>`/`<body>` needs none of this file.
 *
 * A panel's content is portalled into the tab's moveable element, which the engine attaches to
 * the layout after the first commit: until then there is no themed ancestor, so the hook
 * retries each frame until there is.
 */
export function useExampleTheme(ref: RefObject<HTMLElement | null>) {
    const [theme, setTheme] = useState<string | undefined>(undefined);
    useEffect(() => {
        let observer: MutationObserver | undefined;
        let frame = 0;
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
 * Fragiola menus, selects, tooltips and dialogs portal into `document.body`, outside the stage
 * that carries the theme, so they would take the page's colours. Spread the result on the popup
 * (`<Select.Content {...usePopupTheme(ref)}>`): each theme's palette rules also match an element
 * carrying both the attribute and the palette class, so the popup gets the theme back.
 */
export function usePopupTheme(ref: RefObject<HTMLElement | null>) {
    return { "data-example-theme": useExampleTheme(ref) };
}

/**
 * The same, for a callback ref: `const [ref, theme] = useStageTheme()`, then `ref={ref}` on an
 * element inside the stage and `data-example-theme={theme}` on the popup.
 */
export function useStageTheme() {
    const element = useRef<HTMLElement | null>(null);
    const theme = useExampleTheme(element);
    const ref = useCallback((node: HTMLElement | null) => {
        element.current = node;
    }, []);
    return [ref, theme] as const;
}
