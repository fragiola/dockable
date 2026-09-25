import { DragDropManager, Model, type TabNode } from "@fragiola/dockable";
import { act, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable, useDockable } from "../src";
import { Layout, twoTabsets } from "./layout";

const path = (p: string) => {
    const element = document.querySelector<HTMLElement>(
        `[data-layout-path="${p}"]`,
    );
    if (!element) throw new Error(`no element at ${p}`);
    return element;
};

// jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carries what the core reads
function dragEvent(type: string, x: number, y: number) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, "dataTransfer", {
        value: {
            setData: vi.fn(),
            setDragImage: vi.fn(),
            effectAllowed: "none",
            dropEffect: "none",
        },
    });
    return event as unknown as DragEvent;
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

describe("Dockable.Tab dragging", () => {
    it("is draggable only when the tab enables drag", () => {
        const model = Model.fromJson({
            global: {},
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", id: "a", name: "A" },
                            {
                                type: "tab",
                                id: "b",
                                name: "B",
                                enableDrag: false,
                            },
                        ],
                    },
                ],
            },
        });
        render(<Layout model={model} />);
        expect(path("/ts0/tb0")).toHaveAttribute("draggable", "true");
        expect(path("/ts0/tb1")).toHaveAttribute("draggable", "false");
    });

    it("starts a drag on dragstart, marking the tab and the root as dragging", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(<Layout model={model} />);
        const tab = path("/ts0/tb1");
        act(() => {
            tab.dispatchEvent(dragEvent("dragstart", 10, 10));
        });
        expect(DragDropManager.getDragState()?.dragNode?.getId()).toBe("t1");
        expect(tab).toHaveAttribute("data-dragging", "");
        expect(path("/layout")).toHaveAttribute("data-dragging", "");
        expect(path("/ts0/tb0")).not.toHaveAttribute("data-dragging");

        act(() => {
            tab.dispatchEvent(dragEvent("dragend", 10, 10));
        });
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(tab).not.toHaveAttribute("data-dragging");
        expect(path("/layout")).not.toHaveAttribute("data-dragging");
    });

    it("cancels the dragstart of a tab that cannot be dragged", () => {
        const model = Model.fromJson({
            global: { tabEnableDrag: false },
            layout: {
                type: "row",
                children: [
                    { type: "tabset", children: [{ type: "tab", name: "A" }] },
                ],
            },
        });
        render(<Layout model={model} />);
        const event = dragEvent("dragstart", 0, 0);
        path("/ts0/tb0").dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });
});

describe("Dockable.DropIndicator", () => {
    function DragFrom({ tabId }: { tabId: string }) {
        const { engine, model } = useDockable();
        return (
            <button
                type="button"
                data-testid="start"
                onClick={() =>
                    engine
                        .getDragDropManager()
                        .setDragNode(
                            dragEvent("dragstart", 0, 0),
                            model.getNodeById(tabId) as TabNode,
                        )
                }
            />
        );
    }

    it("is hidden outside a drag and follows the computed drop rect during one", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(
            <Layout model={model}>
                <Dockable.DropIndicator data-testid="indicator" />
                <DragFrom tabId="t2" />
            </Layout>,
        );
        const indicator = screen.getByTestId("indicator");
        expect(indicator).toHaveAttribute("data-layout-path", "/outline");
        expect(indicator).toHaveAttribute("aria-hidden", "true");
        expect(indicator.style.display).toBe("none");
        expect(indicator).not.toHaveAttribute("data-drop-location");

        act(() => {
            screen.getByTestId("start").click();
        });
        const root = path("/layout");
        act(() => {
            root.dispatchEvent(dragEvent("dragenter", 50, 50));
        });
        expect(indicator).toHaveAttribute("data-dragging", "");
        expect(indicator.style.display).toBe("none"); // 1x1 at the pointer, not yet over a target

        act(() => {
            root.dispatchEvent(dragEvent("dragover", 50, 50));
        });
        expect(indicator).toHaveAttribute("data-visible", "");
        expect(indicator.getAttribute("data-drop-location")).toMatch(
            /^(center|top|bottom|left|right)$/,
        );
        expect(indicator.getAttribute("data-drop-kind")).toMatch(
            /^(rect|edge)$/,
        );
        expect(indicator.style.display).toBe("");
        expect(indicator.style.position).toBe("absolute");
        const keys = Array.from({ length: indicator.style.length }, (_, i) =>
            indicator.style.item(i),
        ).sort();
        expect(keys).toEqual([
            "height",
            "left",
            "pointer-events",
            "position",
            "top",
            "width",
        ]);
        expect(indicator.style.pointerEvents).toBe("none");

        act(() => {
            root.dispatchEvent(dragEvent("drop", 50, 50));
        });
        expect(indicator.style.display).toBe("none");
        expect(indicator).not.toHaveAttribute("data-dragging");
    });

    it("supports render and children", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(
            <Layout model={model}>
                <Dockable.DropIndicator
                    render={<section data-testid="indicator" />}
                >
                    <span data-testid="inside" />
                </Dockable.DropIndicator>
            </Layout>,
        );
        expect(screen.getByTestId("indicator").tagName).toBe("SECTION");
        expect(screen.getByTestId("inside")).toBeInTheDocument();
    });

    it("renders no text of its own", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(
            <Dockable.Root model={model}>
                <Dockable.DropIndicator data-testid="indicator" />
            </Dockable.Root>,
        );
        expect(screen.getByTestId("indicator").textContent).toBe("");
        expect(React.isValidElement(<Dockable.DropIndicator />)).toBe(true);
    });
});
