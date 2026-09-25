import { expect, type Page, test } from "@playwright/test";
import { openExample, path } from "../helpers";

/** Drops files from "the OS" onto a layout element: a synthetic DataTransfer carrying Files. */
async function dropFiles(
    page: Page,
    layoutPath: string,
    files: [name: string, content: string][],
) {
    const dataTransfer = await page.evaluateHandle((entries) => {
        const transfer = new DataTransfer();
        for (const [name, text] of entries) {
            transfer.items.add(new File([text], name, { type: "text/plain" }));
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

test("a dropped file becomes a tab named after it, showing its content", async ({
    page,
}) => {
    const stage = await openExample(page, "drop-files");
    await dropFiles(page, "/ts1/t0", [["notes.txt", "hello from a file"]]);
    const strip = path(page, "/ts1/tabstrip");
    await expect(strip.getByRole("tab")).toHaveText(["Also here", "notes.txt"]);
    await expect(stage.getByTestId("file-text")).toHaveText(
        "hello from a file",
    );
    await expect(path(page, "/layout")).not.toHaveAttribute("data-dragging");
});

test("a drag that carries no file is ignored", async ({ page }) => {
    const stage = await openExample(page, "drop-files");
    const dataTransfer = await page.evaluateHandle(() => {
        const transfer = new DataTransfer();
        transfer.setData("text/plain", "just text");
        return transfer;
    });
    const target = path(page, "/ts0/t0");
    for (const type of ["dragenter", "dragover", "drop"]) {
        await target.dispatchEvent(type, { dataTransfer });
    }
    await expect(stage.getByRole("tab")).toHaveCount(2);
});

test("several files dropped at once open one tab each", async ({ page }) => {
    await openExample(page, "drop-files");
    await dropFiles(page, "/ts0/t0", [
        ["a.txt", "first"],
        ["b.txt", "second"],
        ["c.txt", "third"],
    ]);
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Drop here",
        "a.txt",
        "b.txt",
        "c.txt",
    ]);
});
