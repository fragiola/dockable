// External drag sources (Epic #18): Dockable.DragSource elements outside the layout, and files
// dragged in from the OS through Dockable.Root's onExternalDrag.
import { expect, type Page, test } from "@playwright/test";
import {
    checkTab,
    drag,
    dragOver,
    dragToEdge,
    Edge,
    findAllTabSets,
    findPath,
    Location,
    waitForBox,
} from "./helpers";

const open = async (page: Page) => {
    await page.goto("/fixtures/external/?layout=test_two_tabs");
    await waitForBox(findPath(page, "/layout"), "layout root");
    await expect(findAllTabSets(page)).toHaveCount(2);
};

const chart = (page: Page) => page.getByTestId("source-chart");
const table = (page: Page) => page.getByTestId("source-table");
const lastDrop = (page: Page) => page.getByTestId("last-drop");

test.describe("drag sources outside the layout", () => {
    test.beforeEach(async ({ page }) => open(page));

    test("into the centre of a tabset adds a selected tab there", async ({
        page,
    }) => {
        await drag(
            page,
            chart(page),
            findPath(page, "/ts1/t0"),
            Location.CENTER,
        );
        await expect(findAllTabSets(page)).toHaveCount(2);
        await checkTab(page, "/ts1", 0, false, "Two");
        await checkTab(page, "/ts1", 1, true, "Chart 1");
        await expect(lastDrop(page)).toHaveText("added:Chart 1");
        // a function json builds a fresh tab for every drag
        await drag(
            page,
            chart(page),
            findPath(page, "/ts0/t0"),
            Location.CENTER,
        );
        await checkTab(page, "/ts0", 1, true, "Chart 2");
    });

    test("onto a tabset edge splits it", async ({ page }) => {
        await drag(
            page,
            table(page),
            findPath(page, "/ts1/t0"),
            Location.BOTTOM,
        );
        await expect(findAllTabSets(page)).toHaveCount(3);
        await checkTab(page, "/r1/ts0", 0, true, "Two");
        await checkTab(page, "/r1/ts1", 0, true, "Table");
    });

    test("to the layout edge docks a new tabset there", async ({ page }) => {
        await dragToEdge(page, table(page), Edge.RIGHT);
        await expect(findAllTabSets(page)).toHaveCount(3);
        await checkTab(page, "/ts2", 0, true, "Table");
    });

    test("marks the source and the root while dragging, and shows the drop indicator", async ({
        page,
    }) => {
        const release = await dragOver(
            page,
            chart(page),
            findPath(page, "/ts1/t0"),
            Location.CENTER,
        );
        await expect(chart(page)).toHaveAttribute("data-dragging", "");
        await expect(findPath(page, "/layout")).toHaveAttribute(
            "data-dragging",
            "",
        );
        await expect(findPath(page, "/outline")).toBeVisible();
        await release();
        await expect(chart(page)).not.toHaveAttribute("data-dragging");
        await expect(findPath(page, "/layout")).not.toHaveAttribute(
            "data-dragging",
        );
    });

    test("cancelled with Escape adds nothing", async ({ page }) => {
        const release = await dragOver(
            page,
            chart(page),
            findPath(page, "/ts1/t0"),
            Location.CENTER,
        );
        await page.keyboard.press("Escape");
        await release();
        await expect(page.getByRole("tab")).toHaveCount(2);
        await expect(lastDrop(page)).toHaveText("none");
        await expect(chart(page)).not.toHaveAttribute("data-dragging");
        await expect(findPath(page, "/layout")).not.toHaveAttribute(
            "data-dragging",
        );
        await expect(findPath(page, "/outline")).toBeHidden();
    });

    test("released outside the layout adds nothing", async ({ page }) => {
        const release = await dragOver(
            page,
            chart(page),
            findPath(page, "/ts1/t0"),
            Location.CENTER,
        );
        // back over the sidebar, then release: the drag is cancelled
        const box = await waitForBox(page.getByTestId("sidebar"), "sidebar");
        await page.mouse.move(box.x + 20, box.y + box.height - 10, {
            steps: 10,
        });
        await release();
        await expect(findAllTabSets(page)).toHaveCount(2);
        await checkTab(page, "/ts1", 0, true, "Two");
        await expect(lastDrop(page)).toHaveText("none");
        await expect(findPath(page, "/layout")).not.toHaveAttribute(
            "data-dragging",
        );
    });
});

test.describe("files dragged in from the OS", () => {
    test.beforeEach(async ({ page }) => open(page));

    async function dropFile(page: Page, types: "file" | "text") {
        const dataTransfer = await page.evaluateHandle((kind) => {
            const transfer = new DataTransfer();
            if (kind === "file") {
                transfer.items.add(
                    new File(["a,b\n1,2"], "report.csv", { type: "text/csv" }),
                );
            } else {
                transfer.setData("text/plain", "hello");
            }
            return transfer;
        }, types);
        const target = findPath(page, "/ts1/t0");
        const box = await waitForBox(target, "target panel");
        const point = {
            clientX: box.x + box.width / 2,
            clientY: box.y + box.height / 2,
        };
        for (const type of ["dragenter", "dragover", "drop"]) {
            await target.dispatchEvent(type, { dataTransfer, ...point });
        }
    }

    test("a file becomes a tab named after it", async ({ page }) => {
        await dropFile(page, "file");
        await checkTab(page, "/ts1", 1, true, "report.csv");
        await expect(lastDrop(page)).toHaveText("file:report.csv");
        await expect(findPath(page, "/layout")).not.toHaveAttribute(
            "data-dragging",
        );
    });

    test("a drag onExternalDrag declines (plain text) adds nothing", async ({
        page,
    }) => {
        await dropFile(page, "text");
        await expect(findAllTabSets(page)).toHaveCount(2);
        await expect(page.getByRole("tab")).toHaveCount(2);
        await expect(lastDrop(page)).toHaveText("none");
    });
});
