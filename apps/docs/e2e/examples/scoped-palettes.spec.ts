import { expect, type Locator, test } from "@playwright/test";
import { openExample, path } from "../helpers";

const background = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el).backgroundColor);

test("a tabset's palette menu recolours the tabset and its panel", async ({
    page,
}) => {
    await openExample(page, "scoped-palettes");
    const tabset = path(page, "/ts0");
    const content = path(page, "/ts0/t0").locator("[data-palette]");
    const blue = await background(tabset);
    await expect(content).toHaveAttribute("data-palette", "palette-blue");

    await tabset.getByRole("button", { name: "Tabset palette" }).click();
    await page.getByRole("menuitemradio", { name: "Green" }).click();
    await expect.poll(() => background(tabset)).not.toBe(blue);

    // the panel lives outside the tabset (gap 2) but takes the same palette
    await expect(content).toHaveAttribute("data-palette", "palette-green");
    expect(await background(content)).toBe(await background(tabset));

    // surface, too, overrides the kit's raised default
    await tabset.getByRole("button", { name: "Tabset palette" }).click();
    await page.getByRole("menuitemradio", { name: "Surface" }).click();
    await expect(content).toHaveAttribute("data-palette", "palette-surface");
    await expect
        .poll(() => background(tabset))
        .not.toBe(await background(path(page, "/r1/ts1")));
});
