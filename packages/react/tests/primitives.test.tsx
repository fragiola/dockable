import {
    createModel,
    type LayoutEngine,
    MOVEABLE_ATTRIBUTE,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    Dockable,
    type RenderedProps,
    type TabState,
    useDockable,
} from "../src";
import { useDockableContext } from "../src/context";
import {
    Layout,
    type LayoutProps,
    mounts,
    recordCommands,
    renderNode,
    renderPanel,
    type Types,
    twoTabsets,
} from "./layout";

const path = (p: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${p}"]`);
const mustPath = (p: string) => {
    const element = path(p);
    if (!element) throw new Error(`no element at ${p}`);
    return element;
};
const fresh = () => createModel<Types>(structuredClone(twoTabsets));

/** a Row child function that renders only tabsets, with bare tabs (no text) */
function bareTabset(child: TabsetNode | RowNode) {
    return child.type === "tabset" ? (
        <Dockable.TabSet node={child}>
            <Dockable.TabList>
                {(tab) => <Dockable.Tab node={tab} />}
            </Dockable.TabList>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    ) : null;
}

beforeEach(() => {
    mounts.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("composition and ARIA", () => {
    it("renders the tree with roles and ARIA attributes", () => {
        render(<Layout model={fresh()} />);

        const tablists = screen.getAllByRole("tablist");
        expect(tablists).toHaveLength(2);
        expect(tablists[0]).toHaveAttribute("aria-orientation", "horizontal");

        const tab0 = mustPath("/ts0/tb0");
        expect(tab0).toHaveAttribute("role", "tab");
        expect(tab0).toHaveAttribute("aria-selected", "true");
        expect(tab0).toHaveAttribute("tabindex", "0");
        expect(tab0).toHaveAttribute("aria-keyshortcuts", "Control+Delete");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "false");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("tabindex", "-1");

        const panel = mustPath("/ts0/t0");
        expect(panel).toHaveAttribute("role", "tabpanel");
        // the DOM ids are scoped per root: the tab and its panel name each other
        expect(tab0.id).not.toBe("");
        expect(panel.id).not.toBe("");
        expect(tab0).toHaveAttribute("aria-controls", panel.id);
        expect(panel).toHaveAttribute("aria-labelledby", tab0.id);
        expect(mustPath("/ts0/tb1").id).not.toBe(tab0.id);

        const splitter = mustPath("/s0");
        expect(splitter).toHaveAttribute("role", "separator");
        expect(splitter).toHaveAttribute("aria-orientation", "vertical");
        expect(splitter).toHaveAttribute("tabindex", "0");
        expect(splitter).toHaveAttribute("aria-valuemin", "0");
        expect(splitter).toHaveAttribute("aria-valuemax", "100");
    });

    it("emits data-layout-path on every primitive", () => {
        render(<Layout model={fresh()} />);
        for (const p of [
            "/layout",
            "/row",
            "/ts0",
            "/ts0/tabstrip",
            "/ts0/content",
            "/ts0/tb0",
            "/ts0/t0",
            "/s0",
            "/ts1",
        ]) {
            expect(path(p), p).not.toBeNull();
        }
    });

    it("exposes state through data-* only, present or absent", () => {
        const model = fresh();
        render(<Layout model={model} />);
        expect(mustPath("/ts0/tb0")).toHaveAttribute("data-selected", "");
        expect(mustPath("/ts0/tb1")).not.toHaveAttribute("data-selected");
        expect(mustPath("/row")).toHaveAttribute(
            "data-orientation",
            "horizontal",
        );
        expect(mustPath("/s0")).toHaveAttribute("data-orientation", "vertical");
        expect(mustPath("/ts0/t0")).toHaveAttribute("data-visible", "");
        expect(mustPath("/ts0")).not.toHaveAttribute("data-active");

        act(() => {
            model.run("tabset.activate", { tabsetId: "ts0" });
        });
        expect(mustPath("/ts0")).toHaveAttribute("data-active", "");
        expect(mustPath("/ts1")).not.toHaveAttribute("data-active");

        act(() => {
            model.run("tabset.maximize", { tabsetId: "ts1", value: true });
        });
        expect(mustPath("/ts1")).toHaveAttribute("data-maximized", "");
        expect(mustPath("/layout")).toHaveAttribute("data-maximized", "");
        expect(mustPath("/ts0/t0")).not.toHaveAttribute("data-visible");
    });

    it("marks an empty tabset", () => {
        const model = createModel<Types>({
            version: 1,
            defaults: { tabset: { deleteWhenEmpty: false } },
            root: {
                type: "row",
                children: [{ type: "tabset", id: "empty", children: [] }],
            },
        });
        render(<Layout model={model} />);
        expect(mustPath("/ts0")).toHaveAttribute("data-empty", "");
        expect(mustPath("/ts0/content")).toHaveAttribute("data-empty", "");
    });

    it("renders no text and no name of its own", () => {
        const model = fresh();
        render(
            <Dockable.Root model={model} data-testid="root">
                <Dockable.Row>{bareTabset}</Dockable.Row>
                <Dockable.Panels>
                    {(tab) => <Dockable.Panel node={tab} />}
                </Dockable.Panels>
            </Dockable.Root>,
        );
        expect(screen.getByTestId("root").textContent).toBe("");
        expect(mustPath("/s0")).not.toHaveAttribute("aria-label");
    });

    it("names a row's splitter through aria-label in renderSplitter", () => {
        render(
            <Dockable.Root model={fresh()}>
                <Dockable.Row<Types>
                    renderSplitter={(props) => (
                        <Dockable.Splitter {...props} aria-label="Resize" />
                    )}
                >
                    {renderNode}
                </Dockable.Row>
            </Dockable.Root>,
        );
        expect(mustPath("/s0")).toHaveAttribute("aria-label", "Resize");
    });
});

describe("render, refs and props", () => {
    it("replaces the element with render={<element />}, keeping the primitive's props", () => {
        const model = fresh();
        render(
            <Dockable.Root model={model} render={<section />}>
                <Dockable.Row render={<main />}>{renderNode}</Dockable.Row>
            </Dockable.Root>,
        );
        const root = mustPath("/layout");
        expect(root.tagName).toBe("SECTION");
        expect(root.style.position).toBe("relative");
        expect(mustPath("/row").tagName).toBe("MAIN");
    });

    it("calls render={(props, state) => ...} with the props and the state", () => {
        const renderTab = vi.fn((props: RenderedProps, state: TabState) => (
            <button
                type="button"
                {...props}
                data-was-selected={String(state.selected)}
            />
        ));
        const model = fresh();
        render(
            <Dockable.Root model={model}>
                <Dockable.Row>
                    {(child) =>
                        child.type === "tabset" ? (
                            <Dockable.TabSet node={child}>
                                <Dockable.TabList>
                                    {(tab) => (
                                        <Dockable.Tab
                                            node={tab}
                                            render={renderTab}
                                        />
                                    )}
                                </Dockable.TabList>
                            </Dockable.TabSet>
                        ) : null
                    }
                </Dockable.Row>
            </Dockable.Root>,
        );
        const tab0 = mustPath("/ts0/tb0");
        expect(tab0.tagName).toBe("BUTTON");
        expect(tab0).toHaveAttribute("role", "tab");
        expect(tab0).toHaveAttribute("data-was-selected", "true");
        expect(mustPath("/ts0/tb1")).toHaveAttribute(
            "data-was-selected",
            "false",
        );
    });

    it("forwards a ref prop and arbitrary props", () => {
        const ref = React.createRef<HTMLElement>();
        render(
            <Layout
                model={fresh()}
                ref={ref}
                aria-label="workspace"
                id="dock"
            />,
        );
        expect(ref.current).toBe(mustPath("/layout"));
        expect(ref.current).toHaveAttribute("aria-label", "workspace");
        expect(ref.current).toHaveAttribute("id", "dock");
    });

    it("resolves className and style functions against the state", () => {
        const model = fresh();
        render(
            <Dockable.Root model={model}>
                <Dockable.Row>
                    {(child) =>
                        child.type === "tabset" ? (
                            <Dockable.TabSet node={child}>
                                <Dockable.TabList>
                                    {(tab) => (
                                        <Dockable.Tab
                                            node={tab}
                                            className={(s) =>
                                                s.selected ? "on" : "off"
                                            }
                                            style={(s) => ({
                                                opacity: s.selected ? 1 : 0.5,
                                            })}
                                        />
                                    )}
                                </Dockable.TabList>
                            </Dockable.TabSet>
                        ) : null
                    }
                </Dockable.Row>
            </Dockable.Root>,
        );
        expect(mustPath("/ts0/tb0")).toHaveClass("on");
        expect(mustPath("/ts0/tb1")).toHaveClass("off");
        expect(mustPath("/ts0/tb1").style.opacity).toBe("0.5");
    });

    it("composes consumer handlers after the internal ones", () => {
        const calls: string[] = [];
        const model = fresh();
        model.use((ctx, next) => {
            if (!ctx.dryRun) {
                calls.push(`command:${ctx.command}`);
            }
            return next();
        });
        render(
            <Dockable.Root model={model}>
                <Dockable.Row>
                    {(child) =>
                        child.type === "tabset" ? (
                            <Dockable.TabSet node={child}>
                                <Dockable.TabList>
                                    {(tab) => (
                                        <Dockable.Tab
                                            node={tab}
                                            onClick={() =>
                                                calls.push(`click:${tab.id}`)
                                            }
                                        />
                                    )}
                                </Dockable.TabList>
                            </Dockable.TabSet>
                        ) : null
                    }
                </Dockable.Row>
            </Dockable.Root>,
        );
        fireEvent.click(mustPath("/ts0/tb1"));
        expect(calls).toEqual(["command:tab.select", "click:t1"]);
    });

    it("keeps structural style keys over the consumer's", () => {
        const model = fresh();
        render(
            <Dockable.Root
                model={model}
                style={{ position: "static", color: "red" }}
            >
                <Dockable.Row
                    style={{
                        display: "block",
                        flexDirection: "column",
                        margin: 4,
                    }}
                >
                    {renderNode}
                </Dockable.Row>
                <Dockable.Panels>
                    {(tab) => (
                        <Dockable.Panel
                            node={tab}
                            style={{
                                position: "static",
                                display: "flex",
                                left: 999,
                                padding: 2,
                            }}
                        />
                    )}
                </Dockable.Panels>
            </Dockable.Root>,
        );
        const root = mustPath("/layout");
        expect(root.style.position).toBe("relative");
        expect(root.style.color).toBe("red");
        const row = mustPath("/row");
        expect(row.style.display).toBe("flex");
        expect(row.style.flexDirection).toBe("row");
        expect(row.style.margin).toBe("4px");
        const panel = mustPath("/ts0/t0");
        expect(panel.style.position).toBe("absolute");
        expect(panel.style.left).toBe("0px");
        expect(panel.style.display).toBe("");
        expect(panel.style.padding).toBe("2px");
    });

    it("drops the engine's style keys from a Panel's render element too", () => {
        render(
            <Dockable.Root model={fresh()}>
                <Dockable.Row>{renderNode}</Dockable.Row>
                <Dockable.Panels>
                    {(tab) => (
                        <Dockable.Panel
                            node={tab}
                            render={
                                <section
                                    style={{
                                        position: "static",
                                        right: 7,
                                        bottom: 3,
                                        padding: 2,
                                    }}
                                />
                            }
                        />
                    )}
                </Dockable.Panels>
            </Dockable.Root>,
        );
        const panel = mustPath("/ts0/t0");
        expect(panel.tagName).toBe("SECTION");
        expect(panel.style.position).toBe("absolute");
        expect(panel.style.right).toBe("");
        expect(panel.style.bottom).toBe("");
        expect(panel.style.padding).toBe("2px");
    });

    it("applies only structural inline styles", () => {
        const STRUCTURAL = new Set([
            "position",
            "left",
            "top",
            "right",
            "bottom",
            "inset",
            "width",
            "height",
            "display",
            "flex-direction",
            "flex-basis",
            "flex-grow",
            "min-width",
            "min-height",
            "max-width",
            "max-height",
            "overflow",
            "transform",
        ]);
        render(<Layout model={fresh()} />);
        for (const element of document.querySelectorAll<HTMLElement>(
            "[data-layout-path], [data-dockable-moveable]",
        )) {
            for (let i = 0; i < element.style.length; i++) {
                const key = element.style.item(i);
                expect(
                    STRUCTURAL.has(key),
                    `${element.dataset.layoutPath}: ${key}`,
                ).toBe(true);
            }
        }
    });
});

describe("ref stability", () => {
    it("does not re-attach refs on re-render when the render element has its own ref", () => {
        const model = fresh();
        const elementRef = React.createRef<HTMLElement>();
        const attach = vi.fn();
        function Probe() {
            const { engine } = useDockable();
            React.useLayoutEffect(() => {
                const original = engine.adapter.attachRoot.bind(engine);
                engine.adapter.attachRoot = (element: HTMLElement) => {
                    attach();
                    original(element);
                };
            }, [engine]);
            return null;
        }
        const { rerender } = render(
            <Dockable.Root model={model} render={<main ref={elementRef} />}>
                <Probe />
            </Dockable.Root>,
        );
        rerender(
            <Dockable.Root model={model} render={<main ref={elementRef} />}>
                <Probe />
            </Dockable.Root>,
        );
        act(() => {
            model.run("tab.select", { tabId: "t1" });
        });
        expect(elementRef.current).toBe(mustPath("/layout"));
        // the child's layout effect patches attachRoot before the root's ref attaches: that first
        // attach is the only one
        expect(attach).toHaveBeenCalledTimes(1);
    });
});

describe("inline callback refs", () => {
    it("do not re-attach the primitive's ref on every render", () => {
        const model = fresh();
        const calls: (HTMLElement | null)[] = [];
        function App() {
            return (
                <Dockable.Root model={model} ref={(el) => void calls.push(el)}>
                    <Dockable.Row>{renderNode}</Dockable.Row>
                </Dockable.Root>
            );
        }
        const { rerender } = render(<App />);
        rerender(<App />);
        act(() => {
            model.run("tab.select", { tabId: "t1" });
        });
        expect(calls.filter((el) => el !== null)).toHaveLength(1);
        expect(calls).not.toContain(null);
    });
});

describe("interaction", () => {
    it("selects a tab on click with tab.select", () => {
        const model = fresh();
        const commands = recordCommands(model);
        render(<Layout model={model} />);
        fireEvent.click(mustPath("/ts0/tb1"));
        expect(commands).toEqual([
            {
                command: "tab.select",
                payload: { tabId: "t1" },
                transient: false,
            },
        ]);
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "true");
    });

    it("moves focus with the arrow keys, Home and End, and selects with Enter", () => {
        const model = fresh();
        const commands = recordCommands(model);
        render(<Layout model={model} />);
        const tab0 = mustPath("/ts0/tb0");
        const tab1 = mustPath("/ts0/tb1");
        tab0.focus();

        fireEvent.keyDown(tab0, { key: "ArrowRight" });
        expect(document.activeElement).toBe(tab1);
        expect(commands).toEqual([]); // manual activation

        fireEvent.keyDown(tab1, { key: "Home" });
        expect(document.activeElement).toBe(tab0);
        fireEvent.keyDown(tab0, { key: "End" });
        expect(document.activeElement).toBe(tab1);
        fireEvent.keyDown(tab1, { key: "ArrowLeft" });
        expect(document.activeElement).toBe(tab0);

        fireEvent.keyDown(tab1, { key: "Enter" });
        expect(commands).toEqual([
            {
                command: "tab.select",
                payload: { tabId: "t1" },
                transient: false,
            },
        ]);
        expect(tab1).toHaveAttribute("aria-selected", "true");
    });

    it("reverses the horizontal arrow keys in RTL, where the strip runs from the right", () => {
        document.documentElement.dir = "rtl";
        try {
            render(<Layout model={fresh()} />);
            const tab0 = mustPath("/ts0/tb0");
            const tab1 = mustPath("/ts0/tb1");
            tab0.focus();
            fireEvent.keyDown(tab0, { key: "ArrowLeft" });
            expect(document.activeElement).toBe(tab1);
            fireEvent.keyDown(tab1, { key: "ArrowRight" });
            expect(document.activeElement).toBe(tab0);
        } finally {
            document.documentElement.removeAttribute("dir");
        }
    });

    it("closes a tab with the closeTab key", () => {
        const model = fresh();
        render(<Layout model={model} />);
        fireEvent.keyDown(mustPath("/ts0/tb1"), {
            key: "Delete",
            ctrlKey: true,
        });
        expect(model.get("node-by", { id: "t1" })).toBeUndefined();
    });

    it("moves focus to the previous tab when the last tab is closed", () => {
        const model = fresh();
        render(<Layout model={model} />);
        const last = mustPath("/ts0/tb1");
        last.focus();
        fireEvent.keyDown(last, { key: "Delete", ctrlKey: true });
        expect(model.get("node-by", { id: "t1" })).toBeUndefined();
        expect(document.activeElement).toBe(mustPath("/ts0/tb0"));
    });

    it("makes a tabset active on pointer down", () => {
        const model = fresh();
        render(<Layout model={model} />);
        fireEvent.pointerDown(mustPath("/ts1"), { button: 0 });
        expect(model.get("active-tabset")?.id).toBe("ts1");
    });

    it("runs row.resize from the splitter keyboard", () => {
        const model = fresh();
        const commands = recordCommands(model);
        render(<Layout model={model} />);
        const splitter = mustPath("/s0");
        fireEvent.keyDown(splitter, { key: "ArrowRight" });
        const resize = commands.find((c) => c.command === "row.resize");
        expect(resize).toMatchObject({
            payload: { rowId: "row" },
            transient: false,
        });
    });

    it("announces the splitter's new value after one arrow key", () => {
        // a 200px row whose tabsets share it by their flex-grow, as a browser lays them out
        const grow = (p: string) => Number(path(p)?.style.flexGrow ?? 1) || 1;
        vi.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect",
        ).mockImplementation(function (this: HTMLElement) {
            const first = (200 * grow("/ts0")) / (grow("/ts0") + grow("/ts1"));
            const p = this.getAttribute("data-layout-path");
            const [x, width] =
                p === "/ts0"
                    ? [0, first]
                    : p === "/ts1"
                      ? [first, 200 - first]
                      : p === "/s0"
                        ? [first, 0]
                        : [0, 200];
            return DOMRect.fromRect({ x, y: 0, width, height: 100 });
        });
        render(<Layout model={fresh()} />);
        const splitter = mustPath("/s0");
        expect(splitter).toHaveAttribute("aria-valuenow", "50");
        fireEvent.keyDown(splitter, { key: "ArrowRight" });
        expect(splitter).toHaveAttribute("aria-valuenow", "55");
        expect(splitter).toHaveAttribute("aria-valuetext", "55%");
    });

    it("ignores a keydown that carries no key (caplin/FlexLayout#529)", () => {
        // browser autofill and scripts send keydown events with no key; the document listener
        // (tabset focus keys, closing an overlay border) must let them through
        const errors: unknown[] = [];
        const onError = (event: ErrorEvent) => {
            errors.push(event.error);
            event.preventDefault();
        };
        window.addEventListener("error", onError);
        try {
            const model = fresh();
            const commands = recordCommands(model);
            render(
                <Layout
                    model={model}
                    keyMap={{ focusNextTabset: "Ctrl+ArrowRight" }}
                />,
            );
            for (const target of [
                document.body,
                mustPath("/ts0/tb0"),
                screen.getByTestId("input-t0"),
            ]) {
                target.dispatchEvent(new Event("keydown", { bubbles: true }));
            }
            expect(errors).toEqual([]);
            expect(commands).toEqual([]);
        } finally {
            window.removeEventListener("error", onError);
        }
    });
});

