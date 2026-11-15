// Angular port of the Fragiola UI useThemeTokens (examples/react/src/hooks/use-theme-tokens.ts): the
// same reading, as a function the chart calls when it renders and after a theme change. It reads
// the chart and palette tokens that apply to an element and returns them as plain hex strings.
//
// - SCOPE. The tokens are declared on `.palette-*` elements, never on <html>: the read happens on
//   the chart's own element, so a `palette-blue` wrapper re-derives chart-1..8 from blue for that
//   chart alone.
// - RESOLUTION. The categorical slots are `oklch(from var(--palette-base) …)`; ECharts only parses
//   hex/rgb/hsl. A probe element with `color: var(--token)` makes the browser resolve the colour,
//   and a one-pixel canvas round-trip normalises it to hex.
// - WINDOW. The probe is created in, and resolved by, the element's own document: a chart moved
//   into a popout window reads that window's theme.

import { getToken } from "#/lib/get-token";

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

/** The tokens that apply to `scope`, as hex strings (`""` for one its scope does not declare). */
export function readThemeTokens(scope: HTMLElement): ThemeTokens {
    // The probe inherits the scope's custom properties; `display: none`
    // keeps it out of layout while computed styles still resolve.
    const probe = scope.ownerDocument.createElement("span");
    probe.style.display = "none";
    scope.appendChild(probe);

    const resolve = (token: string): string => {
        // A token that is not declared in this scope stays "" rather than
        // falling through to the probe's inherited text colour.
        if (!getToken(token, { from: scope, fallbackReturn: "" })) return "";
        probe.style.color = `var(${token})`;
        const view = scope.ownerDocument.defaultView ?? window;
        return toHex(view.getComputedStyle(probe).color);
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
