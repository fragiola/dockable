import { expect, type FrameLocator, type Page, test } from "@playwright/test";
import {
    centre,
    collectErrors,
    dragAcrossWindows,
    EXAMPLES,
    moveDragTo,
    startDrag,
    waitForPopout,
} from "./helpers";

// The examples as fragiola.com shows them: in an iframe of a same-origin page (e2e/serve.ts,
// /host.html), talking to it with the site export's messages (contract v1, §5.2). The popout
// window and the drag between windows start from inside the frame.

const BASE = "/dockable/embed/react/";

interface Message {
    type: string;
    id?: string;
    height?: number;
}

async function openHosted(page: Page, query: Record<string, string>) {
    await page.goto(`/host.html?${new URLSearchParams(query)}`);
    const frame = page.frameLocator('[data-testid="frame"]');
    await expect(
        frame.locator('[data-layout-path="/layout"]').first(),
    ).toBeVisible();
    return frame;
}

const messages = (page: Page) =>
    page.evaluate(
        () => (window as unknown as { messages: Message[] }).messages,
    );

const path = (frame: FrameLocator, layoutPath: string) =>
    frame.locator(`[data-layout-path="${layoutPath}"]`);

test("the embed says ready once, with no resize for a fill layout", async ({
    page,
}) => {
    await openHosted(page, { id: "hello-layout", theme: "paper" });
    await expect
        .poll(() => messages(page))
        .toContainEqual({ type: "fragiola:example:ready", id: "hello-layout" });
    await expect(page.getByTestId("frame")).toHaveCSS("opacity", "1");
    // a moment later, still one ready and nothing else
    await page.waitForTimeout(300);
    expect(await messages(page)).toEqual([
        { type: "fragiola:example:ready", id: "hello-layout" },
    ]);
});

test("the theme is applied before the first paint, and follows the site's message", async ({
    page,
}) => {
    const frame = await openHosted(page, {
        id: "hello-layout",
        theme: "paper",
    });
    // the example theme is on the frame's <body>, its scheme on <html>
    const body = frame.locator("body");
    const html = frame.locator("html");
    await expect(body).toHaveAttribute("data-example-theme", "paper");
    await expect(html).toHaveAttribute("data-theme", "light");

    // mark the frame's window: a reload would lose the mark
    await page.evaluate(() => {
        const frameWindow = document.querySelector("iframe")?.contentWindow as
            | (Window & { mark?: boolean })
            | null;
        if (frameWindow) frameWindow.mark = true;
    });
    const floor = () =>
        path(frame, "/layout")
            .first()
            .evaluate((el) => getComputedStyle(el).backgroundColor);
    const before = await floor();

    const send = (theme: string) =>
        page.evaluate((theme) => {
            document
                .querySelector("iframe")
                ?.contentWindow?.postMessage(
                    { type: "fragiola:example:theme", theme },
                    location.origin,
                );
        }, theme);

    await send("terminal");
    await expect(body).toHaveAttribute("data-example-theme", "terminal");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await expect(html).toHaveClass(/\bdark\b/);
    await expect.poll(floor).not.toBe(before);

    // an unknown theme is ignored
    await send("nope");
    await page.waitForTimeout(100);
    await expect(body).toHaveAttribute("data-example-theme", "terminal");

    const marked = await page.evaluate(
        () =>
            (
                document.querySelector("iframe")?.contentWindow as
                    | (Window & { mark?: boolean })
                    | null
            )?.mark,
    );
    expect(marked).toBe(true);
});

test("a missing or unknown theme falls back to the first light theme", async ({
    page,
}) => {
    const queries: Record<string, string>[] = [
        { id: "hello-layout" },
        { id: "hello-layout", theme: "nope" },
    ];
    for (const query of queries) {
        const frame = await openHosted(page, query);
        await expect(frame.locator("body")).toHaveAttribute(
            "data-example-theme",
            "light",
        );
        await expect(frame.locator("html")).toHaveAttribute(
            "data-theme",
            "light",
        );
    }
});