describe("panels and content", () => {
    it("keeps the moveable element and the content state across re-renders and selection changes", () => {
        const model = fresh();
        const { rerender } = render(<Layout model={model} />);
        const moveable = mustPath("/ts0/t0").querySelector(
            `[${MOVEABLE_ATTRIBUTE}]`,
        );
        expect(moveable).not.toBeNull();
        fireEvent.click(screen.getByTestId("inc-t0"));
        fireEvent.change(screen.getByTestId("input-t0"), {
            target: { value: "kept" },
        });

        rerender(<Layout model={model} />);
        act(() => {
            model.run("tab.select", { tabId: "t1" });
        });
        act(() => {
            model.run("tab.select", { tabId: "t0" });
        });

        expect(
            mustPath("/ts0/t0").querySelector(`[${MOVEABLE_ATTRIBUTE}]`),
        ).toBe(moveable);
        expect(screen.getByTestId("inc-t0")).toHaveTextContent("count 1");
        expect(screen.getByTestId("input-t0")).toHaveValue("kept");
        expect(mounts.get("t0")).toBe(1);
    });

    it("never remounts or reorders content when a tab moves to another tabset", () => {
        const model = fresh();
        render(<Layout model={model} />);
        fireEvent.click(screen.getByTestId("inc-t2"));
        const content = screen.getByTestId("content-t2");

        act(() => {
            model.run("tab.move", {
                tabId: "t2",
                to: "ts0",
                location: "center",
                index: 0,
            });
        });

        expect(screen.getByTestId("content-t2")).toBe(content);
        expect(screen.getByTestId("inc-t2")).toHaveTextContent("count 1");
        expect(mounts.get("t2")).toBe(1);
        // t2 is now the first tab of ts0 (its panel path follows)
        expect(mustPath("/ts0/t0")).toContainElement(content);
    });

    it("keeps content state through layout.load of saved layouts (undo and redo)", () => {
        // what an undo/redo does: load saved JSON into the same model, keeping the tab ids
        const model = fresh();
        render(<Layout model={model} />);
        fireEvent.click(screen.getByTestId("inc-t2"));
        fireEvent.change(screen.getByTestId("input-t2"), {
            target: { value: "typed" },
        });
        const content = screen.getByTestId("content-t2");
        const saved = model.get("layout-json");

        act(() => {
            model.run("tab.move", {
                tabId: "t2",
                to: "ts0",
                location: "center",
                index: -1,
            });
        });
        const moved = model.get("layout-json");
        act(() => {
            model.run("layout.load", { layout: saved }); // "undo"
        });
        expect(mustPath("/ts1/t0")).toContainElement(content);
        expect(screen.getByTestId("content-t2")).toBe(content);
        act(() => {
            model.run("layout.load", { layout: moved }); // "redo"
        });
        expect(mustPath("/ts0/t2")).toContainElement(content);

        expect(screen.getByTestId("content-t2")).toBe(content);
        expect(screen.getByTestId("inc-t2")).toHaveTextContent("count 1");
        expect(screen.getByTestId("input-t2")).toHaveValue("typed");
        expect(mounts.get("t2")).toBe(1);
    });

    it("moves a panel between two layers in one document without remounting the content", () => {
        const model = createModel<Types>({
            ...structuredClone(twoTabsets),
            defaults: { tab: { enablePopout: true } },
        });
        const layerHost = document.body.appendChild(
            document.createElement("div"),
        );
        // the popout's native window: an iframe's, so nothing opens
        const frame = document.body.appendChild(
            document.createElement("iframe"),
        );
        const popoutWindow = frame.contentWindow;
        if (!popoutWindow) throw new Error("no window");

        // stands in for the popout's layer: the window layout's engine attached to a second panel
        // layer, in the same document
        function SecondLayer() {
            const { setLayer, engine } = useDockableContext("test");
            const attached = React.useRef(new Set<LayoutEngine>());
            React.useLayoutEffect(() => {
                for (const window of model.state.windows) {
                    const sub = engine.adapter
                        .getPopoutManager()
                        .getLayoutEngine(window.id);
                    if (!sub || attached.current.has(sub)) {
                        continue;
                    }
                    attached.current.add(sub);
                    sub.adapter.attachRoot(layerHost);
                    setLayer(window.id, layerHost);
                }
            });
            return null;
        }

        render(
            <Layout
                model={model}
                supportsPopout
                openWindow={() => popoutWindow}
            >
                <SecondLayer />
            </Layout>,
        );
        fireEvent.click(screen.getByTestId("inc-t2"));
        const content = screen.getByTestId("content-t2");
        const moveable = content.closest(`[${MOVEABLE_ATTRIBUTE}]`);

        act(() => {
            const result = model.run("tab.popout", { tabId: "t2" });
            expect(result.ok).toBe(true);
        });

        expect(layerHost).toContainElement(content);
        expect(content.closest(`[${MOVEABLE_ATTRIBUTE}]`)).toBe(moveable);
        expect(screen.getByTestId("inc-t2")).toHaveTextContent("count 1");
        expect(mounts.get("t2")).toBe(1);
        layerHost.remove();
        frame.remove();
    });

    it("renders only selected (or already rendered) tabs with render on demand", () => {
        render(<Layout model={fresh()} />);
        expect(screen.queryByTestId("content-t1")).toBeNull();
        fireEvent.click(mustPath("/ts0/tb1"));
        expect(screen.getByTestId("content-t1")).toBeInTheDocument();
        fireEvent.click(mustPath("/ts0/tb0"));
        expect(screen.getByTestId("content-t1")).toBeInTheDocument(); // kept alive
    });
});

