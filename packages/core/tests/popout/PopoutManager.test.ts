// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    ADOPTED_STYLES_ATTRIBUTE,
    createLayoutEngine,
    createModel,
    type LayoutEngine,
    type LayoutJson,
    MAIN_LAYOUT,
    POPOUT_ATTRIBUTE,
    type PopoutOptions,
    StyleMirror,
    WINDOW_RECT_POLL_INTERVAL_MS,
} from "../../src";

const json: LayoutJson = {
    version: 1,
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    { id: "a", component: "x" },
                    { id: "b", component: "x" },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                children: [{ id: "c", component: "x" }],
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

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function load(win: Window) {
    win.dispatchEvent(new Event("load"));
    await tick();
}

/** an attached engine whose tab "b" pops out into a window (opened by `open`) */
function setup(
    popout: PopoutOptions = {},
    open: () => Window | null = fakePopout,
) {
    const model = createModel(structuredClone(json));
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
    const result = model.run("tab.popout", { tab: "b" });
    const layoutId = result.ok ? result.value.window : "";
    return {
        model,
        engine,
        root,
        manager: engine.getPopoutManager(),
        layoutId,
        layout: () => model.windowLayout(layoutId),
        opened,
        openSpy,
    };
}

describe("opening", () => {
    it("opens popout.html?id=<layout> once per window layout, with its rect", () => {
        const { model, engine, manager, layoutId, openSpy } = setup();
        manager.sync();
        manager.sync();
        expect(openSpy).toHaveBeenCalledTimes(1);
        const rect = model.windowLayout(layoutId)?.rect;
        // the name is scoped to the engine: two models may both have a "window-1"
        expect(openSpy).toHaveBeenCalledWith(
            `popout.html?id=${encodeURIComponent(layoutId)}`,
            `dockable-${engine.idScope}${layoutId}`,
            `left=${rect?.x},top=${rect?.y},width=${rect?.width},height=${rect?.height}`,
        );
    });

    it("opens with an injected opener", () => {
        const win = fakePopout();
        const openWindow = vi.fn(() => win);
        const { engine, manager, layoutId, openSpy } = setup({ openWindow });
        expect(openWindow).toHaveBeenCalledWith(
            `popout.html?id=${encodeURIComponent(layoutId)}`,
            `dockable-${engine.idScope}${layoutId}`,
            expect.stringContaining("width="),
        );
        expect(openSpy).not.toHaveBeenCalled();
        expect(manager.getWindow(layoutId)).toBe(win);
    });

    it("keeps one window through a StrictMode-style detach and reattach", async () => {
        const { engine, root, manager, layoutId, openSpy, opened } = setup();
        engine.detachRoot();
        engine.attachRoot(root);
        await tick();
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(opened[0]?.close).not.toHaveBeenCalled();
        expect(manager.getWindow(layoutId)).toBe(opened[0]);
    });

    it("closes the windows after the current task once the engine detaches", async () => {
        const { engine, manager, layoutId, opened } = setup();
        engine.detachRoot();
        expect(opened[0]?.close).not.toHaveBeenCalled();
        await tick();
        expect(opened[0]?.close).toHaveBeenCalled();
        expect(manager.getWindow(layoutId)).toBeUndefined();
    });

    it("closes the window of a layout that left the state", () => {
        const { model, manager, layoutId, opened } = setup();
        model.run("tab.close", { tab: "b" });
        expect(model.windowLayout(layoutId)).toBeUndefined();
        expect(opened[0]?.close).toHaveBeenCalled();
        expect(manager.getOpenLayoutIds()).toEqual([]);
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
        const win = opened[0] as Window;
        expect(manager.getContentRoot(layoutId)).toBeUndefined();

        await load(win);
        expect(win.resizeTo).toHaveBeenCalled();
        expect(win.moveTo).toHaveBeenCalled();
        expect(win.document.documentElement.lang).toBe("pt-BR");
        expect(win.document.documentElement.dir).toBe("rtl");
        expect(win.document.title).toBe("Window");
        expect(onPopoutOpen).toHaveBeenCalledWith(layout(), win, win.document);
        const root = manager.getContentRoot(layoutId);
        expect(root?.getAttribute(POPOUT_ATTRIBUTE)).toBe(layoutId);
        expect(root?.ownerDocument).toBe(win.document);
        expect(listener).toHaveBeenCalled();
        document.documentElement.removeAttribute("lang");
        document.documentElement.removeAttribute("dir");
    });

    it("never titles the window unless the consumer does", async () => {
        const { opened } = setup();
        const win = opened[0] as Window;
        win.document.title = "host";
        await load(win);
        expect(win.document.title).toBe("host");
    });

    it("docks the tabs back when the window cannot open", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { model, layoutId } = setup({}, () => null);
        expect(warn).toHaveBeenCalled();
        expect(model.windowLayout(layoutId)).toBeUndefined();
        expect(model.layoutOf("b")).toBe(MAIN_LAYOUT);
    });

    it("gives the popout layout its own engine", async () => {
        const { manager, layoutId, opened } = setup();
        const win = opened[0] as Window;
        await load(win);
        const sub = manager.getLayoutEngine(layoutId);
        const root = manager.getContentRoot(layoutId) as HTMLElement;
        sub?.attachRoot(root.appendChild(win.document.createElement("div")));
        expect(sub?.main).toBe(engine);
        expect(sub?.layoutId).toBe(layoutId);
        expect(sub?.isMainLayout()).toBe(false);
    });

    it("records the window's rect when it resizes, as a transient window.configure", async () => {
        const { model, layoutId, opened } = setup();
        const win = opened[0] as Window;
        await load(win);
        const events: { command: string; transient: boolean }[] = [];
        model.subscribe((event) => events.push(event));
        Object.defineProperty(win, "screenLeft", {
            configurable: true,
            value: 120,
        });
        Object.defineProperty(win, "screenTop", {
            configurable: true,
            value: 80,
        });
        Object.defineProperty(win, "outerWidth", {
            configurable: true,
            value: 640,
        });
        Object.defineProperty(win, "outerHeight", {
            configurable: true,
            value: 480,
        });
        win.dispatchEvent(new Event("resize"));
        expect(model.windowLayout(layoutId)?.rect).toEqual({
            x: 120,
            y: 80,
            width: 640,
            height: 480,
        });
        expect(events).toMatchObject([
            { command: "window.configure", transient: true },
        ]);
    });

    it("records a move by polling (a moved window fires no event), and nothing when it stayed put", async () => {
        const { model, layoutId, opened } = setup();
        const win = opened[0] as Window;
        const setInterval = vi.spyOn(win, "setInterval");
        await load(win);
        const poll = setInterval.mock.calls.find(
            (call) => call[1] === WINDOW_RECT_POLL_INTERVAL_MS,
        )?.[0];
        if (typeof poll !== "function") throw new Error("no rect poll");
        const rect = model.windowLayout(layoutId)?.rect;
        const at = (name: string, value: number | undefined) =>
            Object.defineProperty(win, name, { configurable: true, value });
        at("screenLeft", rect?.x);
        at("screenTop", rect?.y);
        at("outerWidth", rect?.width);
        at("outerHeight", rect?.height);
        const events: string[] = [];
        model.subscribe((event) => events.push(event.command));

        poll();
        win.dispatchEvent(new Event("resize"));
        expect(events).toEqual([]); // unchanged: no command

        at("screenLeft", 300);
        poll();
        expect(events).toEqual(["window.configure"]);
        expect(model.windowLayout(layoutId)?.rect.x).toBe(300);
    });

    it("names its windows apart from another model's with the same window ids", () => {
        const a = setup();
        const nameA = a.openSpy.mock.calls[0]?.[1];
        engine = undefined; // keep the first engine alive for the second setup
        const b = setup();
        const nameB = b.openSpy.mock.calls.at(-1)?.[1];
        expect(a.layoutId).toBe(b.layoutId);
        expect(nameA).not.toBe(nameB);
        a.engine.dispose();
    });
});

