// Drop control (Epic #19): drop-target attributes, refused drops, and a drop zone outside the
// layout.
import { expect, type Page, test } from "@playwright/test";
import {
    dragOver,
    findAllTabSets,
    findPath,
    findTabButton,
    Location,
    waitForBox,
} from "./helpers";

const open = async (page: Page, query = "") => {
    await page.goto(`/fixtures/drop-control/?layout=test_three_tabs${query}`);
    await waitForBox(findPath(page, "/layout"), "layout root");
    await expect(findAllTabSets(page)).toHaveCount(3);
};

const targets = (page: Page) =>
    page.locator('[data-layout-path^="/ts"][data-drop-target]');

test("data-drop-target follows the pointer, on exactly one tabset", async ({
    page,
}) => {
    await open(page);
    const release = await dragOver(
        page,
        findTabButton(page, "/ts0", 0),
        findPath(page, "/ts1/t0"),
        Location.CENTER,
    );
    await expect(targets(page)).toHaveCount(1);
    await expect(findPath(page, "/ts1")).toHaveAttribute(
        "data-drop-target",
        "",
    );
    await expect(findPath(page, "/ts1")).toHaveAttribute(
        "data-drop-location",
        "center",
    );

    // on to the third tabset's top edge
    const box = await waitForBox(findPath(page, "/ts2/t0"), "third panel");
    await page.mouse.move(box.x + box.width / 2, box.y + 6, { steps: 10 });
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + 6);
    await expect(targets(page)).toHaveCount(1);
    await expect(findPath(page, "/ts2")).toHaveAttribute(
        "data-drop-location",
        "top",
    );
    await expect(findPath(page, "/ts1")).not.toHaveAttribute(
        "data-drop-target",
    );

    await release();
    await expect(targets(page)).toHaveCount(0);
});

test("a strip drop marks the tab list and gives the insertion index", async ({
    page,
}) => {
    await open(page);
    const strip = findPath(page, "/ts1/tabstrip");
    const tab = await waitForBox(findTabButton(page, "/ts1", 0), "tab button");
    const release = await dragOver(
        page,
        findTabButton(page, "/ts0", 0),
        findPath(page, "/ts1/tabstrip"),
        Location.CENTER,
    );
    await page.mouse.move(tab.x + tab.width + 20, tab.y + tab.height / 2, {
        steps: 5,
    });
    await page.mouse.move(tab.x + tab.width + 21, tab.y + tab.height / 2);
    await expect(strip).toHaveAttribute("data-drop-target", "");
    await expect(strip).toHaveAttribute("data-drop-index", "1");
    await release();
    await expect(strip).not.toHaveAttribute("data-drop-target");
});

test("a refused target hides the outline and marks the root and the tabset", async ({
    page,
}) => {
    await open(page, "&refuse=/ts2");
    const release = await dragOver(
        page,
        findTabButton(page, "/ts0", 0),
        findPath(page, "/ts1/t0"),
        Location.CENTER,
    );
    await expect(findPath(page, "/outline")).toBeVisible();
    await expect(findPath(page, "/layout")).not.toHaveAttribute(
        "data-drop-refused",
    );

    const box = await waitForBox(findPath(page, "/ts2/t0"), "refused panel");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
        steps: 10,
    });
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
    await expect(findPath(page, "/outline")).toBeHidden();
    await expect(findPath(page, "/outline")).toHaveAttribute(
        "data-drop-refused",
        "",
    );
    await expect(findPath(page, "/layout")).toHaveAttribute(
        "data-drop-refused",
        "",
    );
    await expect(findPath(page, "/ts2")).toHaveAttribute(
        "data-drop-refused",
        "",
    );
    await expect(targets(page)).toHaveCount(0);

    await release();
    // nothing moved
    await expect(findAllTabSets(page)).toHaveCount(3);
    await expect(findPath(page, "/ts2/tabstrip").getByRole("tab")).toHaveText([
        "Three",
    ]);
    await expect(findPath(page, "/layout")).not.toHaveAttribute(
        "data-drop-refused",
    );
});

test("a tab dropped on the trash zone is deleted, and the layout moves nothing", async ({
    page,
}) => {
    await open(page);
    const trash = page.getByTestId("trash");
    const release = await dragOver(
        page,
        findTabButton(page, "/ts1", 0),
        trash,
        Location.CENTER,
    );
    await expect(trash).toHaveAttribute("data-drop-active", "");
    await expect(trash).toHaveAttribute("data-drop-over", "");
    await expect(findPath(page, "/outline")).toBeHidden();
    await release();
    await expect(page.getByTestId("last-drop")).toHaveText("trash:Two");
    await expect(findAllTabSets(page)).toHaveCount(2);
    await expect(page.getByRole("tab", { name: "Two" })).toHaveCount(0);
    await expect(trash).not.toHaveAttribute("data-drop-active");
});
