import { expect, type Page, test } from "@playwright/test";
import { openExample, path } from "../helpers";

// The console runs commands given as JSON through model.dispatch: a valid one changes the layout,
// an invalid one comes back as a structured error and changes nothing.

async function run(page: Page, input: unknown) {
    await page.getByTestId("command-input").fill(JSON.stringify(input));
    await page.getByRole("button", { name: "Run", exact: true }).click();
}

test("runs tab.select and tab.move typed as JSON, and logs them", async ({
    page,
}) => {
    await openExample(page, "command-console");
    await expect(path(page, "/ts0/tb0")).toHaveAttribute("data-selected", "");

    await run(page, { command: "tab.select", payload: { tabId: "todo" } });
    await expect(page.getByTestId("result")).toContainText("ok");
    await expect(path(page, "/ts0/tb1")).toHaveAttribute("data-selected", "");
    await expect(page.getByTestId("log")).toContainText("tab.select");

    // the right tabset empties and goes: the moved tab is the third of the only tabset
    await run(page, {
        command: "tab.move",
        payload: { tabId: "ideas", to: "left" },
    });
    await expect(path(page, "/ts0/tb2")).toHaveText("Ideas");
    await expect(path(page, "/ts1")).toHaveCount(0);
    await expect(page.getByTestId("log")).toContainText("tab.move");
});

test("an invalid payload comes back as a structured error and changes nothing", async ({
    page,
}) => {
    await openExample(page, "command-console");
    await run(page, { command: "tab.move", payload: { tabId: 3 } });
    const result = page.getByTestId("result");
    await expect(result.getByRole("alert")).toContainText("invalid_payload");
    await expect(result).toContainText("/payload/to");
    await expect(result).toContainText("/payload/tabId");
    await expect(page.getByTestId("log")).toBeEmpty();
    await expect(path(page, "/ts1/tb0")).toHaveText("Ideas");

    await run(page, { command: "tab.nope", payload: {} });
    await expect(result).toContainText("unknown_command");
});

test("lists every built-in command with its payload fields, and as AI tools", async ({
    page,
}) => {
    await openExample(page, "command-console");
    await page.getByRole("button", { name: "Commands" }).click();
    const list = page.getByTestId("command-list");
    await expect(list.locator("[data-command]")).toHaveCount(24);
    const move = list.locator('[data-command="tab.move"]');
    await expect(move).toContainText("tab");
    await expect(move).toContainText("location?");

    await page.getByRole("button", { name: "As AI tools" }).click();
    const tools = page.getByTestId("tool-definitions");
    await expect(tools).toContainText('"name": "tab_select"');
    await expect(tools).toContainText('"input_schema"');
    await expect(page.getByTestId("tool-call")).toContainText(
        'model.dispatch({"command":"tab.select","payload":{"tab":"todo"}})',
    );
});