describe("opening edge cases", () => {
    it("opens the window layouts of a loaded layout once the engine attaches", () => {
        const model = createModel(structuredClone(json));
        model.run("tab.popout", { tab: "b" });
        engine = createLayoutEngine({
            model,
            popout: { supportsPopout: true },
        });
        const openSpy = vi
            .spyOn(window, "open")
            .mockImplementation(() => fakePopout());
        engine.getPopoutManager().sync();
        expect(openSpy).not.toHaveBeenCalled(); // not attached yet
        engine.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        expect(openSpy).toHaveBeenCalledTimes(1);
    });

    it("docks the tabs back when popouts are not supported", () => {
        const { model, layoutId, openSpy } = setup({ supportsPopout: false });
        expect(openSpy).not.toHaveBeenCalled();
        expect(model.windowLayout(layoutId)).toBeUndefined();
        expect(model.layoutOf("b")).toBe(MAIN_LAYOUT);
    });

    it("hands a named window over to a new engine without closing it", async () => {
        const first = setup();
        const win = first.opened[0] as Window;
        await load(win);
        // a second engine of the same model (a remount) opens the same layout id: window.open
        // returns the same named window
        first.openSpy.mockImplementation(() => win);
        const second = createLayoutEngine({
            model: first.model,
            popout: { supportsPopout: true },
        });
        second.attachRoot(
            document.body.appendChild(document.createElement("div")),
        );
        first.engine.detachRoot();
        await tick();
        expect(win.close).not.toHaveBeenCalled(); // the old manager let go without closing
        // the reload's beforeunload does not dock the layout back through the old manager
        win.dispatchEvent(new Event("beforeunload"));
        expect(first.model.windowLayout(first.layoutId)).toBeDefined();
        expect(second.getPopoutManager().getWindow(first.layoutId)).toBe(win);
        second.dispose();
    });
});

