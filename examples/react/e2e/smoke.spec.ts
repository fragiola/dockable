import { expect, test } from "@playwright/test";
import { collectErrors, EXAMPLES, openExample, reset, THEMES } from "./helpers";

// Copied from apps/docs/e2e/smoke.spec.ts. Every example, in every theme: the layout mounts and
// nothing logs an error. A new example folder is covered without touching this file.

for (const example of EXAMPLES) {
    for (const theme of THEMES) {
        test(`${example.slug} renders in ${theme.name}`, async ({ page }) => {
            const errors = collectErrors(page);
            await openExample(page, example.slug, { theme: theme.name });
            // the site's Reset reloads the frame: the example must come back
            await reset(page);
            expect(errors).toEqual([]);
        });
    }
}
