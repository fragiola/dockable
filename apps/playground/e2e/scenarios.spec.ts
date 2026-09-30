import { expect, type Page, test } from "@playwright/test";
import { dragOver, findPath, Location } from "./helpers";

// Scenarios are dev-only entries of the playground; the Inspector shows what a scenario's model
// does. The package's behaviour itself is covered by the fixture specs.

const inspector = (page: Page) =>
    page.getByRole("complementary", { name: "Inspector" });

const actionTypes = (page: Page) => inspector(page).getByTestId("action-type");

async function openActions(page: Page) {
    await page.goto("/?scenario=api/actions&inspect=1");
    await expect(findPath(page, "/layout").first()).toBeVisible();
    await expect(inspector(page)).toBeVisible();
}

test("lists the scenarios by area, and opens one from the sidebar", async ({
    page,
}) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Playground" });
    await expect(nav.getByRole("heading", { name: "Scenarios" })).toBeVisible();
    await nav.getByRole("link", { name: "Drop indicator motion" }).click();
    await expect(page).toHaveURL(/\?scenario=drag%2Fdrop-indicator-motion$/);
    await expect(
        page
            .getByRole("region", { name: "None" })
            .locator('[data-layout-path="/layout"]'),
    ).toBeVisible();
    // the Inspector is offered only to an entry that registers a model
    await expect(page.getByRole("button", { name: "Inspector" })).toHaveCount(
        0,
    );
});

test("logs each action a button dispatches, and the model JSON follows", async ({
    page,
}) => {
    await openActions(page);
    await expect(
        inspector(page).getByText("every change is an action"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Add tab" }).click();
    await expect(actionTypes(page).first()).toHaveText("FlexLayout_AddTab");
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(actionTypes(page).first()).toHaveText("FlexLayout_RenameTab");
    await page.getByRole("button", { name: "Add two (group)" }).click();
    await expect(actionTypes(page).first()).toHaveText("FlexLayout_Group");
    // one listener: each action is logged once, also under StrictMode
    await expect(actionTypes(page)).toHaveCount(3);

    await inspector(page).getByRole("button", { name: "Model" }).click();
    await expect(inspector(page).getByTestId("model-json")).toContainText(
        '"name": "New 1*"',
    );

    await inspector(page).getByRole("button", { name: "Actions" }).click();
    await inspector(page).getByRole("button", { name: "Clear" }).click();
    await expect(actionTypes(page)).toHaveCount(0);
});

test("shows the drag state live, and logs the drop", async ({ page }) => {
    await openActions(page);
    await inspector(page).getByRole("button", { name: "State" }).click();
    const layoutState = inspector(page).locator('[data-state-path="/layout"]');
    await expect(layoutState).toBeVisible();
    await expect(layoutState).not.toContainText("data-dragging");

    const drop = await dragOver(
        page,
        findPath(page, "/ts0/tb1"),
        findPath(page, "/r1/ts0/content"),
        Location.CENTER,
    );
    await expect(layoutState).toContainText("data-dragging");
    await expect(
        inspector(page).locator('[data-state-path="/r1/ts0"]'),
    ).toContainText('data-drop-location="center"');
    await drop();
    await expect(layoutState).not.toContainText("data-dragging");

    await inspector(page).getByRole("button", { name: "Actions" }).click();
    await expect(actionTypes(page)).toContainText(["FlexLayout_MoveNode"]);
});

test("switching away and back leaves one listener on the scenario's model", async ({
    page,
}) => {
    await openActions(page);
    const nav = page.getByRole("navigation", { name: "Playground" });
    await nav.getByRole("link", { name: "Hello layout" }).click();
    await expect(inspector(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Inspector" })).toHaveCount(
        0,
    );
    await page.goBack();
    await expect(inspector(page)).toBeVisible();
    await page.getByRole("button", { name: "Add tab" }).click();
    await expect(actionTypes(page)).toHaveCount(1);
});