describe("StrictMode", () => {
    it("renders cleanly: no warnings, no duplicate registrations", () => {
        const error = vi.spyOn(console, "error");
        const warn = vi.spyOn(console, "warn");
        const model = fresh();
        let engineRef: LayoutEngine | undefined;
        function Probe() {
            engineRef = useDockable().engine;
            return null;
        }
        render(
            <React.StrictMode>
                <Layout model={model}>
                    <Probe />
                </Layout>
            </React.StrictMode>,
        );
        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
        const registrations = engineRef?.adapter.getRegistrations();
        // row + 2 x (tabset, tabstrip, tabsetcontent) + 3 tab buttons
        expect(registrations?.measurables.size).toBe(10);
        expect(registrations?.tabPanels.size).toBe(2);
        expect(registrations?.splitters.size).toBe(1);
        expect(
            document.querySelectorAll(`[${MOVEABLE_ATTRIBUTE}]`),
        ).toHaveLength(2);
        expect(screen.getAllByTestId(/^content-/)).toHaveLength(2);
    });

    it("keeps the model's listeners at one set, whatever props change (caplin/FlexLayout#504)", () => {
        const model = fresh();
        let listeners = 0;
        let calls = 0;
        const subscribe = model.subscribe;
        model.subscribe = (listener) => {
            listeners++;
            const unsubscribe = subscribe((event) => {
                calls++;
                listener(event);
            });
            return () => {
                listeners--;
                unsubscribe();
            };
        };
        const app = (props: Partial<LayoutProps>) => (
            <React.StrictMode>
                <Layout model={model} {...props} />
            </React.StrictMode>
        );
        const { rerender, unmount } = render(app({}));
        const mounted = listeners;
        expect(mounted).toBeGreaterThan(0);
        // every prop the Root passes on to its engine, as new values
        for (const [i, props] of [
            { keyMap: { closeTab: "Ctrl+W" } },
            { realtimeResize: false, tabDragSpeed: 0.1 },
            { onExternalDrag: () => undefined, popoutURL: "popout.html" },
            { keyMap: { closeTab: "Ctrl+W" }, onExternalDrag: () => undefined },
        ].entries()) {
            rerender(app(props));
            expect(listeners, `after re-render ${i}`).toBe(mounted);
        }
        // a command reaches each listener once
        act(() => {
            model.run("tab.select", { tabId: "t1" });
        });
        expect(calls).toBe(mounted);
        unmount();
        expect(listeners).toBe(0);
    });
});