describe("closing", () => {
    it("closing the window from the browser docks its tabs back with window.close", async () => {
        const onPopoutClose = vi.fn();
        const { model, layout, layoutId, opened, manager } = setup({
            onPopoutClose,
        });
        model.run("tabset.activate", { tabset: "ts1" });
        const win = opened[0] as Window;
        await load(win);
        const windowLayout = layout();
        const commands: string[] = [];
        model.subscribe((event) => commands.push(event.command));

        win.dispatchEvent(new Event("beforeunload"));
        expect(onPopoutClose).toHaveBeenCalledWith(
            windowLayout,
            win,
            win.document,
        );
        expect(commands).toEqual(["window.close"]);
        expect(model.windowLayout(layoutId)).toBeUndefined();
        const ts1 = model.get("ts1");
        expect(ts1?.type === "tabset" && ts1.children.map((c) => c.id)).toEqual(
            ["c", "b"],
        );
        expect(manager.getWindow(layoutId)).toBeUndefined();
    });

    it("docks into the first tabset without an active one", async () => {
        const { model, opened } = setup();
        const win = opened[0] as Window;
        await load(win);
        win.dispatchEvent(new Event("beforeunload"));
        const ts0 = model.get("ts0");
        expect(ts0?.type === "tabset" && ts0.children.map((c) => c.id)).toEqual(
            ["a", "b"],
        );
    });

    it("closing a window from the manager does not dock its tabs back", async () => {
        const { model, manager, layoutId, opened } = setup();
        const win = opened[0] as Window;
        await load(win);
        manager.close(layoutId);
        win.dispatchEvent(new Event("beforeunload"));
        expect(model.windowLayout(layoutId)).toBeDefined();
    });

    it("the main window unloading closes every popout", () => {
        const { manager, opened } = setup();
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

        const { manager, layoutId, opened } = setup();
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
        const { manager, layoutId, opened } = setup();
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
        const { manager, layoutId, opened } = setup();
        const win = opened[0] as Window;
        const clearInterval = vi.spyOn(win, "clearInterval");
        await load(win);
        const before = clearInterval.mock.calls.length;
        await load(win); // a reload fires load again on the same window
        // the style poll and the window rect poll of the previous document
        expect(clearInterval).toHaveBeenCalledTimes(before + 2);

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
        const { manager, opened } = setup();
        await load(opened[0] as Window);
        engine?.dispose();
        engine = undefined;
        expect(opened[0]?.close).toHaveBeenCalled();
        expect(manager.getOpenLayoutIds()).toEqual([]);
    });
});

