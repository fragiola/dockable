import { expect, test } from "@playwright/test";
import { openExample } from "../helpers";

test("opening an open file selects its tab, and closing a modified tab asks first", async ({
    page,
}) => {
    const stage = await openExample(page, "ide-workbench", { theme: "ide" });
    const explorer = stage.getByRole("navigation", { name: "Explorer" });
    const open = (name: string) =>
        explorer.getByRole("button", { name, exact: true }).click();
    const tab = (name: string) =>
        stage.getByRole("tab", {
            name: new RegExp(`^${name.replace(".", "\\.")}`),
        });

    // a file that is not open becomes a new, selected tab
    await expect(tab("main.ts")).toHaveCount(0);
    await open("main.ts");
    await expect(tab("main.ts")).toHaveCount(1);
    await expect(tab("main.ts")).toHaveAttribute("aria-selected", "true");

    // opening it again selects the existing tab instead of adding another
    await open("store.ts");
    await expect(tab("store.ts")).toHaveAttribute("aria-selected", "true");
    await open("main.ts");
    await expect(tab("main.ts")).toHaveCount(1);
    await expect(tab("main.ts")).toHaveAttribute("aria-selected", "true");

    // an edit marks the tab as modified (the editor writes it into the tab's config)
    await stage
        .getByRole("textbox", { name: "Contents of src/main.ts" })
        .fill("// changed\n");
    await expect(tab("main.ts")).toHaveAttribute("data-dirty", "");
    await expect(stage.getByTestId("unsaved-count")).toHaveText(
        "1 unsaved file",
    );

    // closing it is vetoed in onAction and asks; Cancel keeps the tab
    const dialog = page.getByRole("alertdialog");
    await tab("main.ts").getByRole("button", { name: "Close main.ts" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Save changes to main.ts?");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(tab("main.ts")).toHaveCount(1);

    // Don't save closes it and drops the edit
    await tab("main.ts").getByRole("button", { name: "Close main.ts" }).click();
    await dialog.getByRole("button", { name: "Don't save" }).click();
    await expect(tab("main.ts")).toHaveCount(0);
    await expect(stage.getByTestId("unsaved-count")).toHaveText(
        "0 unsaved files",
    );

    // a clean tab closes without asking
    await tab("store.ts")
        .getByRole("button", { name: "Close store.ts" })
        .click();
    await expect(tab("store.ts")).toHaveCount(0);
    await expect(dialog).toBeHidden();
});
