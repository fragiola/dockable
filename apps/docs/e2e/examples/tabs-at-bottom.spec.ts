import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("the strip follows the markup order, and the panel follows the content", async ({
    page,
}) => {
    await openExample(page, "tabs-at-bottom");
    const top = async (layoutPath: string) =>
        (await path(page, layoutPath).boundingBox())?.y ?? 0;

    // bottom (the default): the strip is below the content, the panel over the content
    await expect
        .poll(
            async () =>
                (await top("/ts0/tabstrip")) > (await top("/ts0/content")),
        )
        .toBe(true);
    await expect
        .poll(async () =>
            Math.abs((await top("/ts0/t0")) - (await top("/ts0/content"))),
        )
        .toBeLessThan(2);

    await page.getByRole("button", { name: "Top" }).click();
    await expect(page.getByRole("button", { name: "Top" })).toHaveAttribute(
        "aria-pressed",
        "true",
    );
    await expect
        .poll(
            async () =>
                (await top("/ts0/tabstrip")) < (await top("/ts0/content")),
        )
        .toBe(true);
    await expect
        .poll(async () =>
            Math.abs((await top("/ts0/t0")) - (await top("/ts0/content"))),
        )
        .toBeLessThan(2);
});
