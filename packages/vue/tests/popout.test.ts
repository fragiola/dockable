import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type Model,
    POPOUT_ATTRIBUTE,
    type RowNode,
    type TabOf,
    type TabsetNode,
    type WindowLayout,
} from "@fragiola/dockable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type VNodeChild } from "vue";
import type { RootProps } from "../src";
import {
    Counter,
    Dockable,
    mounts,
    render,
    renderNode,
    renderPanel,
    settle,
    type Types,
    twoTabsets,
} from "./layout";

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
const popoutJson = (): LayoutJson<Types> => ({
    ...structuredClone(twoTabsets),
    defaults: { tab: { poppable: true } },
});

const popoutModel = () => createModel<Types>(popoutJson());

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

type Child = TabsetNode<Types> | RowNode<Types>;

const row = () =>
    h(Dockable.Row, null, {
        default: ({ node }: { node: Child }) => [renderNode(node)],
    });

function app(
    model: Model<Types>,
    options: {
        panel?: (tab: TabOf<Types>) => VNodeChild;
        root?: Partial<RootProps<Types>>;
        popoutTestId?: string;
    } = {},
) {
    const { panel = renderPanel, root = {}, popoutTestId = "popout" } = options;
    return defineComponent({
        setup: () => () =>
            h(
                Dockable.Root,
                {
                    model,
                    supportsPopout: true,
                    "data-testid": "root",
                    ...root,
                },
                {
                    default: () => [
                        row(),
                        h(Dockable.Panels, null, {
                            default: ({ tab }: { tab: TabOf<Types> }) => [
                                panel(tab),
                            ],
                        }),
                        h(
                            Dockable.Popout,
                            { "data-testid": popoutTestId },
                            {
                                default: (_scope: {
                                    layout: WindowLayout<Types>;
                                }) => [row()],
                            },
                        ),
                    ],
                },
            ),
    });
}

/** runs `tab.popout`, returns the window layout's id */
function popoutTab(model: Model<Types>, tab: string): string {
    const result = model.run("tab.popout", { tabId: tab });
    if (!result.ok) throw new Error(result.error.message);
    return result.value.windowId;
}

async function popOut(model: Model<Types>, tab: string) {
    const layoutId = popoutTab(model, tab);
    const win = opened.at(-1);
    if (!win) throw new Error("no window opened");
    await loads.get(win);
    await settle();
    return { win, layoutId };
}

const testId = (id: string) => {
    const found = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!found) throw new Error(`no element ${id}`);
    return found;
};