test("an unknown example says so, and is still ready", async ({ page }) => {
    await page.goto("/host.html?id=nope");
    const frame = page.frameLocator('[data-testid="frame"]');
    await expect(frame.getByRole("alert")).toHaveText('Unknown example "nope"');
    await expect
        .poll(() => messages(page))
        .toContainEqual({ type: "fragiola:example:ready", id: "nope" });
});

test("a popout opened from the frame lives under the embed's base and keeps the content", async ({
    page,
}) => {
    const frame = await openHosted(page, { id: "popout", theme: "terminal" });
    const panel = path(frame, "/ts0/t0");
    await panel.getByTestId("counter").click();
    await panel.getByTestId("notes").fill("kept");

    await path(frame, "/ts0")
        .getByRole("button", { name: "Pop out Editor" })
        .click();
    const [popout] = await waitForPopout(page);
    if (!popout) throw new Error("no popout");
    expect(new URL(popout.url()).pathname).toBe(`${BASE}popout.html`);
    await expect(popout.locator("body")).toHaveAttribute(
        "data-example-theme",
        "terminal",
    );
    const popped = popout.getByRole("tabpanel");
    await expect(popped.getByTestId("counter")).toHaveText("Count: 1");
    await expect(popped.getByTestId("notes")).toHaveValue("kept");

    // docking back empties the window, which closes it: click without waiting on it
    await popout
        .getByRole("button", { name: "Dock Editor back" })
        .evaluate((button) => {
            setTimeout(() => (button as HTMLElement).click(), 0);
        });
    await expect.poll(() => popout.isClosed()).toBe(true);
    const docked = frame
        .getByTestId("stage")
        .getByRole("tabpanel", { name: "Editor" });
    await expect(docked.getByTestId("counter")).toHaveText("Count: 1");
    await expect(docked.getByTestId("notes")).toHaveValue("kept");
});

test("tabs drag between the frame's layout and its popout, both ways", async ({
    page,
}) => {
    const frame = await openHosted(page, { id: "popout-drag" });
    await path(frame, "/ts1/t0").getByTestId("counter").click();

    await path(frame, "/ts0").getByTestId("popout-tab").click(); // "Orders" to a window
    const [popout] = await waitForPopout(page);
    if (!popout) throw new Error("no popout");
    await expect(popout.getByRole("tab")).toHaveText(["Orders"]);

    // "Chart" (in the frame) into the window
    await dragAcrossWindows(
        path(frame, "/ts1/tb0"),
        popout.getByRole("tabpanel").first(),
    );
    await expect(popout.getByRole("tab")).toHaveText(["Orders", "Chart"]);
    await expect(
        popout.getByRole("tabpanel", { name: "Chart" }).getByTestId("counter"),
    ).toHaveText("Count: 1");

    // and back into the frame's first tabset
    await dragAcrossWindows(
        popout.getByRole("tab", { name: "Chart" }),
        path(frame, "/ts0/t0"),
    );
    await expect(popout.getByRole("tab")).toHaveText(["Orders"]);
    await expect(path(frame, "/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Customers",
        "Invoices",
        "Chart",
    ]);
});

for (const { slug } of EXAMPLES) {
    test(`${slug} runs in a frame`, async ({ page }) => {
        const errors = collectErrors(page);
        await openHosted(page, { id: slug, theme: "dark" });
        await expect
            .poll(() => messages(page))
            .toContainEqual({ type: "fragiola:example:ready", id: slug });
        expect(errors).toEqual([]);
    });
}

test("a tab drags with the mouse inside the frame", async ({ page }) => {
    const frame = await openHosted(page, { id: "drag-and-drop" });
    const root = path(frame, "/layout");
    await startDrag(page, path(frame, "/ts0/tb1"));
    await expect(root).toHaveAttribute("data-dragging", "");
    await moveDragTo(page, await centre(path(frame, "/r1/ts0/content")));
    await expect(path(frame, "/outline")).toHaveAttribute(
        "data-drop-location",
        "center",
    );
    await page.mouse.up();
    await expect(path(frame, "/r1/ts0/tabstrip").getByRole("tab")).toHaveText([
        "Inbox",
        "Or me",
    ]);
    await expect(root).not.toHaveAttribute("data-dragging");
});
