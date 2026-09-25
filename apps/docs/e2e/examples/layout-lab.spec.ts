import { expect, test } from "@playwright/test";
import { openExample, path } from "../helpers";

test("applying JSON changes the layout", async ({ page }) => {
    const stage = await openExample(page, "layout-lab");
    const json = stage.getByRole("textbox", { name: "Layout JSON" });
    await expect(path(page, "/ts2")).toHaveCount(0);

    const tabset = (name: string) => ({
        type: "tabset",
        children: [{ type: "tab", name, component: "card" }],
    });
    await json.fill(
        JSON.stringify({
            global: {},
            borders: [],
            layout: {
                type: "row",
                children: ["Alpha", "Beta", "Gamma"].map(tabset),
            },
        }),
    );
    await stage.getByRole("button", { name: "Apply" }).click();

    await expect(path(page, "/ts2")).toHaveCount(1);
    await expect(stage.getByRole("tab", { name: /Gamma/ })).toBeVisible();
    await expect(stage.getByRole("tab", { name: /Welcome/ })).toHaveCount(0);
    // the editor follows the new model
    await expect(json).toHaveValue(/"Gamma"/);

    // invalid JSON is reported and the layout is left alone
    await json.fill("{ nope");
    await stage.getByRole("button", { name: "Apply" }).click();
    await expect(stage.getByRole("alert")).toBeVisible();
    await expect(stage.getByRole("tab", { name: /Gamma/ })).toBeVisible();
});

test("a vetoed action leaves the model unchanged", async ({ page }) => {
    const stage = await openExample(page, "layout-lab");
    const json = stage.getByRole("textbox", { name: "Layout JSON" });
    const notes = stage.getByRole("tab", { name: /Notes/ });
    await stage.getByRole("tab", { name: /Welcome/ }).click(); // its tabset becomes active
    const before = await json.inputValue();

    // veto "selectTab" (the default choice), then try to select another tab
    await stage.getByRole("switch", { name: "Veto" }).click();
    await notes.click();

    const log = stage.getByTestId("action-log");
    await expect(log.locator("li[data-vetoed]").first()).toContainText(
        "Actions.selectTab",
    );
    await expect(notes).toHaveAttribute("aria-selected", "false");
    await expect(json).toHaveValue(before);

    // without the veto the same click applies
    await stage.getByRole("switch", { name: "Veto" }).click();
    await notes.click();
    await expect(notes).toHaveAttribute("aria-selected", "true");
    await expect(json).not.toHaveValue(before);
});
