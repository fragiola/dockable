import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type Model,
    POPOUT_ATTRIBUTE,
} from "@fragiola/dockable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mustTestId } from "./helpers";
import { mounts, renderLayout, settle, type Types, twoTabsets } from "./layout";

const loads = new WeakMap<Window, Promise<void>>();

/** an iframe's window stands in for the popout window; it fires its own load, asynchronously */
function fakePopout() {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) throw new Error("no iframe window");
    loads.set(
        win,
        new Promise((resolve) =>
            win.addEventListener("load", () => resolve(), { once: true }),
        ),
    );
    Object.assign(win, {
        resizeTo: vi.fn(),
        moveTo: vi.fn(),
        resizeBy: vi.fn(),
        moveBy: vi.fn(),
        focus: vi.fn(),
        close: vi.fn(),
    });
    return win;
}

/** the fixture layout, with popouts allowed on every tab */
const popoutModel = () =>
    createModel<Types>({
        ...structuredClone(twoTabsets),
        defaults: { tab: { poppable: true } },
    } satisfies LayoutJson<Types>);

let opened: Window[] = [];

beforeEach(() => {
    opened = [];
    mounts.clear();
    vi.spyOn(window, "open").mockImplementation(() => {
        const win = fakePopout();
        opened.push(win);
        return win;
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

async function popOut(model: Model<Types>, tab: string) {
    const result = model.run("tab.popout", { tabId: tab });
    if (!result.ok) throw new Error(result.error.message);
    const win = opened.at(-1);
    if (!win) throw new Error("no window opened");
    await loads.get(win);
    await settle();
    return { win, layoutId: result.value.windowId };
}

describe("[dockablePopout]", () => {
    it("opens a window per window layout and renders nothing until it is ready", async () => {
        const model = popoutModel();
        await renderLayout(model, { supportsPopout: true });
        model.run("tab.popout", { tabId: "t2" });
        expect(window.open).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[data-testid="popout"]')).toBeNull();
    });

    it("renders the window layout into the popout document once ready", async () => {
        const model = popoutModel();
        await renderLayout(model, { supportsPopout: true });
        const { win, layoutId } = await popOut(model, "t2");

        const root = win.document.querySelector(`[${POPOUT_ATTRIBUTE}]`);
        expect(root?.getAttribute(POPOUT_ATTRIBUTE)).toBe(layoutId);
        const popout = root?.querySelector<HTMLElement>(
            '[data-testid="popout"]',
        );
        expect(popout).toBeTruthy();
        expect(popout?.style.position).toBe("absolute");
        expect(popout?.getAttribute("data-layout-path")).toBe("/sublayout1");
        // the popout renders its own tab list, and the tab's panel lives in the popout document
        const tabs = [...win.document.querySelectorAll('[role="tab"]')];
        expect(tabs.map((tab) => tab.textContent)).toEqual(["Three"]);
        expect(
            win.document.querySelector('[data-testid="content-t2"]'),
        ).toBeTruthy();
    });

    it("keeps the content's state when a tab moves into the popout and back (never re-created)", async () => {
        const model = popoutModel();
        await renderLayout(model, { supportsPopout: true });
        mustTestId("inc-t2").click();
        await settle();
        (mustTestId("input-t2") as HTMLInputElement).value = "kept";
        const content = mustTestId("content-t2");

        const { win } = await popOut(model, "t2");
        expect(win.document.contains(content)).toBe(true);
        expect(content.querySelector("button")?.textContent).toContain(
            "count 1",
        );
        // the content still reacts in the popout document
        content
            .querySelector("button")
            ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await settle();
        expect(content.querySelector("button")?.textContent).toContain(
            "count 2",
        );

        // dock back: move the tab into the main layout
        model.run("tab.move", { tabId: "t2", to: "ts0", index: -1 });
        await settle();
        expect(model.get("layout-id-by", { nodeId: "t2" })).toBe(MAIN_LAYOUT);
        expect(document.contains(content)).toBe(true);
        expect(mustTestId("inc-t2")).toHaveTextContent("count 2");
        expect(mustTestId("input-t2")).toHaveValue("kept");
        expect(mounts.get("t2")).toBe(1);
        expect(win.close).toHaveBeenCalled();
    });

    it("re-creates the content on a window change only with remountInWindow", async () => {
        const model = popoutModel();
        await renderLayout(model, {
            supportsPopout: true,
            remountInWindow: "t2",
        });
        expect(mounts.get("t2")).toBe(1);
        const { win } = await popOut(model, "t2");
        expect(mounts.get("t2")).toBe(2);
        // one content, in the window
        expect(
            win.document.querySelectorAll('[data-testid="content-t2"]'),
        ).toHaveLength(1);
        expect(document.querySelector('[data-testid="content-t2"]')).toBeNull();
    });

    it("keeps the content on a window change without remountInWindow", async () => {
        const model = popoutModel();
        await renderLayout(model, { supportsPopout: true });
        await popOut(model, "t2");
        expect(mounts.get("t2")).toBe(1);
    });

    it("marks tabs that can be popped out", async () => {
        await renderLayout(popoutModel(), { supportsPopout: true });
        expect(
            document.querySelector('[data-layout-path="/ts0/tb0"]'),
        ).toHaveAttribute("data-poppable", "");
    });
});
