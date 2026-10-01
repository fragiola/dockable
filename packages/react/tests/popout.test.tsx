import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type Model,
    POPOUT_ATTRIBUTE,
    type TabOf,
    windowPath,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";
import {
    Counter,
    mounts,
    renderNode,
    renderPanel,
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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** the fixture layout, with popouts allowed on every tab */
const popoutJson = (): LayoutJson<Types> => ({
    ...structuredClone(twoTabsets),
    defaults: { tab: { enablePopout: true } },
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

function App({
    model,
    panel = renderPanel,
}: {
    model: Model<Types>;
    panel?: (tab: TabOf<Types>) => React.ReactNode;
}) {
    return (
        <Dockable.Root model={model} supportsPopout data-testid="root">
            <Dockable.Row<Types>>{renderNode}</Dockable.Row>
            <Dockable.Panels<Types>>{panel}</Dockable.Panels>
            <Dockable.Popout<Types> data-testid="popout">
                {() => <Dockable.Row<Types>>{renderNode}</Dockable.Row>}
            </Dockable.Popout>
        </Dockable.Root>
    );
}

/** runs `tab.popout`, returns the window layout's id */
function popoutTab(model: Model<Types>, tab: string): string {
    let layoutId = "";
    act(() => {
        const result = model.run("tab.popout", { tabId: tab });
        if (!result.ok) throw new Error(result.error.message);
        layoutId = result.value.windowId;
    });
    return layoutId;
}

async function popOut(model: Model<Types>, tab: string) {
    const layoutId = popoutTab(model, tab);
    const win = opened.at(-1);
    if (!win) throw new Error("no window opened");
    await act(async () => {
        await loads.get(win);
        await tick();
    });
    return { win, layoutId };
}

describe("Dockable.Popout", () => {
    it("opens a window per window layout and renders nothing until it is ready", () => {
        const model = popoutModel();
        render(<App model={model} />);
        popoutTab(model, "t2");
        expect(window.open).toHaveBeenCalledTimes(1);
        const win = opened[0];
        expect(win?.document.querySelector(`[${POPOUT_ATTRIBUTE}]`)).toBeNull();
        expect(screen.queryByTestId("popout")).toBeNull();
    });

    it("portals the window layout into the popout document once ready", async () => {
        const model = popoutModel();
        render(<App model={model} />);
        const { win, layoutId } = await popOut(model, "t2");

        expect(model.get("layout-id-by-node-id", { nodeId: "t2" })).toBe(
            layoutId,
        );
        const root = win.document.querySelector(`[${POPOUT_ATTRIBUTE}]`);
        expect(root?.getAttribute(POPOUT_ATTRIBUTE)).toBe(layoutId);
        const popout = root?.querySelector<HTMLElement>(
            '[data-testid="popout"]',
        );
        expect(popout).toBeTruthy();
        expect(popout?.style.position).toBe("absolute");
        expect(popout?.getAttribute("data-layout-path")).toBe(windowPath(1));
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
        render(<App model={model} />);
        fireEvent.click(screen.getByTestId("inc-t2"));
        fireEvent.change(screen.getByTestId("input-t2"), {
            target: { value: "kept" },
        });
        const content = screen.getByTestId("content-t2");

        const { win } = await popOut(model, "t2");
        expect(win.document.contains(content)).toBe(true);
        expect(content.querySelector("button")?.textContent).toBe("count 1");

        // dock back: move the tab into the main layout
        act(() => {
            model.run("tab.move", { tabId: "t2", to: "ts0", index: -1 });
        });
        await act(async () => {
            await tick();
        });
        expect(model.get("layout-id-by-node-id", { nodeId: "t2" })).toBe(
            MAIN_LAYOUT,
        );
        expect(document.contains(content)).toBe(true);
        expect(screen.getByTestId("inc-t2").textContent).toBe("count 1");
        expect(screen.getByTestId("input-t2")).toHaveValue("kept");
        expect(mounts.get("t2")).toBe(1);
        expect(model.state.windows).toHaveLength(0);
        expect(win.close).toHaveBeenCalled(); // the emptied window layout is gone
    });

    it("remounts the content on a window change only with remountInWindow", async () => {
        const model = popoutModel();
        render(
            <App
                model={model}
                panel={(tab) => (
                    <Dockable.Panel
                        node={tab}
                        remountInWindow={tab.id === "t2"}
                    >
                        <Counter id={tab.id} />
                    </Dockable.Panel>
                )}
            />,
        );
        expect(mounts.get("t0")).toBe(1);
        expect(mounts.get("t2")).toBe(1);
        await popOut(model, "t2");
        expect(mounts.get("t2")).toBe(2);
    });

    it("keeps the content mounted on a window change without remountInWindow", async () => {
        const model = popoutModel();
        render(<App model={model} />);
        expect(mounts.get("t2")).toBe(1);
        await popOut(model, "t2");
        expect(mounts.get("t2")).toBe(1);
    });

    it("opens exactly one window under StrictMode", async () => {
        const model = popoutModel();
        render(
            <React.StrictMode>
                <App model={model} />
            </React.StrictMode>,
        );
        await popOut(model, "t2");
        await act(async () => {
            await tick();
        });
        expect(window.open).toHaveBeenCalledTimes(1);
        expect(opened[0]?.close).not.toHaveBeenCalled();
    });

    it("passes onOpen, onClose and title through to the window", async () => {
        const onOpen = vi.fn();
        const onClose = vi.fn();
        const model = popoutModel();
        render(
            <Dockable.Root model={model} supportsPopout>
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
                <Dockable.Popout<Types>
                    title={() => "Popped"}
                    onOpen={onOpen}
                    onClose={onClose}
                >
                    {() => <Dockable.Row<Types>>{renderNode}</Dockable.Row>}
                </Dockable.Popout>
            </Dockable.Root>,
        );
        const { win, layoutId } = await popOut(model, "t2");
        expect(onOpen).toHaveBeenCalledWith(
            expect.objectContaining({ id: layoutId }),
            win,
            win.document,
        );
        expect(win.document.title).toBe("Popped");
        act(() => {
            win.dispatchEvent(new Event("beforeunload"));
        });
        expect(onClose).toHaveBeenCalledWith(
            expect.objectContaining({ id: layoutId }),
            win,
            win.document,
        );
        // closing the window docks the tab back
        expect(model.get("layout-id-by-node-id", { nodeId: "t2" })).toBe(
            MAIN_LAYOUT,
        );
        expect(model.state.windows).toHaveLength(0);
    });

    it("calls the root's onPopoutOpen and onPopoutClose with the window layout", async () => {
        const onPopoutOpen = vi.fn();
        const onPopoutClose = vi.fn();
        const model = popoutModel();
        render(
            <Dockable.Root
                model={model}
                supportsPopout
                onPopoutOpen={onPopoutOpen}
                onPopoutClose={onPopoutClose}
            >
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
                <Dockable.Popout<Types>>
                    {() => <Dockable.Row<Types>>{renderNode}</Dockable.Row>}
                </Dockable.Popout>
            </Dockable.Root>,
        );
        const { win, layoutId } = await popOut(model, "t2");
        expect(onPopoutOpen).toHaveBeenCalledWith(
            expect.objectContaining({ id: layoutId }),
            win,
            win.document,
        );
        act(() => {
            win.dispatchEvent(new Event("beforeunload"));
        });
        expect(onPopoutClose).toHaveBeenCalledWith(
            expect.objectContaining({ id: layoutId }),
            win,
            win.document,
        );
    });

    it("opens the window through the root's openWindow", () => {
        const win = fakePopout();
        const openWindow = vi.fn(() => win);
        const model = popoutModel();
        render(
            <Dockable.Root model={model} supportsPopout openWindow={openWindow}>
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
                <Dockable.Popout<Types>>
                    {() => <Dockable.Row<Types>>{renderNode}</Dockable.Row>}
                </Dockable.Popout>
            </Dockable.Root>,
        );
        const layoutId = popoutTab(model, "t2");
        expect(openWindow).toHaveBeenCalledWith(
            `popout.html?id=${encodeURIComponent(layoutId)}`,
            expect.stringMatching(new RegExp(`^dockable-.*${layoutId}$`)),
            expect.stringContaining("width="),
        );
        expect(window.open).not.toHaveBeenCalled();
    });

    it("opens the window of a window layout already in the model at mount", () => {
        const model = popoutModel();
        model.run("tab.popout", { tabId: "t2" });
        render(<App model={model} />);
        expect(window.open).toHaveBeenCalledTimes(1);
    });

    it("marks tabs that can be popped out", () => {
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
                                data: { name: "A" },
                                enablePopout: true,
                            },
                            {
                                component: "test",
                                data: { name: "B" },
                                enablePopout: false,
                            },
                            { component: "test", data: { name: "C" } },
                        ],
                    },
                ],
            },
        });
        render(<App model={model} />);
        expect(
            document.querySelector('[data-layout-path="/ts0/tb0"]'),
        ).toHaveAttribute("data-popout-enabled", "");
        expect(
            document.querySelector('[data-layout-path="/ts0/tb1"]'),
        ).not.toHaveAttribute("data-popout-enabled");
        // popouts are opt-in: a tab without enablePopout (and no default) cannot pop out
        expect(
            document.querySelector('[data-layout-path="/ts0/tb2"]'),
        ).not.toHaveAttribute("data-popout-enabled");
    });
});
