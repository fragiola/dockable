import { expect, type Page, test } from "@playwright/test";
import { openExample, path } from "../helpers";

/** Drops files from "the OS" onto a layout element: a synthetic DataTransfer carrying Files. */
async function dropFiles(
    page: Page,
    layoutPath: string,
    files: [name: string, type: string, content: string][],
) {
    const dataTransfer = await page.evaluateHandle((entries) => {
        const transfer = new DataTransfer();
        for (const [name, type, text] of entries) {
            transfer.items.add(new File([text], name, { type }));
        }
        return transfer;
    }, files);
    const target = path(page, layoutPath);
    const box = await target.boundingBox();
    if (!box) throw new Error("no target box");
    const point = {
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
    };
    for (const type of ["dragenter", "dragover", "drop"]) {
        await target.dispatchEvent(type, { dataTransfer, ...point });
    }
}

const CSV = "month,visitors,orders\nJan,10,2\nFeb,14,3";

test("a dropped CSV opens as a table, with a chart beside it", async ({
    page,
}) => {
    const stage = await openExample(page, "drop-files");
    await dropFiles(page, "/ts1/t0", [["visits.csv", "text/csv", CSV]]);
    await expect(path(page, "/ts1/tabstrip").getByRole("tab")).toHaveText([
        "Or here",
        "visits.csv",
    ]);
    await expect(stage.getByRole("cell", { name: "Feb" })).toBeVisible();
    // the chart split the tabset: a new tabset beside it
    await expect(
        stage.getByRole("tab", { name: "visits.csv chart" }),
    ).toBeVisible();
    await expect(stage.locator('[role="tablist"]')).toHaveCount(3);
    await expect(path(page, "/layout")).not.toHaveAttribute("data-dragging");
});

test("a broken layout file is an error tab, not a crash", async ({ page }) => {
    const stage = await openExample(page, "drop-files");
    await dropFiles(page, "/ts0/t0", [
        ["layout.json", "application/json", '{"version": 1}'],
    ]);
    await expect(stage.getByRole("tab", { name: "layout.json" })).toBeVisible();
    await expect(stage.getByRole("alert")).toContainText("Not a layout");
});

test("a saved layout dropped on the layout replaces it", async ({ page }) => {
    const stage = await openExample(page, "drop-files");
    const layout = JSON.stringify({
        version: 1,
        root: {
            type: "row",
            children: [
                {
                    type: "tabset",
                    children: [{ component: "welcome", label: "Restored" }],
                },
            ],
        },
    });
    await dropFiles(page, "/ts0/t0", [
        ["saved.json", "application/json", layout],
    ]);
    await expect(stage.getByRole("tab")).toHaveText(["Restored"]);
});

test("the sample files open without a drop, and a drag with no file is ignored", async ({
    page,
}) => {
    const stage = await openExample(page, "drop-files");
    const dataTransfer = await page.evaluateHandle(() => {
        const transfer = new DataTransfer();
        transfer.setData("text/plain", "just text");
        return transfer;
    });
    for (const type of ["dragenter", "dragover", "drop"]) {
        await path(page, "/ts0/t0").dispatchEvent(type, { dataTransfer });
    }
    await expect(stage.getByRole("tab")).toHaveCount(2);

    await page.getByRole("button", { name: "Open sample files" }).click();
    await expect(
        stage.getByRole("tab", { name: "sales.csv", exact: true }),
    ).toBeVisible();
    await expect(
        stage.getByRole("tab", { name: "sales.csv chart" }),
    ).toBeVisible();
    await expect(stage.getByRole("tab", { name: "badge.svg" })).toBeVisible();
    await expect(stage.getByRole("img", { name: "badge.svg" })).toBeVisible();
});
