import { expect, test } from "@playwright/test";
import { collectErrors, EXAMPLES, openExample, reset, THEMES } from "./helpers";

// Every example mounts and logs no error, in the reference theme (the first of THEMES); a new
// example folder is covered without touching this file. A theme is CSS (its shape is checked in
// themes.spec.ts) plus the kit's theme hooks (`_kit/theme.ts`, `_kit/charts.tsx`), so every theme
// runs on a representative set that exercises both, not on every example. `E2E_ALL_THEMES=1`
// runs every example in every theme.

/** Examples run in every theme, chosen so that together they cover what a theme can break. */
const REPRESENTATIVE = [
    "hello-layout", // the baseline: rows, tabsets, splitters
    "overlay-borders", // borders, docked and overlay
    "popout", // popout triggers
    "overflow-select", // the tab overflow and a portalled select (the popup theme hook)
    "analytics-dashboard", // the theme-heavy one: charts (the chart theme hook), menus, selects
];

const slugs = new Set(EXAMPLES.map((example) => example.slug));
const missing = REPRESENTATIVE.filter((slug) => !slugs.has(slug));
if (missing.length > 0) {
    throw new Error(
        `smoke.spec.ts: REPRESENTATIVE names examples that do not exist: ${missing.join(", ")}`,
    );
}

const ALL_THEMES = process.env.E2E_ALL_THEMES === "1";
const [reference] = THEMES;

for (const example of EXAMPLES) {
    const themes =
        ALL_THEMES || REPRESENTATIVE.includes(example.slug)
            ? THEMES
            : [reference];
    for (const theme of themes) {
        test(`${example.slug} renders in ${theme.name}`, async ({ page }) => {
            const errors = collectErrors(page);
            await openExample(page, example.slug, { theme: theme.name });
            // the site's Reset reloads the frame: the example must come back
            await reset(page);
            expect(errors).toEqual([]);
        });
    }
}
