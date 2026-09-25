// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    Actions,
    ADOPTED_STYLES_ATTRIBUTE,
    createLayoutEngine,
    type IPopoutOptions,
    type LayoutEngine,
    Model,
    POPOUT_ATTRIBUTE,
    StyleMirror,
    type TabNode,
    type TabSetNode,
} from "../../src";

const json = {
    global: {},
    layout: {
        type: "row" as const,
        children: [
            {
                type: "tabset" as const,
                id: "ts0",
                children: [
                    { type: "tab" as const, id: "a", name: "A" },
                    { type: "tab" as const, id: "b", name: "B" },
                ],
            },
            {
                type: "tabset" as const,
                id: "ts1",
                children: [{ type: "tab" as const, id: "c", name: "C" }],
            },
        ],
    },
};

/** an iframe's window stands in for the popout window */
function fakePopout() {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const win = iframe.contentWindow as Window;
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

let engine: LayoutEngine | undefined;

beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
});

afterEach(() => {
    engine?.dispose();
    engine = undefined;
    vi.restoreAllMocks();
});

function setup(
    popout: IPopoutOptions = {},
    open: () => Window | null = fakePopout,
) {
    const model = Model.fromJson(structuredClone(json));
    engine = createLayoutEngine({
        model,
        popout: { supportsPopout: true, ...popout },
    });
    const root = document.body.appendChild(document.createElement("div"));
    engine.attachRoot(root);
    const opened: Window[] = [];
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => {
        const win = open();
        if (win) opened.push(win);
        return win;
    });
    model.doAction(Actions.popoutTab("b", "window"));
    const layoutId = [...model.getLayouts().keys()].find(
        (id) => id !== Model.MAIN_LAYOUT_ID,
    ) as string;
    const layout = model.getLayouts().get(layoutId);
    if (!layout) throw new Error("no window layout");
    return {
        model,
        engine,
        root,
        manager: engine.getPopoutManager(),
        layout,
        layoutId,
        opened,
        openSpy,
    };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function load(win: Window) {
    win.dispatchEvent(new Event("load"));
    await tick();
}

describe("opening", () => {
    it("opens popout.html?id=<layout> once per layout, with the layout's rect", () => {
        const { manager, layout, layoutId, openSpy } = setup();
        manager.open(layout);
        manager.open(layout);
        expect(openSpy).toHaveBeenCalledTimes(1);
        const rect = layout.getRect();
        expect(openSpy).toHaveBeenCalledWith(
            `popout.html?id=${encodeURIComponent(layoutId)}`,
            layoutId,
            `left=${rect.x},top=${rect.y},width=${rect.width},height=${rect.height}`,
        );
    });

    it("keeps one window through a StrictMode-style release and reopen", async () => {
        const { manager, layout, layoutId, openSpy, opened } = setup();
        manager.open(layout);
        manager.release(layoutId);
        manager.open(layout);
        await tick();
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(opened[0]?.close).not.toHaveBeenCalled();
        expect(manager.getWindow(layoutId)).toBe(opened[0]);
    });

    it("closes a released window after the current task", async () => {
        const { manager, layout, layoutId, opened } = setup();
        manager.open(layout);
        manager.release(layoutId);
        expect(opened[0]?.close).not.toHaveBeenCalled();
        await tick();
        expect(opened[0]?.close).toHaveBeenCalled();
        expect(manager.getWindow(layoutId)).toBeUndefined();
    });

    it("prepares the window on load: rect, lang/dir, content root, onPopoutOpen, then ready", async () => {
        document.documentElement.lang = "pt-BR";
        document.documentElement.dir = "rtl";
        const onPopoutOpen = vi.fn();
        const { manager, layout, layoutId, opened } = setup({
            onPopoutOpen,
            title: () => "Window",
        });
        const listener = vi.fn();
        manager.subscribe(listener);
        manager.open(layout);
        const win = opened[0] as Window;
        expect(manager.getContentRoot(layoutId)).toBeUndefined();

        await load(win);
        expect(win.resizeTo).toHaveBeenCalled();
        expect(win.moveTo).toHaveBeenCalled();
        expect(win.document.documentElement.lang).toBe("pt-BR");
        expect(win.document.documentElement.dir).toBe("rtl");
        expect(win.document.title).toBe("Window");
        expect(onPopoutOpen).toHaveBeenCalledWith(layout, win, win.document);
        const root = manager.getContentRoot(layoutId);
        expect(root?.getAttribute(POPOUT_ATTRIBUTE)).toBe(layoutId);
        expect(root?.ownerDocument).toBe(win.document);
        expect(listener).toHaveBeenCalled();
        document.documentElement.removeAttribute("lang");
        document.documentElement.removeAttribute("dir");
    });

    it("never titles the window unless the consumer does", async () => {
        const { manager, layout, opened } = setup();
        manager.open(layout);
        const win = opened[0] as Window;
        win.document.title = "host";
        await load(win);
        expect(win.document.title).toBe("host");
    });

    it("applies the close policy when the window cannot open", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { model, manager, layout, layoutId } = setup({}, () => null);
        manager.open(layout);
        expect(warn).toHaveBeenCalled();
        expect(model.getLayouts().has(layoutId)).toBe(false);
        expect((model.getNodeById("b") as TabNode).getLayoutId()).toBe(
            Model.MAIN_LAYOUT_ID,
        );
    });

    it("gives the popout layout its own engine and window id", async () => {
        const { manager, layout, layoutId, opened } = setup();
        manager.open(layout);
        const win = opened[0] as Window;
        await load(win);
        const sub = manager.getLayoutEngine(layoutId);
        const root = manager.getContentRoot(layoutId) as HTMLElement;
        sub?.attachRoot(root.appendChild(win.document.createElement("div")));
        expect(sub?.getMainEngine()).toBe(engine);
        expect(sub?.getWindowId()).toBeDefined();
        expect(sub?.getWindowId()).not.toBe(engine?.getWindowId());
        expect(layout.getWindow()).toBe(win);
    });
});

