import { expect, test } from "@playwright/test";
import { collectErrors, EXAMPLES, openExample, THEMES } from "./helpers";

// Every example, in every theme: the layout mounts and nothing logs an error.
// A new example folder is covered without touching this file.

for (const example of EXAMPLES) {
    for (const theme of THEMES) {
        test(`${example.slug} renders in ${theme.name}`, async ({ page }) => {
            const errors = collectErrors(page);
            await openExample(page, example.slug, { theme: theme.name });
            // resetting remounts the example: it must clean up after itself
            await page.getByTestId("reset").click();
            await page.getByTestId("reset").click();
            await expect(
                page
                    .getByTestId("stage")
                    .locator('[data-layout-path="/layout"]')
                    .first(),
            ).toBeVisible();
            expect(errors).toEqual([]);
        });
    }
}
