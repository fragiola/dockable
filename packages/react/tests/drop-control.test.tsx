import {
    DragDropManager,
    LayoutEngine,
    Model,
    type Node,
    type TabNode,
} from "@fragiola/dockable";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";
import { Layout, twoTabsets } from "./layout";

// jsdom measures every element as 100x100 at (0, 0) (tests/setup.ts), so a drag over (50, 50)
// always has a target: the hit test's first tabset.

function dragEvent(type: string, x = 50, y = 50) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, "dataTransfer", {
        value: {
            types: [],
            setData: vi.fn(),
            setDragImage: vi.fn(),
            effectAllowed: "none",
            dropEffect: "none",
        },
    });
    return event as unknown as DragEvent;
}

const path = (p: string) => {
    const element = document.querySelector<HTMLElement>(
        `[data-layout-path="${p}"]`,
    );
    if (!element) throw new Error(`no element at ${p}`);
    return element;
};

function startDrag(model: Model, tabId: string) {
    act(() => {
        LayoutEngine.of(model)
            ?.getDragDropManager()
            .setDragNode(
                dragEvent("dragstart", 0, 0),
                model.getNodeById(tabId) as TabNode,
            );
    });
}

function over(element: HTMLElement) {
    act(() => {
        element.dispatchEvent(dragEvent("dragenter"));
        element.dispatchEvent(dragEvent("dragover"));
    });
}

afterEach(() => {
    if (DragDropManager.getDragState()) {
        act(() => {
            DragDropManager.getDragState()
                ?.mainEngine.getDragDropManager()
                .onDragEnded();
        });
    }
});

const tabsets = () =>
    Array.from(
        document.querySelectorAll<HTMLElement>('[data-layout-path^="/ts"]'),
    ).filter((el) =>
        /^\/ts\d$/.test(el.getAttribute("data-layout-path") ?? ""),
    );

describe("drop target attributes", () => {
    it("mark exactly one tabset during a drag, and none after it", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(<Layout model={model} />);
        startDrag(model, "t2");
        over(path("/layout"));
        const targets = tabsets().filter((el) =>
            el.hasAttribute("data-drop-target"),
        );
        expect(targets).toHaveLength(1);
        expect(targets[0]?.getAttribute("data-drop-location")).toMatch(
            /^(center|top|bottom|left|right)$/,
        );
        act(() => {
            path("/layout").dispatchEvent(dragEvent("drop"));
        });
        expect(
            tabsets().filter((el) => el.hasAttribute("data-drop-target")),
        ).toHaveLength(0);
        expect(
            tabsets().filter((el) => el.hasAttribute("data-drop-location")),
        ).toHaveLength(0);
    });
});

describe("refused drops", () => {
    function refusedAttributes() {
        return {
            root: path("/layout").hasAttribute("data-drop-refused"),
            indicator: path("/outline").hasAttribute("data-drop-refused"),
            indicatorHidden: path("/outline").style.display === "none",
            refusedTabsets: tabsets().filter((el) =>
                el.hasAttribute("data-drop-refused"),
            ).length,
            targets: tabsets().filter((el) =>
                el.hasAttribute("data-drop-target"),
            ).length,
        };
    }

    const refuseAll = () => false;

    it("are shown on the root, the indicator and the refusing tabset", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(
            <Layout model={model} onAllowDrop={refuseAll}>
                <Dockable.DropIndicator />
            </Layout>,
        );
        startDrag(model, "t2");
        over(path("/layout"));
        expect(refusedAttributes()).toEqual({
            root: true,
            indicator: true,
            indicatorHidden: true,
            refusedTabsets: 1,
            targets: 0,
        });
        act(() => {
            DragDropManager.getDragState()
                ?.mainEngine.getDragDropManager()
                .onDragEnded();
        });
        expect(path("/layout")).not.toHaveAttribute("data-drop-refused");
    });

    it("look the same whether the rule comes from the Root prop or model.setOnAllowDrop", () => {
        const viaProp = Model.fromJson(structuredClone(twoTabsets));
        const first = render(
            <Layout model={viaProp} onAllowDrop={refuseAll}>
                <Dockable.DropIndicator />
            </Layout>,
        );
        startDrag(viaProp, "t2");
        over(path("/layout"));
        const withProp = refusedAttributes();
        act(() => {
            DragDropManager.getDragState()
                ?.mainEngine.getDragDropManager()
                .onDragEnded();
        });
        first.unmount();

        const viaModel = Model.fromJson(structuredClone(twoTabsets));
        viaModel.setOnAllowDrop(refuseAll);
        render(
            <Layout model={viaModel}>
                <Dockable.DropIndicator />
            </Layout>,
        );
        startDrag(viaModel, "t2");
        over(path("/layout"));
        expect(refusedAttributes()).toEqual(withProp);
    });

    it("restores the model's own rule when the prop is removed", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        const own = () => true;
        model.setOnAllowDrop(own);
        const { rerender } = render(
            <Layout model={model} onAllowDrop={refuseAll} />,
        );
        expect(model.getOnAllowDrop()).not.toBe(own);
        rerender(<Layout model={model} />);
        expect(model.getOnAllowDrop()).toBe(own);
    });
});

