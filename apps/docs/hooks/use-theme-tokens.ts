"use client";
// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/chart.json, source registry/hooks/use-theme-tokens.ts). Do not edit: re-run scripts/vendor-fragiola.ts.

import * as React from "react";
import { getToken } from "@/lib/get-token";

// useThemeTokens — reads the chart and palette tokens that apply to a given
// element and returns them as plain hex strings. Re-reads on theme change
// via a MutationObserver on documentElement's data-theme attribute.
//
// Two things make this more than a getPropertyValue call:
//
// 1. SCOPE. The tokens are declared on `.palette-*` elements (global.css:
//    `:root[data-theme] [class*="palette-"]`), never on <html>. Reading
//    documentElement returns "" for every one of them — which is exactly
//    how the chart rendered nothing: every series got color "". The read
//    has to happen on the chart's own element, which also makes the
//    palette scoping work: a `palette-blue` wrapper re-derives chart-1..8
//    from blue for that chart alone.
//
// 2. RESOLUTION. The categorical slots are `oklch(from var(--palette-base)
//    …)` — relative colour syntax. As a custom property that is a token
//    stream, not a colour; and ECharts (zrender) only parses hex/rgb/hsl,
//    so even a resolved `oklch(…)` string would break hover emphasis. A
//    probe element with `color: var(--token)` makes the browser resolve
//    the colour, and a one-pixel canvas round-trip normalises it to hex.
//
// The chart tokens are defined in global.css as CSS custom properties:
//   --chart-1 through --chart-8 (categorical, derived from --palette-base)
//   --chart-ramp-1 through --chart-ramp-5 (ordinal ramp)
//   --palette-base, --palette-soft, --palette-line, --palette-contrast,
//   --palette-accent, --palette-ring (the six roles)

export type ThemeTokens = {
    categorical: string[];
    ramp: string[];
    palette: {
        base: string;
        soft: string;
        line: string;
        contrast: string;
        accent: string;
        ring: string;
    };
};

const CATEGORICAL_KEYS = Array.from(
    { length: 8 },
    (_, i) => `--chart-${i + 1}`,
);
const RAMP_KEYS = Array.from({ length: 5 }, (_, i) => `--chart-ramp-${i + 1}`);

/**
 * Returns `null` until mounted: the tokens live on the DOM, so there is
 * nothing to read on the server or before the scope element exists.
 */
export function useThemeTokens(
    scope?: React.RefObject<HTMLElement | null>,
): ThemeTokens | null {
    const [tokens, setTokens] = React.useState<ThemeTokens | null>(null);

    React.useEffect(() => {
        const read = () => {
            const element = scope?.current ?? document.body;
            setTokens(readTokens(element));
        };
        read();

        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        return () => observer.disconnect();
    }, [scope]);

    return tokens;
}

function readTokens(scope: HTMLElement): ThemeTokens {
    // The probe inherits the scope's custom properties; `display: none`
    // keeps it out of layout while computed styles still resolve.
    const probe = document.createElement("span");
    probe.style.display = "none";
    scope.appendChild(probe);

    const resolve = (token: string): string => {
        // A token that is not declared in this scope stays "" rather than
        // falling through to the probe's inherited text colour.
        if (!getToken(token, { from: scope, fallbackReturn: "" })) return "";
        probe.style.color = `var(${token})`;
        return toHex(getComputedStyle(probe).color);
    };

    try {
        return {
            categorical: CATEGORICAL_KEYS.map(resolve).filter(Boolean),
            ramp: RAMP_KEYS.map(resolve).filter(Boolean),
            palette: {
                base: resolve("--palette-base"),
                soft: resolve("--palette-soft"),
                line: resolve("--palette-line"),
                contrast: resolve("--palette-contrast"),
                accent: resolve("--palette-accent"),
                ring: resolve("--palette-ring"),
            },
        };
    } finally {
        probe.remove();
    }
}

// Canvas normalises any CSS colour it can parse: paint one pixel and read
// it back as RGB, then format as `#rrggbb`. Reading the pixel, not the
// `fillStyle` getter, is the point — modern Chrome serialises fillStyle in
// the syntax it was given (`oklch(…)`, `lab(…)`), which zrender cannot
// parse; on hover its `liftColor` then returns undefined and the series
// vanishes. Falls back to the input when canvas is unavailable (jsdom).
let context: CanvasRenderingContext2D | null | undefined;

function toHex(color: string): string {
    if (context === undefined) {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        context = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!context) return color;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const pixel = context.getImageData(0, 0, 1, 1).data;
    // Alpha 0 means the colour did not parse (nothing was painted).
    if (pixel[3] === 0) return color;
    const hex = (index: number) =>
        (pixel[index] ?? 0).toString(16).padStart(2, "0");
    return `#${hex(0)}${hex(1)}${hex(2)}`;
}
