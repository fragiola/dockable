import { expect, test } from "@playwright/test";

test("the playground index loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Dockable playground",
    );
});