describe("opening edge cases", () => {
    it("opens a layout asked for before the engine was attached, once it attaches", () => {
        const model = Model.fromJson(structuredClone(json));
        model.doAction(Actions.popoutTab("b", "window"));
        const layout = [...model.getLayouts().values()].find(
            (l) => !l.isMainLayout(),
        );
        if (!layout) throw new Error("no window layout");
        engine = createLayoutEngine({
            model,
            popout: { supportsPopout: true },
        });
        const openSpy = vi
            .spyOn(window, "open")
            .mockImplementation(() => fakePopout());
        engine.getPopoutManager().open(layout);
        expect(openSpy).not.toHaveBeenCalled();

        engine.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        expect(openSpy).toHaveBeenCalledTimes(1);
    });

    it("docks the tabs back when popouts are not supported", () => {
        const { model, manager, layout, layoutId, openSpy } = setup({
            supportsPopout: false,
        });
        manager.open(layout);
        expect(openSpy).not.toHaveBeenCalled();
        expect(model.getLayouts().has(layoutId)).toBe(false);
    });

    it("hands a named window over to a new manager without closing it (model swap)", async () => {
        const first = setup();
        first.manager.open(first.layout);
        const win = first.opened[0] as Window;
        await load(win);

        // a second engine (a swapped-in model) reopens the same layout id: window.open returns the
        // same named window
        const model = Model.fromJson(first.model.toJson());
        const second = createLayoutEngine({
            model,
            popout: { supportsPopout: true },
        });
        second.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        first.openSpy.mockImplementation(() => win);
        const layout = model.getLayouts().get(first.layoutId);
        if (!layout) throw new Error("no layout");
        second.getPopoutManager().open(layout);

        first.manager.release(first.layoutId);
        await tick();
        expect(win.close).not.toHaveBeenCalled(); // the old manager let go without closing
        // the reload's beforeunload does not apply the old manager's close policy
        win.dispatchEvent(new Event("beforeunload"));
        expect(first.model.getLayouts().has(first.layoutId)).toBe(true);
        expect(second.getPopoutManager().getWindow(first.layoutId)).toBe(win);
        second.dispose();
    });
});