describe("Dockable.Popout", () => {
    it("opens a window per window layout and renders nothing until it is ready", async () => {
        const model = popoutModel();
        await render(app(model));
        popoutTab(model, "t2");
        expect(window.open).toHaveBeenCalledTimes(1);
        const win = opened[0];
        expect(win?.document.querySelector(`[${POPOUT_ATTRIBUTE}]`)).toBeNull();
        expect(document.querySelector('[data-testid="popout"]')).toBeNull();
    });

    it("teleports the window layout into the popout document once ready", async () => {
        const model = popoutModel();
        await render(app(model));
        const { win, layoutId } = await popOut(model, "t2");

        expect(model.get("layout-id-by", { nodeId: "t2" })).toBe(layoutId);
        const root = win.document.querySelector(`[${POPOUT_ATTRIBUTE}]`);
        expect(root?.getAttribute(POPOUT_ATTRIBUTE)).toBe(layoutId);
        const popout = root?.querySelector<HTMLElement>(
            '[data-testid="popout"]',
        );
        expect(popout).toBeTruthy();
        expect(popout?.style.position).toBe("absolute");
        expect(popout?.getAttribute("data-layout-path")).toBe("/sublayout1");
        // the popout renders its own tab list, and the tab's panel lives in the popout document
        expect(win.document.querySelector('[role="tablist"]')).toBeTruthy();
        const tabs = [...win.document.querySelectorAll('[role="tab"]')];
        expect(tabs.map((tab) => tab.textContent)).toEqual(["Three"]);
        expect(
            win.document.querySelector('[data-testid="content-t2"]'),
        ).toBeTruthy();
    });

    it("keeps the content's state when a tab moves into the popout and back (no remount)", async () => {
        const model = popoutModel();
        await render(app(model));
        testId("inc-t2").dispatchEvent(
            new MouseEvent("click", { bubbles: true }),
        );
        await settle();
        (testId("input-t2") as HTMLInputElement).value = "kept";
        const content = testId("content-t2");

        const { win } = await popOut(model, "t2");
        expect(win.document.contains(content)).toBe(true);
        expect(content.querySelector("button")?.textContent).toBe("count 1");
        // the content still reacts in the popout document
        content
            .querySelector("button")
            ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await settle();
        expect(content.querySelector("button")?.textContent).toBe("count 2");

        // dock back: move the tab into the main layout
        model.run("tab.move", { tabId: "t2", to: "ts0", index: -1 });
        await settle();
        expect(model.get("layout-id-by", { nodeId: "t2" })).toBe(MAIN_LAYOUT);
        expect(document.contains(content)).toBe(true);
        expect(testId("inc-t2").textContent).toBe("count 2");
        expect((testId("input-t2") as HTMLInputElement).value).toBe("kept");
        expect(mounts.get("t2")).toBe(1);
        expect(model.state.windows).toHaveLength(0);
        expect(win.close).toHaveBeenCalled(); // the emptied window layout is gone
    });

    it("remounts the content on a window change only with remountInWindow", async () => {
        const model = popoutModel();
        await render(
            app(model, {
                panel: (tab) =>
                    h(
                        Dockable.Panel,
                        { node: tab, remountInWindow: tab.id === "t2" },
                        { default: () => [h(Counter, { id: tab.id })] },
                    ),
            }),
        );
        expect(mounts.get("t0")).toBe(1);
        expect(mounts.get("t2")).toBe(1);
        await popOut(model, "t2");
        expect(mounts.get("t2")).toBe(2);
    });

    it("keeps the content mounted on a window change without remountInWindow", async () => {
        const model = popoutModel();
        await render(app(model));
        expect(mounts.get("t2")).toBe(1);
        await popOut(model, "t2");
        expect(mounts.get("t2")).toBe(1);
    });

    it("opens exactly one window, and keeps it open", async () => {
        const model = popoutModel();
        await render(app(model));
        await popOut(model, "t2");
        await settle();
        expect(window.open).toHaveBeenCalledTimes(1);
        expect(opened[0]?.close).not.toHaveBeenCalled();
    });

    it("passes the root's popoutTitle, onPopoutOpen and onPopoutClose to the window", async () => {
        const onPopoutOpen = vi.fn();
        const onPopoutClose = vi.fn();
        const model = popoutModel();
        await render(
            app(model, {
                root: {
                    popoutTitle: (layout) => `Popped ${layout.id}`,
                    onPopoutOpen,
                    onPopoutClose,
                },
            }),
        );
        const { win, layoutId } = await popOut(model, "t2");
        expect(onPopoutOpen).toHaveBeenCalledWith(
            expect.objectContaining({ id: layoutId }),
            win,
            win.document,
        );
        expect(win.document.title).toBe(`Popped ${layoutId}`);
        win.dispatchEvent(new Event("beforeunload"));
        await settle();
        expect(onPopoutClose).toHaveBeenCalledWith(
            expect.objectContaining({ id: layoutId }),
            win,
            win.document,
        );
        // closing the window docks the tab back
        expect(model.get("layout-id-by", { nodeId: "t2" })).toBe(MAIN_LAYOUT);
        expect(model.get("windows")).toHaveLength(0);
    });

    it("opens the window through the root's openWindow", async () => {
        const win = fakePopout();
        const openWindow = vi.fn(() => win);
        const model = popoutModel();
        await render(app(model, { root: { openWindow } }));
        const layoutId = popoutTab(model, "t2");
        expect(openWindow).toHaveBeenCalledWith(
            `popout.html?id=${encodeURIComponent(layoutId)}`,
            expect.stringMatching(new RegExp(`^dockable-.*${layoutId}$`)),
            expect.stringContaining("width="),
        );
        expect(window.open).not.toHaveBeenCalled();
    });

    it("takes a bare boolean attribute as true, as a template writes it", async () => {
        // `<Dockable.Root supports-popout popout-mirror-root>` passes empty strings
        document.body.setAttribute("data-theme-test", "night");
        try {
            const model = popoutModel();
            const bare = {
                "supports-popout": "",
                "popout-mirror-root": "",
            } as unknown as Partial<RootProps<Types>>;
            await render(app(model, { root: { ...bare } }));
            const { win } = await popOut(model, "t2");
            expect(win.document.body.getAttribute("data-theme-test")).toBe(
                "night",
            );
        } finally {
            document.body.removeAttribute("data-theme-test");
        }
    });

    it("opens the window of a window layout already in the model at mount", async () => {
        const model = popoutModel();
        model.run("tab.popout", { tabId: "t2" });
        await render(app(model));
        expect(window.open).toHaveBeenCalledTimes(1);
    });

    it("marks tabs that can be popped out", async () => {
        const model = createModel<Types>({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "test",
                                label: "A",
                                data: { name: "A" },
                                poppable: true,
                            },
                            {
                                component: "test",
                                label: "B",
                                data: { name: "B" },
                                poppable: false,
                            },
                            {
                                component: "test",
                                label: "C",
                                data: { name: "C" },
                            },
                        ],
                    },
                ],
            },
        });
        await render(app(model));
        expect(
            document.querySelector('[data-layout-path="/ts0/tb0"]'),
        ).toHaveAttribute("data-poppable", "");
        expect(
            document.querySelector('[data-layout-path="/ts0/tb1"]'),
        ).not.toHaveAttribute("data-poppable");
        expect(
            document.querySelector('[data-layout-path="/ts0/tb2"]'),
        ).not.toHaveAttribute("data-poppable");
    });
});
