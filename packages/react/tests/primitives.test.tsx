import {
    type Action,
    Actions,
    createLayoutEngine,
    DockableLabel,
    DockLocation,
    MOVEABLE_ATTRIBUTE,
    Model,
    type RowNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dockable, useDockable } from "../src";
import { useDockableContext } from "../src/context";
import { Layout, mounts, renderNode, renderPanel, twoTabsets } from "./layout";

const path = (p: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${p}"]`);
const mustPath = (p: string) => {
    const element = path(p);
    if (!element) throw new Error(`no element at ${p}`);
    return element;
};
const fresh = () => Model.fromJson(structuredClone(twoTabsets));

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
        expect(tab0).toHaveAttribute("aria-controls", "dockable-tab-t0");
        expect(tab0).toHaveAttribute("id", "dockable-tabbutton-t0");
        expect(tab0).toHaveAttribute("tabindex", "0");
        expect(tab0).toHaveAttribute("aria-keyshortcuts", "Control+Delete");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "false");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("tabindex", "-1");

        const panel = mustPath("/ts0/t0");
        expect(panel).toHaveAttribute("role", "tabpanel");
        expect(panel).toHaveAttribute("id", "dockable-tab-t0");
        expect(panel).toHaveAttribute(
            "aria-labelledby",
            "dockable-tabbutton-t0",
        );

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
            model.doAction(Actions.setActiveTabset("ts0"));
        });
        expect(mustPath("/ts0")).toHaveAttribute("data-active", "");
        expect(mustPath("/ts1")).not.toHaveAttribute("data-active");

        act(() => {
            model.doAction(Actions.maximizeToggle("ts1"));
        });
        expect(mustPath("/ts1")).toHaveAttribute("data-maximized", "");
        expect(mustPath("/layout")).toHaveAttribute("data-maximized", "");
        expect(mustPath("/ts0/t0")).not.toHaveAttribute("data-visible");
    });

    it("marks an empty tabset", () => {
        const model = Model.fromJson({
            global: { tabSetEnableDeleteWhenEmpty: false },
            layout: {
                type: "row",
                children: [{ type: "tabset", id: "empty", children: [] }],
            },
        });
        render(<Layout model={model} />);
        expect(mustPath("/ts0")).toHaveAttribute("data-empty", "");
        expect(mustPath("/ts0/content")).toHaveAttribute("data-empty", "");
    });

    it("renders no text of its own without getLabel", () => {
        const model = fresh();
        render(
            <Dockable.Root model={model} data-testid="root">
                <Dockable.Row>
                    {(child) => (
                        <Dockable.TabSet node={child as TabSetNode}>
                            <Dockable.TabList>
                                {(tab) => <Dockable.Tab node={tab} />}
                            </Dockable.TabList>
                            <Dockable.TabSetContent />
                        </Dockable.TabSet>
                    )}
                </Dockable.Row>
                <Dockable.Panels>
                    {(tab) => <Dockable.Panel node={tab} />}
                </Dockable.Panels>
            </Dockable.Root>,
        );
        expect(screen.getByTestId("root").textContent).toBe("");
        expect(mustPath("/s0")).not.toHaveAttribute("aria-label");
    });

    it("names the splitter through getLabel", () => {
        const getLabel = vi.fn((key: DockableLabel) =>
            key === DockableLabel.Splitter ? "Resize" : undefined,
        );
        render(<Layout model={fresh()} getLabel={getLabel} />);
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
        const renderTab = vi.fn(
            (
                props: React.HTMLAttributes<HTMLElement>,
                state: { selected: boolean },
            ) => (
                <button
                    type="button"
                    {...props}
                    data-was-selected={String(state.selected)}
                />
            ),
        );
        const model = fresh();
        render(
            <Dockable.Root model={model}>
                <Dockable.Row>
                    {(child) => (
                        <Dockable.TabSet node={child as TabSetNode}>
                            <Dockable.TabList>
                                {(tab) => (
                                    <Dockable.Tab
                                        node={tab}
                                        render={renderTab}
                                    />
                                )}
                            </Dockable.TabList>
                        </Dockable.TabSet>
                    )}
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
                    {(child) => (
                        <Dockable.TabSet node={child as TabSetNode}>
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
                    )}
                </Dockable.Row>
            </Dockable.Root>,
        );
        expect(mustPath("/ts0/tb0")).toHaveClass("on");
        expect(mustPath("/ts0/tb1")).toHaveClass("off");
        expect(mustPath("/ts0/tb1").style.opacity).toBe("0.5");
    });

    it("composes consumer handlers after the internal ones", () => {
        const calls: string[] = [];
        const onAction = (action: Action) => {
            calls.push(`action:${action.type}`);
            return action;
        };
        const model = fresh();
        render(
            <Dockable.Root model={model} onAction={onAction}>
                <Dockable.Row>
                    {(child) => (
                        <Dockable.TabSet node={child as TabSetNode}>
                            <Dockable.TabList>
                                {(tab) => (
                                    <Dockable.Tab
                                        node={tab}
                                        onClick={() =>
                                            calls.push(`click:${tab.getId()}`)
                                        }
                                    />
                                )}
                            </Dockable.TabList>
                        </Dockable.TabSet>
                    )}
                </Dockable.Row>
            </Dockable.Root>,
        );
        fireEvent.click(mustPath("/ts0/tb1"));
        expect(calls).toEqual([`action:${Actions.SELECT_TAB}`, "click:t1"]);
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
                const original = engine.attachRoot.bind(engine);
                engine.attachRoot = (element: HTMLElement) => {
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
            model.doAction(Actions.selectTab("t1"));
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
            model.doAction(Actions.selectTab("t1"));
        });
        expect(calls.filter((el) => el !== null)).toHaveLength(1);
        expect(calls).not.toContain(null);
    });
});