describe("moveable elements across documents", () => {
    it("keep their identity when moved into the popout document and back", async () => {
        const { manager, layoutId, opened, root } = setup();
        const win = opened[0] as Window;
        await load(win);
        const b = "b";
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

describe("root attribute mirroring (mirrorRoot)", () => {
    afterEach(() => {
        for (const name of ["data-theme", "class", "data-other"]) {
            document.documentElement.removeAttribute(name);
            document.body.removeAttribute(name);
        }
    });

    async function openWith(mirrorRoot: PopoutOptions["mirrorRoot"]) {
        const { manager, opened, layoutId } = setup({ mirrorRoot });
        const win = opened[0] as Window;
        await load(win);
        return { manager, win, layoutId };
    }

    it("copies only lang and dir by default", async () => {
        document.documentElement.dataset.theme = "dark";
        const { win } = await openWith(undefined);
        expect(win.document.documentElement.hasAttribute("data-theme")).toBe(
            false,
        );
    });

    it("copies every <html> and <body> attribute with true, and keeps them in sync", async () => {
        document.documentElement.dataset.theme = "dark";
        document.body.className = "palette-surface app";
        const { win } = await openWith(true);
        const html = win.document.documentElement;
        const body = win.document.body;
        expect(html.dataset.theme).toBe("dark");
        expect(body.classList.contains("palette-surface")).toBe(true);
        expect(body.classList.contains("app")).toBe(true);

        document.documentElement.dataset.theme = "light";
        document.body.classList.remove("app");
        document.body.classList.add("compact");
        await tick();
        expect(html.dataset.theme).toBe("light");
        expect(body.classList.contains("app")).toBe(false);
        expect(body.classList.contains("compact")).toBe(true);
        expect(body.classList.contains("palette-surface")).toBe(true);

        document.documentElement.removeAttribute("data-theme");
        await tick();
        expect(html.hasAttribute("data-theme")).toBe(false);
    });

    it("keeps the popout's own classes when the main document drops its class attribute", async () => {
        document.body.className = "app";
        const { win } = await openWith(true);
        const body = win.document.body;
        body.classList.add("popout-only");
        expect(body.classList.contains("app")).toBe(true);

        document.body.removeAttribute("class");
        await tick();
        expect(body.classList.contains("app")).toBe(false);
        expect(body.classList.contains("popout-only")).toBe(true);
    });

    it("copies only the listed attributes", async () => {
        document.documentElement.dataset.theme = "dark";
        document.documentElement.dataset.other = "x";
        const { win } = await openWith(["data-theme"]);
        expect(win.document.documentElement.dataset.theme).toBe("dark");
        expect(win.document.documentElement.hasAttribute("data-other")).toBe(
            false,
        );
    });

    it("stops syncing once the window is closed", async () => {
        document.documentElement.dataset.theme = "dark";
        const { manager, win, layoutId } = await openWith(true);
        manager.close(layoutId);
        document.documentElement.dataset.theme = "light";
        await tick();
        expect(win.document.documentElement.dataset.theme).toBe("dark");
    });
});