describe("close policies", () => {
    it("dock (default): closing the window moves its tabs back into the main layout", async () => {
        const onPopoutClose = vi.fn();
        const { model, manager, layout, layoutId, opened } = setup({
            onPopoutClose,
        });
        model.doAction(Actions.setActiveTabset("ts1"));
        manager.open(layout);
        const win = opened[0] as Window;
        await load(win);

        win.dispatchEvent(new Event("beforeunload"));
        expect(onPopoutClose).toHaveBeenCalledWith(layout, win, win.document);
        expect(model.getLayouts().has(layoutId)).toBe(false);
        expect(
            (model.getNodeById("ts1") as TabSetNode)
                .getChildren()
                .map((c) => c.getId()),
        ).toEqual(["c", "b"]);
        expect(manager.getWindow(layoutId)).toBeUndefined();
    });

    it("dock falls back to the first tabset without an active one", async () => {
        const { model, manager, layout, opened } = setup();
        manager.open(layout);
        const win = opened[0] as Window;
        await load(win);
        win.dispatchEvent(new Event("beforeunload"));
        expect(
            (model.getNodeById("ts0") as TabSetNode)
                .getChildren()
                .map((c) => c.getId()),
        ).toEqual(["a", "b"]);
    });

    it("float: closing the window turns the layout into a float, as FlexLayout does", async () => {
        const { model, manager, layout, layoutId, opened } = setup({
            closePolicy: "float",
        });
        manager.open(layout);
        const win = opened[0] as Window;
        await load(win);
        win.dispatchEvent(new Event("beforeunload"));
        expect(model.getLayouts().get(layoutId)?.getType()).toBe("float");
    });

    it("a programmatic close applies no policy", async () => {
        const { model, manager, layout, layoutId, opened } = setup();
        manager.open(layout);
        const win = opened[0] as Window;
        await load(win);
        manager.close(layoutId);
        win.dispatchEvent(new Event("beforeunload"));
        expect(model.getLayouts().has(layoutId)).toBe(true);
    });

    it("the main window unloading closes every popout", async () => {
        const { manager, layout, opened } = setup();
        manager.open(layout);
        // beforeunload alone does not close them: another handler may still cancel the unload
        window.dispatchEvent(new Event("beforeunload"));
        expect(opened[0]?.close).not.toHaveBeenCalled();
        window.dispatchEvent(new Event("pagehide"));
        expect(opened[0]?.close).toHaveBeenCalled();
        expect(manager.getOpenLayoutIds()).toEqual([]);
    });
});

describe("style mirroring", () => {
    it("copies <link> and <style> before the content renders, and mirrors mutations", async () => {
        const style = document.head.appendChild(
            document.createElement("style"),
        );
        style.textContent = ".one { color: red; }";
        const link = document.head.appendChild(document.createElement("link"));
        link.rel = "stylesheet";
        link.href = "data:text/css,.two{color:blue}";

        const { manager, layout, layoutId, opened } = setup();
        manager.open(layout);
        const win = opened[0] as Window;
        await load(win);

        const head = win.document.head;
        expect(head.querySelector("style")?.textContent).toBe(
            ".one { color: red; }",
        );
        const copiedLink = head.querySelector("link");
        expect(copiedLink?.getAttribute("href")).toBe(
            "data:text/css,.two{color:blue}",
        );
        // ready once the link loaded (or failed)
        copiedLink?.dispatchEvent(new Event("load"));
        await tick();
        expect(manager.getContentRoot(layoutId)).toBeDefined();

        // added, edited in place, removed
        // a preload link is not a stylesheet: not mirrored
        const preload = document.head.appendChild(
            document.createElement("link"),
        );
        preload.rel = "modulepreload";
        preload.href = "/x.js";
        const added = document.head.appendChild(
            document.createElement("style"),
        );
        added.textContent = ".three {}";
        await tick();
        expect(
            Array.from(head.querySelectorAll("style")).map(
                (s) => s.textContent,
            ),
        ).toContain(".three {}");
        expect(head.querySelector('link[rel="modulepreload"]')).toBeNull();

        // edit the text node in place, as css-in-js libraries do
        const text = style.firstChild;
        if (text) {
            text.textContent = ".one { color: green; }";
        }
        await tick();
        expect(
            Array.from(head.querySelectorAll("style")).map(
                (s) => s.textContent,
            ),
        ).toContain(".one { color: green; }");

        added.remove();
        await tick();
        expect(
            Array.from(head.querySelectorAll("style")).map(
                (s) => s.textContent,
            ),
        ).not.toContain(".three {}");
    });

    it("re-syncs CSSOM-inserted rules on the poll", async () => {
        const target = fakePopout().document;
        const style = document.head.appendChild(
            document.createElement("style"),
        );
        const mirror = new StyleMirror(document, target);
        await mirror.copyStyles();
        style.sheet?.insertRule(".cssom { color: red; }", 0);

        mirror.resyncChangedStyles();
        const clone = target.head.querySelector("style");
        expect(clone?.sheet?.cssRules[0]?.cssText).toContain(".cssom");
        mirror.dispose();
    });

    it("mirrors adopted (constructable) stylesheets", async () => {
        const target = document.implementation.createHTMLDocument("popout");
        Object.defineProperty(document, "adoptedStyleSheets", {
            configurable: true,
            value: [{ cssRules: [{ cssText: ".adopted { color: red; }" }] }],
        });
        const mirror = new StyleMirror(document, target);
        await mirror.copyStyles();
        expect(
            target.head.querySelector(`[${ADOPTED_STYLES_ATTRIBUTE}]`)
                ?.textContent,
        ).toContain(".adopted");
        mirror.dispose();
        Reflect.deleteProperty(document, "adoptedStyleSheets");
    });
});

