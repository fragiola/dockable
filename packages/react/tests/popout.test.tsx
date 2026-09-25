import {
    Actions,
    DockLocation,
    type IJsonModel,
    Model,
    POPOUT_ATTRIBUTE,
    type TabNode,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";
import { mounts, renderNode, renderPanel, twoTabsets } from "./layout";

const loads = new WeakMap<Window, Promise<void>>();

/** an iframe's window stands in for the popout window; it fires its own load, asynchronously */
function fakePopout() {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const win = iframe.contentWindow as Window;
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

function App({ model }: { model: Model }) {
    return (
        <Dockable.Root model={model} supportsPopout data-testid="root">
            <Dockable.Row>{renderNode}</Dockable.Row>
            <Dockable.Panels>{renderPanel}</Dockable.Panels>
            <Dockable.Popout data-testid="popout">
                {() => <Dockable.Row>{renderNode}</Dockable.Row>}
            </Dockable.Popout>
        </Dockable.Root>
    );
}

async function popOut(model: Model, tabId: string) {
    act(() => {
        model.doAction(Actions.popoutTab(tabId, "window"));
    });
    const win = opened.at(-1);
    if (!win) throw new Error("no window opened");
    await act(async () => {
        await loads.get(win);
        await tick();
    });
    return win;
}

describe("Dockable.Popout", () => {
    it("opens a window per window layout and renders nothing until it is ready", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(<App model={model} />);
        act(() => {
            model.doAction(Actions.popoutTab("t2", "window"));
        });
        expect(window.open).toHaveBeenCalledTimes(1);
        const win = opened[0] as Window;
        expect(win.document.querySelector(`[${POPOUT_ATTRIBUTE}]`)).toBeNull();
        expect(screen.queryByTestId("popout")).toBeNull();
    });

    it("portals the window layout into the popout document once ready", async () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(<App model={model} />);
        const win = await popOut(model, "t2");

        const root = win.document.querySelector(`[${POPOUT_ATTRIBUTE}]`);
        const popout = root?.querySelector<HTMLElement>(
            '[data-testid="popout"]',
        );
        expect(popout).toBeTruthy();
        expect(popout?.style.position).toBe("absolute");
        const path = model
            .getLayouts()
            .get((model.getNodeById("t2") as TabNode).getLayoutId())
            ?.getPath();
        expect(popout?.getAttribute("data-layout-path")).toBe(path);
        // the popout renders its own tab list, and the tab's panel lives in the popout document
        expect(win.document.querySelector('[role="tablist"]')).toBeTruthy();
        expect(win.document.getElementById("dockable-tab-t2")).toBeTruthy();
        expect(
            win.document.querySelector('[data-testid="content-t2"]'),
        ).toBeTruthy();
    });

    it("keeps the content's state when a tab moves into the popout and back (no remount)", async () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(<App model={model} />);
        fireEvent.click(screen.getByTestId("inc-t2"));
        fireEvent.change(screen.getByTestId("input-t2"), {
            target: { value: "kept" },
        });
        const content = screen.getByTestId("content-t2");

        const win = await popOut(model, "t2");
        expect(win.document.contains(content)).toBe(true);
        expect(content.querySelector("button")?.textContent).toBe("count 1");

        // dock back: move the tab into the main layout
        act(() => {
            model.doAction(
                Actions.moveNode("t2", "ts0", DockLocation.CENTER, -1),
            );
        });
        await act(async () => {
            await tick();
        });
        expect(document.contains(content)).toBe(true);
        expect(screen.getByTestId("inc-t2").textContent).toBe("count 1");
        expect((screen.getByTestId("input-t2") as HTMLInputElement).value).toBe(
            "kept",
        );
        expect(mounts.get("t2")).toBe(1);
        expect(win.close).toHaveBeenCalled(); // the emptied window layout is gone
    });

    it("remounts the content on a window change only with enableWindowReMount", async () => {
        const json: IJsonModel = structuredClone(twoTabsets);
        const tabset = json.layout.children?.[1] as {
            children: { enableWindowReMount?: boolean }[];
        };
        if (tabset.children[0]) tabset.children[0].enableWindowReMount = true;
        const model = Model.fromJson(json);
        render(<App model={model} />);
        expect(mounts.get("t2")).toBe(1);
        await popOut(model, "t2");
        expect(mounts.get("t2")).toBe(2);
    });

    it("opens exactly one window under StrictMode", async () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
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
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(
            <Dockable.Root model={model} supportsPopout>
                <Dockable.Row>{renderNode}</Dockable.Row>
                <Dockable.Panels>{renderPanel}</Dockable.Panels>
                <Dockable.Popout
                    title={() => "Popped"}
                    onOpen={onOpen}
                    onClose={onClose}
                >
                    {() => <Dockable.Row>{renderNode}</Dockable.Row>}
                </Dockable.Popout>
            </Dockable.Root>,
        );
        const win = await popOut(model, "t2");
        expect(onOpen).toHaveBeenCalledWith(
            expect.anything(),
            win,
            win.document,
        );
        expect(win.document.title).toBe("Popped");
        act(() => {
            win.dispatchEvent(new Event("beforeunload"));
        });
        expect(onClose).toHaveBeenCalled();
        // the default close policy docks the tab back
        expect((model.getNodeById("t2") as TabNode).getLayoutId()).toBe(
            Model.MAIN_LAYOUT_ID,
        );
    });

    it("marks tabs that can be popped out", () => {
        const model = Model.fromJson({
            global: {},
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "A", enablePopout: true },
                            { type: "tab", name: "B", enablePopout: false },
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
    });
});
