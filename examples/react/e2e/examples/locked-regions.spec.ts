import { expect, type Page, test } from "@playwright/test";
import { centre, moveDragTo, openExample, path, startDrag } from "../helpers";

/** Every tabset's tab names, in order: what the model shows. */
const tabs = (page: Page) =>
    page
        .getByTestId("stage")
        .locator('[role="tablist"]')
        .evaluateAll((lists) =>
            lists.map((list) =>
                Array.from(list.querySelectorAll('[role="tab"]')).map(
                    (tab) => tab.textContent,
                ),
            ),
        );

async function box(page: Page, layoutPath: string) {
    const rect = await path(page, layoutPath).boundingBox();
    if (!rect) throw new Error(`no box for ${layoutPath}`);
    return rect;
}

test("drops into a locked region are refused and change nothing", async ({
    page,
}) => {
    await openExample(page, "locked-regions");
    const indicator = path(page, "/outline");
    const before = await tabs(page);

    const reference = await box(page, "/ts0/content");
    const middle = reference.y + reference.height / 2;
    const root = await box(page, "/layout");
    const refused = [
        await centre(path(page, "/ts0/content")), // centre
        { x: reference.x + 10, y: middle }, // its left side
        { x: reference.x + reference.width - 10, y: middle }, // its right side
        { x: reference.x + reference.width / 2, y: reference.y + 10 }, // its top
        await centre(path(page, "/ts0/tabstrip")), // its strip
        { x: root.x + 4, y: root.y + root.height / 2 }, // the layout's edge beside it
    ];

    // "Draft" does not belong to the reference region
    const overlay = (layoutPath: string) =>
        path(page, layoutPath).getByTestId("refused-overlay");
    await startDrag(page, path(page, "/ts1/tb0"));
    for (const [index, point] of refused.entries()) {
        await moveDragTo(page, point);
        await expect(indicator).toBeHidden();
        // over the tabset itself (not the layout's edge), the whole region turns red
        if (index < 5) {
            await expect(overlay("/ts0")).toBeVisible();
            const covered = await overlay("/ts0").boundingBox();
            const tabset = await box(page, "/ts0");
            // inside the tabset's border, so a few pixels smaller at most
            expect(covered?.width ?? 0).toBeGreaterThan(tabset.width - 6);
            expect(covered?.height ?? 0).toBeGreaterThan(tabset.height - 6);
        }
        await expect(overlay("/ts1")).toBeHidden();
    }
    await page.mouse.up();
    await expect(overlay("/ts0")).toBeHidden();
    expect(await tabs(page)).toEqual(before);

    // the console takes nothing: no merge (enableDrop) and no split (enableDivide)
    const console = await box(page, "/ts2/content");
    await startDrag(page, path(page, "/ts1/tb0"));
    for (const point of [
        await centre(path(page, "/ts2/content")),
        { x: console.x + 10, y: console.y + console.height / 2 },
    ]) {
        await moveDragTo(page, point);
        await expect(indicator).toBeHidden();
        await expect(overlay("/ts2")).toBeVisible();
    }
    await page.mouse.up();
    await expect(overlay("/ts2")).toBeHidden();
    expect(await tabs(page)).toEqual(before);
    // and its tabs cannot be dragged (enableDrag)
    await expect(path(page, "/ts2/tb0")).toHaveAttribute("draggable", "false");

    // the middleware vetoes a move that does not come from a drag
    await path(page, "/ts1/t0")
        .getByRole("button", { name: "Move to Reference from code" })
        .click();
    await expect(page.getByRole("status")).toHaveText(/vetoed/);
    expect(await tabs(page)).toEqual(before);
});

test("a tab that belongs to the region can still be dropped there", async ({
    page,
}) => {
    await openExample(page, "locked-regions");
    const indicator = path(page, "/outline");
    await startDrag(page, path(page, "/ts1/tb1")); // "API reference"
    await moveDragTo(page, await centre(path(page, "/ts0/content")));
    await expect(indicator).toBeVisible();
    // an allowed drop shows nothing red
    await expect(
        path(page, "/ts0").getByTestId("refused-overlay"),
    ).toBeHidden();
    await page.mouse.up();
    await expect(path(page, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Spec",
        "Glossary",
        "API reference",
    ]);
});

test("a refused target marks the root and the tabset, and shows why", async ({
    page,
}) => {
    await openExample(page, "locked-regions");
    await startDrag(page, path(page, "/ts1/tb0")); // "Draft" is not a reference tab
    await moveDragTo(page, await centre(path(page, "/ts1/content")));
    await expect(path(page, "/layout")).not.toHaveAttribute(
        "data-drop-refused",
    );

    await moveDragTo(page, await centre(path(page, "/ts0/content")));
    await expect(path(page, "/layout")).toHaveAttribute(
        "data-drop-refused",
        "",
    );
    await expect(path(page, "/ts0")).toHaveAttribute("data-drop-refused", "");
    await expect(path(page, "/ts0").getByTestId("refused-overlay")).toHaveText(
        "Not allowed here",
    );
    await expect(
        path(page, "/ts0").getByTestId("refused-overlay"),
    ).toBeVisible();

    await page.mouse.up();
    await expect(path(page, "/layout")).not.toHaveAttribute(
        "data-drop-refused",
    );
    await expect(
        path(page, "/ts0").getByTestId("refused-overlay"),
    ).toBeHidden();
});
