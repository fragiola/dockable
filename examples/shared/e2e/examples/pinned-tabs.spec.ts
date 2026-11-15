import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("pinning moves a tab to the pinned group and makes it unclosable", async ({
    page,
}) => {
    await openExample(page, "pinned-tabs");
    // pinned tabs are icons (named for screen readers) with no close button
    await expect(path(page, "/ts0/tb0")).toHaveAttribute("data-pinned", "");
    await expect(path(page, "/ts0/tb0")).toHaveAccessibleName("Home");
    await expect(path(page, "/ts0/tb0").getByRole("button")).toHaveCount(0);

    // pin "Budget.xlsx" (the last tab): it joins the pinned group, after Mail
    await path(page, "/ts0/tb4").click();
    await path(page, "/ts0")
        .getByRole("button", { name: "Pin Budget.xlsx" })
        .click();
    const pinned = path(page, "/ts0/tb2");
    await expect(pinned).toHaveAttribute("data-pinned", "");
    await expect(pinned).toHaveAccessibleName("Budget.xlsx");
    await expect(pinned.getByRole("button")).toHaveCount(0);

    // unpin it: it is closable again
    await path(page, "/ts0")
        .getByRole("button", { name: "Unpin Budget.xlsx" })
        .click();
    await expect(pinned).not.toHaveAttribute("data-pinned");
    await pinned.getByRole("button", { name: "Close Budget.xlsx" }).click();
    await expect(
        path(page, "/ts0/tabstrip").getByRole("tab", { name: "Budget.xlsx" }),
    ).toHaveCount(0);
});