describe("Dockable.DropZone", () => {
    it("takes a drag of its model and hands over the node without moving it", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        const before = JSON.stringify(model.toJson());
        const onDrop = vi.fn();
        render(
            <>
                <Dockable.DropZone
                    model={model}
                    onDrop={onDrop}
                    data-testid="trash"
                >
                    Trash
                </Dockable.DropZone>
                <Layout model={model} />
            </>,
        );
        const zone = screen.getByTestId("trash");
        expect(zone).not.toHaveAttribute("data-drop-active");

        startDrag(model, "t1");
        expect(zone).toHaveAttribute("data-drop-active", "");
        expect(zone).not.toHaveAttribute("data-drop-over");
        over(zone);
        expect(zone).toHaveAttribute("data-drop-over", "");

        act(() => {
            zone.dispatchEvent(dragEvent("drop"));
        });
        expect(onDrop).toHaveBeenCalledTimes(1);
        expect((onDrop.mock.calls[0]?.[0] as Node).getId()).toBe("t1");
        expect(JSON.stringify(model.toJson())).toBe(before);
        expect(zone).not.toHaveAttribute("data-drop-over");
        expect(zone).not.toHaveAttribute("data-drop-active");
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("is inactive for drags it does not accept", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        const onDrop = vi.fn();
        render(
            <>
                <Dockable.DropZone
                    model={model}
                    accepts={(node) => node.getId() !== "t1"}
                    onDrop={onDrop}
                    data-testid="zone"
                />
                <Layout model={model} />
            </>,
        );
        const zone = screen.getByTestId("zone");
        startDrag(model, "t1");
        expect(zone).not.toHaveAttribute("data-drop-active");
        over(zone);
        act(() => {
            zone.dispatchEvent(dragEvent("drop"));
        });
        expect(zone).not.toHaveAttribute("data-drop-over");
        expect(onDrop).not.toHaveBeenCalled();
    });

    it("supports render, state functions, and renders only its children", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(
            <>
                <Dockable.DropZone
                    model={model}
                    onDrop={() => {}}
                    render={<section />}
                    className={(state) => (state.active ? "armed" : "idle")}
                    data-testid="zone"
                />
                <Layout model={model} />
            </>,
        );
        const zone = screen.getByTestId("zone");
        expect(zone.tagName).toBe("SECTION");
        expect(zone).toHaveClass("idle");
        expect(zone.textContent).toBe("");
        startDrag(model, "t0");
        expect(zone).toHaveClass("armed");
    });
});

describe("tab group drops", () => {
    it("mark the tabset as the target, but not its strip", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        const { rerender } = render(<Layout model={model} />);
        const manager = LayoutEngine.of(model)?.getDragDropManager();
        if (!manager) throw new Error("no engine");
        const idle = manager.getIndicatorState();
        // a drop into a group of ts0: the group is the target node, its index counts inside it
        vi.spyOn(manager, "getIndicatorState").mockReturnValue({
            ...idle,
            visible: true,
            dragging: true,
            location: "center",
            index: 0,
            targetNodeId: "a-group",
            targetTabSetId: "ts0",
        });
        rerender(<Layout model={model} data-rerender="" />);
        expect(path("/ts0")).toHaveAttribute("data-drop-target", "");
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-drop-target");
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-drop-index");
        vi.restoreAllMocks();
    });
});