describe("resources", () => {
    it("releases the observer, the poll and the listeners on close", async () => {
        const { manager, layout, layoutId, opened } = setup();
        manager.open(layout);
        const win = opened[0] as Window;
        const clearInterval = vi.spyOn(win, "clearInterval");
        const removeListener = vi.spyOn(win, "removeEventListener");
        await load(win);
        manager.close(layoutId);

        expect(clearInterval).toHaveBeenCalled();
        expect(removeListener).toHaveBeenCalledWith(
            "beforeunload",
            expect.any(Function),
        );
        document.head.appendChild(document.createElement("style")).textContent =
            ".late {}";
        await tick();
        expect(
            Array.from(win.document.head.querySelectorAll("style")).map(
                (s) => s.textContent,
            ),
        ).not.toContain(".late {}");
    });

    it("re-initializes on a popout reload without doubling the mirroring", async () => {
        const { manager, layout, layoutId, opened } = setup();
        manager.open(layout);
        const win = opened[0] as Window;
        const clearInterval = vi.spyOn(win, "clearInterval");
        await load(win);
        const before = clearInterval.mock.calls.length;
        await load(win); // a reload fires load again on the same window
        expect(clearInterval).toHaveBeenCalledTimes(before + 1);

        document.head.appendChild(document.createElement("style")).textContent =
            ".once {}";
        await tick();
        const copies = Array.from(
            win.document.head.querySelectorAll("style"),
        ).filter((s) => s.textContent === ".once {}");
        expect(copies).toHaveLength(1);
        expect(manager.getContentRoot(layoutId)?.isConnected).toBe(true);
    });

    it("dispose closes every window", async () => {
        const { manager, layout, opened } = setup();
        manager.open(layout);
        await load(opened[0] as Window);
        engine?.dispose();
        engine = undefined;
        expect(opened[0]?.close).toHaveBeenCalled();
        expect(manager.getOpenLayoutIds()).toEqual([]);
    });
});

describe("moveable elements across documents", () => {
    it("keep their identity when moved into the popout document and back", async () => {
        const { model, manager, layout, layoutId, opened, root } = setup();
        manager.open(layout);
        const win = opened[0] as Window;
        await load(win);
        const b = model.getNodeById("b") as TabNode;
        const moveable = engine?.getMoveableElement(b) as HTMLElement;
        expect(moveable.ownerDocument).toBe(document); // created in the main document
        const input = moveable.appendChild(document.createElement("input"));
        input.value = "kept";

        const popoutPanel = (
            manager.getContentRoot(layoutId) as HTMLElement
        ).appendChild(win.document.createElement("div"));
        engine?.attachMoveable(b, popoutPanel);
        expect(moveable.ownerDocument).toBe(win.document);
        expect(popoutPanel.firstChild).toBe(moveable);

        const mainPanel = root.appendChild(document.createElement("div"));
        engine?.attachMoveable(b, mainPanel);
        expect(moveable.ownerDocument).toBe(document);
        expect(mainPanel.firstChild).toBe(moveable);
        expect(input.value).toBe("kept");
    });
});