describe("hooks", () => {
    it("useDockable runs commands through the model's middleware", () => {
        const model = fresh();
        const commands = recordCommands(model);
        function SelectButton() {
            const { model } = useDockable<Types>();
            return (
                <button
                    type="button"
                    data-testid="select"
                    onClick={() => model.run("tab.select", { tabId: "t1" })}
                >
                    select
                </button>
            );
        }
        render(
            <Layout model={model}>
                <SelectButton />
            </Layout>,
        );
        fireEvent.click(screen.getByTestId("select"));
        expect(commands).toEqual([
            {
                command: "tab.select",
                payload: { tabId: "t1" },
                transient: false,
            },
        ]);
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "true");
    });

    it("Row accepts renderSplitter and splitter={false}", () => {
        const model = fresh();
        const { unmount } = render(
            <Dockable.Root model={model}>
                <Dockable.Row
                    renderSplitter={({ index }) => (
                        <hr data-testid={`custom-${index}`} />
                    )}
                >
                    {renderNode}
                </Dockable.Row>
            </Dockable.Root>,
        );
        expect(screen.getByTestId("custom-1")).toBeInTheDocument();
        unmount();
        render(
            <Dockable.Root model={model}>
                <Dockable.Row splitter={false}>{renderNode}</Dockable.Row>
                <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
            </Dockable.Root>,
        );
        expect(screen.queryByRole("separator")).toBeNull();
    });

    it("renders nested rows through the child function", () => {
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
                            },
                        ],
                    },
                    {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    {
                                        component: "test",
                                        label: "B",
                                        data: { name: "B" },
                                    },
                                ],
                            },
                            {
                                type: "tabset",
                                children: [
                                    {
                                        component: "test",
                                        label: "C",
                                        data: { name: "C" },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
        render(<Layout model={model} />);
        expect(mustPath("/r1")).toHaveAttribute("data-orientation", "vertical");
        expect(mustPath("/r1/ts1/tb0")).toHaveTextContent("C");
        expect(mustPath("/r1/s0")).toHaveAttribute(
            "aria-orientation",
            "horizontal",
        );
        expect(model.get("root-row")?.children).toHaveLength(2);
    });
});