describe("interaction", () => {
    it("selects a tab on click through onAction", () => {
        const onAction = vi.fn((action: Action) => action);
        const model = fresh();
        render(<Layout model={model} onAction={onAction} />);
        fireEvent.click(mustPath("/ts0/tb1"));
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({
                type: Actions.SELECT_TAB,
                data: { tabNode: "t1" },
            }),
        );
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "true");
    });

    it("moves focus with the arrow keys, Home and End, and selects with Enter", () => {
        const onAction = vi.fn((action: Action) => action);
        render(<Layout model={fresh()} onAction={onAction} />);
        const tab0 = mustPath("/ts0/tb0");
        const tab1 = mustPath("/ts0/tb1");
        tab0.focus();

        fireEvent.keyDown(tab0, { key: "ArrowRight" });
        expect(document.activeElement).toBe(tab1);
        expect(onAction).not.toHaveBeenCalled(); // manual activation

        fireEvent.keyDown(tab1, { key: "Home" });
        expect(document.activeElement).toBe(tab0);
        fireEvent.keyDown(tab0, { key: "End" });
        expect(document.activeElement).toBe(tab1);
        fireEvent.keyDown(tab1, { key: "ArrowLeft" });
        expect(document.activeElement).toBe(tab0);

        fireEvent.keyDown(tab1, { key: "Enter" });
        expect(onAction).toHaveBeenCalledWith(
            expect.objectContaining({ type: Actions.SELECT_TAB }),
        );
        expect(tab1).toHaveAttribute("aria-selected", "true");
    });

    it("closes a tab with the closeTab key", () => {
        const model = fresh();
        render(<Layout model={model} />);
        fireEvent.keyDown(mustPath("/ts0/tb1"), {
            key: "Delete",
            ctrlKey: true,
        });
        expect(model.getNodeById("t1")).toBeUndefined();
    });

    it("moves focus to the previous tab when the last tab is closed", () => {
        const model = fresh();
        render(<Layout model={model} />);
        const last = mustPath("/ts0/tb1");
        last.focus();
        fireEvent.keyDown(last, { key: "Delete", ctrlKey: true });
        expect(model.getNodeById("t1")).toBeUndefined();
        expect(document.activeElement).toBe(mustPath("/ts0/tb0"));
    });

    it("makes a tabset active on pointer down", () => {
        const model = fresh();
        render(<Layout model={model} />);
        fireEvent.pointerDown(mustPath("/ts1"), { button: 0 });
        expect(model.getActiveTabset()?.getId()).toBe("ts1");
    });

    it("dispatches adjustWeights from the splitter keyboard", () => {
        const onAction = vi.fn((action: Action) => action);
        render(<Layout model={fresh()} onAction={onAction} />);
        // jsdom measures everything as 100x100, so give the row real geometry to split
        const splitter = mustPath("/s0");
        fireEvent.keyDown(splitter, { key: "ArrowRight" });
        const adjust = onAction.mock.calls
            .map(([a]) => a)
            .find((a) => a.type === Actions.ADJUST_WEIGHTS);
        expect(adjust).toBeDefined();
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
            model.doAction(Actions.selectTab("t1"));
        });
        act(() => {
            model.doAction(Actions.selectTab("t0"));
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
            model.doAction(
                Actions.moveNode("t2", "ts0", DockLocation.CENTER, 0),
            );
        });

        expect(screen.getByTestId("content-t2")).toBe(content);
        expect(screen.getByTestId("inc-t2")).toHaveTextContent("count 1");
        expect(mounts.get("t2")).toBe(1);
        // t2 is now the first tab of ts0 (its panel path follows)
        expect(mustPath("/ts0/t0")).toContainElement(content);
    });

    it("keeps content state through a model swap (Model.fromJson with the previous model)", () => {
        // what an undo/redo does: render a new model rebuilt from saved JSON, adopting the old one
        let setModel: (model: Model) => void = () => {};
        function Swappable({ initial }: { initial: Model }) {
            const [model, set] = React.useState(initial);
            setModel = set;
            return <Layout model={model} />;
        }
        const first = fresh();
        render(<Swappable initial={first} />);
        fireEvent.click(screen.getByTestId("inc-t2"));
        fireEvent.change(screen.getByTestId("input-t2"), {
            target: { value: "typed" },
        });
        const content = screen.getByTestId("content-t2");
        const saved = first.toJson();

        act(() => {
            first.doAction(
                Actions.moveNode("t2", "ts0", DockLocation.CENTER, -1),
            );
        });
        const moved = first.toJson();
        const undone = Model.fromJson(saved, first);
        act(() => {
            setModel(undone); // "undo"
        });
        expect(screen.getByTestId("content-t2")).toBe(content);
        act(() => {
            setModel(Model.fromJson(moved, undone)); // "redo"
        });

        expect(screen.getByTestId("content-t2")).toBe(content);
        expect(screen.getByTestId("inc-t2")).toHaveTextContent("count 1");
        expect(screen.getByTestId("input-t2")).toHaveValue("typed");
        expect(mounts.get("t2")).toBe(1);
    });

    it("moves a panel between two layers in one document without remounting the content", () => {
        const model = fresh();
        const layerHost = document.body.appendChild(
            document.createElement("div"),
        );

        // stands in for the popout's layer: a second panel layer, in the same document
        function SecondLayer() {
            const { setLayer, engine } = useDockableContext("test");
            const engines = React.useRef(
                new Map<string, ReturnType<typeof createLayoutEngine>>(),
            );
            const layoutIds = [...model.getLayouts().keys()].filter(
                (id) => id !== Model.MAIN_LAYOUT_ID,
            );
            React.useLayoutEffect(() => {
                for (const layoutId of layoutIds) {
                    if (engines.current.has(layoutId)) {
                        continue;
                    }
                    const sub = createLayoutEngine({
                        model,
                        layoutId,
                        mainEngine: engine,
                    });
                    engines.current.set(layoutId, sub);
                    sub.attachRoot(layerHost);
                    setLayer(layoutId, {
                        layoutId,
                        element: layerHost,
                        engine: sub,
                    });
                }
            });
            return null;
        }

        render(
            <Layout model={model}>
                <SecondLayer />
            </Layout>,
        );
        fireEvent.click(screen.getByTestId("inc-t2"));
        const content = screen.getByTestId("content-t2");
        const moveable = content.closest(`[${MOVEABLE_ATTRIBUTE}]`);

        act(() => {
            model.doAction(Actions.popoutTab("t2", "window"));
        });

        expect(layerHost).toContainElement(content);
        expect(content.closest(`[${MOVEABLE_ATTRIBUTE}]`)).toBe(moveable);
        expect(screen.getByTestId("inc-t2")).toHaveTextContent("count 1");
        expect(mounts.get("t2")).toBe(1);
        layerHost.remove();
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
        let engineRef: ReturnType<typeof useDockable>["engine"] | undefined;
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
        const registrations = engineRef?.getRegistrations();
        // row + 2 x (tabset, tabstrip, tabsetcontent) + 3 tab buttons
        expect(registrations?.measurables.size).toBe(10);
        expect(registrations?.tabPanels.size).toBe(2);
        expect(registrations?.splitters.size).toBe(1);
        expect(model.getMainLayout().getController()).toBe(engineRef);
        expect(
            document.querySelectorAll(`[${MOVEABLE_ATTRIBUTE}]`),
        ).toHaveLength(2);
        expect(screen.getAllByTestId(/^content-/)).toHaveLength(2);
    });
});

describe("hooks", () => {
    it("useDockable dispatches through onAction", () => {
        const onAction = vi.fn((action: Action) => action);
        function PopButton() {
            const { engine } = useDockable();
            return (
                <button
                    type="button"
                    data-testid="select"
                    onClick={() => engine.doAction(Actions.selectTab("t1"))}
                >
                    select
                </button>
            );
        }
        render(
            <Layout model={fresh()} onAction={onAction}>
                <PopButton />
            </Layout>,
        );
        fireEvent.click(screen.getByTestId("select"));
        expect(onAction).toHaveBeenCalledTimes(1);
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
                <Dockable.Panels>{renderPanel}</Dockable.Panels>
            </Dockable.Root>,
        );
        expect(screen.queryByRole("separator")).toBeNull();
    });

    it("renders nested rows through the child function", () => {
        const model = Model.fromJson({
            global: {},
            layout: {
                type: "row",
                children: [
                    { type: "tabset", children: [{ type: "tab", name: "A" }] },
                    {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [{ type: "tab", name: "B" }],
                            },
                            {
                                type: "tabset",
                                children: [{ type: "tab", name: "C" }],
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
        expect((model.getRootRow() as RowNode).getChildren()).toHaveLength(2);
    });
});
