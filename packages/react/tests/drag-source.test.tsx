import {
    DragDropManager,
    type IJsonTabNode,
    LayoutEngine,
    Model,
} from "@fragiola/dockable";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";
import { Layout, twoTabsets } from "./layout";

// jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carries what the core reads
function dragEvent(type: string, types: string[] = []) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10,
    });
    Object.defineProperty(event, "dataTransfer", {
        value: {
            types,
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

const chart: IJsonTabNode = {
    type: "tab",
    name: "Revenue",
    component: "chart",
};

describe("Dockable.DragSource", () => {
    it("starts an add drag of its tab, marking itself and the root as dragging", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    json={chart}
                    data-testid="source"
                >
                    Revenue chart
                </Dockable.DragSource>
                <Layout model={model} />
            </>,
        );
        const source = screen.getByTestId("source");
        expect(source).toHaveAttribute("draggable", "true");
        const start = dragEvent("dragstart");
        act(() => {
            source.dispatchEvent(start);
        });
        const state = DragDropManager.getDragState();
        expect(state?.dragSource).toBe("add");
        expect(state?.dragJson).toEqual(chart);
        expect(state?.mainEngine).toBe(LayoutEngine.of(model));
        expect(start.dataTransfer?.setDragImage).toHaveBeenCalledWith(
            source,
            10,
            10,
        );
        expect(source).toHaveAttribute("data-dragging", "");
        expect(screen.getByTestId("root")).toHaveAttribute("data-dragging", "");

        act(() => {
            source.dispatchEvent(dragEvent("dragend"));
        });
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(source).not.toHaveAttribute("data-dragging");
        expect(screen.getByTestId("root")).not.toHaveAttribute("data-dragging");
        // the model was not touched by a drag that was never dropped
        expect(model.toJson()).toEqual(
            Model.fromJson(structuredClone(twoTabsets)).toJson(),
        );
    });

    it("builds the tab json at each drag start when given a function", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        let n = 0;
        const json = vi.fn(() => ({
            type: "tab" as const,
            name: `Chart ${++n}`,
        }));
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    json={json}
                    data-testid="source"
                />
                <Layout model={model} />
            </>,
        );
        const source = screen.getByTestId("source");
        for (const expected of ["Chart 1", "Chart 2"]) {
            act(() => {
                source.dispatchEvent(dragEvent("dragstart"));
            });
            expect(DragDropManager.getDragState()?.dragJson?.name).toBe(
                expected,
            );
            act(() => {
                source.dispatchEvent(dragEvent("dragend"));
            });
        }
    });

    it("cancels the drag when disabled, or when no layout of the model is mounted", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        const { rerender } = render(
            <Dockable.DragSource
                model={model}
                json={chart}
                data-testid="source"
            />,
        );
        const unmounted = dragEvent("dragstart");
        screen.getByTestId("source").dispatchEvent(unmounted);
        expect(unmounted.defaultPrevented).toBe(true);
        expect(DragDropManager.getDragState()).toBeUndefined();

        rerender(
            <>
                <Dockable.DragSource
                    model={model}
                    json={chart}
                    disabled
                    data-testid="source"
                />
                <Layout model={model} />
            </>,
        );
        const source = screen.getByTestId("source");
        expect(source).toHaveAttribute("draggable", "false");
        expect(source).toHaveAttribute("data-disabled", "");
        expect(source).toHaveAttribute("aria-disabled", "true");
        const disabled = dragEvent("dragstart");
        source.dispatchEvent(disabled);
        expect(disabled.defaultPrevented).toBe(true);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("renders its children only, and supports render and state functions", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    json={chart}
                    render={<li />}
                    className={(state) =>
                        state.dragging ? "is-dragging" : "idle"
                    }
                    data-testid="source"
                />
                <Layout model={model} />
            </>,
        );
        const source = screen.getByTestId("source");
        expect(source.tagName).toBe("LI");
        expect(source).toHaveClass("idle");
        expect(source.textContent).toBe("");
        act(() => {
            source.dispatchEvent(dragEvent("dragstart"));
        });
        expect(source).toHaveClass("is-dragging");
    });

    it("composes the consumer's drag handlers after its own", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        const onDragStart = vi.fn(() => {
            expect(DragDropManager.getDragState()?.dragSource).toBe("add");
        });
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    json={chart}
                    onDragStart={onDragStart}
                    data-testid="source"
                />
                <Layout model={model} />
            </>,
        );
        act(() => {
            screen.getByTestId("source").dispatchEvent(dragEvent("dragstart"));
        });
        expect(onDragStart).toHaveBeenCalledTimes(1);
    });
});

describe("Dockable.Root onExternalDrag", () => {
    it("asks on a foreign dragenter and turns an accepted drag into an external drag", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        const onExternalDrag = vi.fn(
            (event: Pick<DragEvent, "dataTransfer">) =>
                event.dataTransfer?.types.includes("Files")
                    ? { json: { type: "tab" as const, name: "file" } }
                    : undefined,
        );
        render(<Layout model={model} onExternalDrag={onExternalDrag} />);
        const root = screen.getByTestId("root");

        act(() => {
            root.dispatchEvent(dragEvent("dragenter", ["text/plain"]));
        });
        expect(onExternalDrag).toHaveBeenCalledTimes(1);
        expect(DragDropManager.getDragState()).toBeUndefined();
        act(() => {
            root.dispatchEvent(dragEvent("dragleave"));
        });

        act(() => {
            root.dispatchEvent(dragEvent("dragenter", ["Files"]));
        });
        expect(DragDropManager.getDragState()?.dragSource).toBe("external");
        expect(root).toHaveAttribute("data-dragging", "");

        act(() => {
            root.dispatchEvent(dragEvent("dragleave"));
        });
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(root).not.toHaveAttribute("data-dragging");
    });

    it("uses the latest handler after a re-render", () => {
        const model = Model.fromJson(structuredClone(twoTabsets));
        const first = vi.fn(() => undefined);
        const second = vi.fn(() => undefined);
        const { rerender } = render(
            <Layout model={model} onExternalDrag={first} />,
        );
        rerender(<Layout model={model} onExternalDrag={second} />);
        act(() => {
            screen.getByTestId("root").dispatchEvent(dragEvent("dragenter"));
        });
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });
});
