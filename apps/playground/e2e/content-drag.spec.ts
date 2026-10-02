// Drags that are not the layout's own: the app's drag and drop inside a tab, a layout nested in a
// tab, content that stops a drop, and a drag source that unmounts mid-drag. Each test names the
// FlexLayout issue it guards against.
import { expect, type Page, test } from "@playwright/test";
import { drag, dragOver, Location, waitForBox } from "./helpers";

const open = async (page: Page, query = "") => {
    await page.goto(`/fixtures/content-drag/${query}`);
    await waitForBox(outer(page, "/layout"), "outer layout");
    await waitForBox(inner(page, "/layout"), "inner layout");
};

/** an element of the outer layout (the inner one, in a tab of it, has the same paths) */
const outer = (page: Page, path: string) =>
    page.locator(`[data-layout-path="${path}"]:not([data-testid="inner"] *)`);
/** an element of the layout nested in the "Nested" tab */
const inner = (page: Page, path: string) =>
    page.getByTestId("inner").locator(`[data-layout-path="${path}"]`);
const outerTabs = (page: Page) =>
    page.locator('[role="tab"]:not([data-testid="inner"] *)');

for (const query of ["", "?accept=all"]) {
    test(`a native drag between two lists of a tab moves the item and nothing else${query ? ", with an onExternalDrag that accepts everything" : ""} (caplin/FlexLayout#350)`, async ({
        page,
    }) => {
        await open(page, query);
        await drag(
            page,
            page.getByTestId("item-Apple"),
            page.getByTestId("list-b"),
            Location.CENTER,
        );
        await expect(
            page.getByTestId("list-b").getByTestId("item-Apple"),
        ).toBeVisible();
        await expect(outerTabs(page)).toHaveText([
            "Lists",
            "Other",
            "Spare",
            "Nested",
        ]);
        await expect(outer(page, "/outline")).toBeHidden();
        await expect(outer(page, "/layout")).not.toHaveAttribute(
            "data-dragging",
        );
    });
}

test("a tab drag after a drop the content stopped shows its drop outline (caplin/FlexLayout#527)", async ({
    page,
}) => {
    await open(page);
    // a text drag the layout does not take: the sink stops the drop's propagation, the chip its
    // dragend's, so neither reaches the layout or the document
    await drag(
        page,
        page.getByTestId("chip"),
        page.getByTestId("sink"),
        Location.CENTER,
    );
    await expect(page.getByTestId("sunk")).toHaveText("chip");
    await expect(outerTabs(page)).toHaveCount(4);

    const release = await dragOver(
        page,
        outer(page, "/ts1/tb0"),
        outer(page, "/ts0/content"),
        Location.CENTER,
    );
    const outline = outer(page, "/outline");
    await expect(outline).toBeVisible();
    await expect(outline).toHaveAttribute("data-dragging", "");
    await expect(outline).toHaveAttribute("data-drop-location", "center");
    await release();
    await expect(outer(page, "/ts0/tb1")).toHaveText("Other");
    await expect(outline).toBeHidden();
});

test("a tab dragged from a menu that closes, let go outside the layout, does not take over the next drag (caplin/FlexLayout#528)", async ({
    page,
}) => {
    await open(page);
    await outer(page, "/ts1").getByRole("button", { name: "Tabs" }).click();
    const item = page.getByRole("menuitem", { name: "Spare" });
    const release = await dragOver(
        page,
        item,
        page.getByTestId("outside"),
        Location.CENTER,
    );
    await expect(page.getByRole("menu")).toHaveCount(0); // the source unmounted mid-drag
    await release();
    await expect(outerTabs(page)).toHaveText([
        "Lists",
        "Other",
        "Spare",
        "Nested",
    ]);
    // the next drag is the lists' own: the item moves, no tab does
    await drag(
        page,
        page.getByTestId("item-Banana"),
        page.getByTestId("list-b"),
        Location.CENTER,
    );
    await expect(
        page.getByTestId("list-b").getByTestId("item-Banana"),
    ).toBeVisible();
    await expect(outerTabs(page)).toHaveText([
        "Lists",
        "Other",
        "Spare",
        "Nested",
    ]);
    await expect(outer(page, "/layout")).not.toHaveAttribute("data-dragging");
});

test("a layout nested in a tab keeps the drags meant for it (caplin/FlexLayout#497)", async ({
    page,
}) => {
    await open(page, "?accept=all");
    // a file dropped on the inner layout: the inner one adds it, the outer one (which accepts
    // everything) neither asks nor adds
    const dataTransfer = await page.evaluateHandle(() => {
        const transfer = new DataTransfer();
        transfer.items.add(
            new File(["x"], "notes.txt", { type: "text/plain" }),
        );
        return transfer;
    });
    const target = inner(page, "/ts1/content");
    const box = await waitForBox(target, "inner tabset content");
    const point = {
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
    };
    for (const type of ["dragenter", "dragover", "drop"]) {
        await target.dispatchEvent(type, { dataTransfer, ...point });
    }
    await expect(inner(page, "/ts1/tb1")).toHaveText("File");
    await expect(outerTabs(page)).toHaveCount(4);
    await expect(outer(page, "/outline")).toBeHidden();

    // a tab of the inner layout moves within it
    await drag(
        page,
        inner(page, "/ts0/tb0"),
        inner(page, "/ts1/content"),
        Location.CENTER,
    );
    await expect(page.getByTestId("inner").locator('[role="tab"]')).toHaveText([
        "Inner B",
        "File",
        "Inner A",
    ]);
    await expect(outerTabs(page)).toHaveText([
        "Lists",
        "Other",
        "Spare",
        "Nested",
    ]);
});
