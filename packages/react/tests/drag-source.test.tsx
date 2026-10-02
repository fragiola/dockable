import {
    createModel,
    DRAG_TYPE,
    DragDropManager,
    type DragEventLike,
    type ExternalDrag,
    type NewTabDropped,
    type TabInitOf,
} from "@fragiola/dockable";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";
import { Layout, recordCommands, type Types, twoTabsets } from "./layout";

function freshModel() {
    return createModel<Types>(structuredClone(twoTabsets));
}

/** A fake DataTransfer: the types a drag carries, and spies for what the core sets. */
function fakeDataTransfer(types: string[] = []) {
    return {
        types,
        setData: vi.fn((type: string, _data: string) => {
            if (!types.includes(type)) types.push(type);
        }),
        setDragImage: vi.fn<(image: Element, x: number, y: number) => void>(),
        effectAllowed: "none",
        dropEffect: "none",
    };
}

// jsdom has no DragEvent: a MouseEvent with a fake dataTransfer carries what the core reads
function dragEvent(type: string, dataTransfer = fakeDataTransfer()) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: 10,
        clientY: 10,
    });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    return event as unknown as DragEvent;
}

afterEach(() => {
    if (DragDropManager.getDragState()) {
        act(() => {
            DragDropManager.endDrag();
        });
    }
});

const chart: TabInitOf<Types> = {
    component: "test",
    label: "Revenue",
    data: { name: "Revenue" },
};

describe("Dockable.DragSource", () => {
    it("starts an add drag of its tab, marking itself and the root as dragging", () => {
        const model = freshModel();
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    tab={chart}
                    data-testid="source"
                >
                    Revenue chart
                </Dockable.DragSource>
                <Layout model={model} />
            </>,
        );
        const before = model.state;
        const source = screen.getByTestId("source");
        expect(source).toHaveAttribute("draggable", "true");
        const dataTransfer = fakeDataTransfer();
        act(() => {
            source.dispatchEvent(dragEvent("dragstart", dataTransfer));
        });
        const state = DragDropManager.getDragState();
        expect(state?.source).toBe("add");
        expect(state?.subjectOf(model)).toEqual({ kind: "new", tab: chart });
        expect(state?.mainEngine.adapter.model).toBe(model);
        expect(dataTransfer.types).toContain(DRAG_TYPE);
        expect(dataTransfer.effectAllowed).toBe("copy");
        expect(dataTransfer.setDragImage).toHaveBeenCalledWith(source, 10, 10);
        expect(source).toHaveAttribute("data-dragging", "");
        expect(screen.getByTestId("root")).toHaveAttribute("data-dragging", "");

        act(() => {
            source.dispatchEvent(dragEvent("dragend", dataTransfer));
        });
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(source).not.toHaveAttribute("data-dragging");
        expect(screen.getByTestId("root")).not.toHaveAttribute("data-dragging");
        // the model was not touched by a drag that was never dropped
        expect(model.state).toBe(before);
    });

    it("adds its tab where it is dropped, and reports the new tab's id", () => {
        const model = freshModel();
        const commands = recordCommands(model);
        const onDrop = vi.fn<NewTabDropped>();
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    tab={chart}
                    onDrop={onDrop}
                    data-testid="source"
                />
                <Layout model={model} />
            </>,
        );
        const root = screen.getByTestId("root");
        const dataTransfer = fakeDataTransfer();
        act(() => {
            screen
                .getByTestId("source")
                .dispatchEvent(dragEvent("dragstart", dataTransfer));
        });
        act(() => {
            root.dispatchEvent(dragEvent("dragenter", dataTransfer));
            root.dispatchEvent(dragEvent("dragover", dataTransfer));
            root.dispatchEvent(dragEvent("drop", dataTransfer));
        });
        expect(commands.map((c) => c.command)).toContain("tab.add");
        expect(commands.find((c) => c.command === "tab.add")?.payload).toEqual(
            expect.objectContaining({
                component: "test",
                label: chart.label,
                data: chart.data,
            }),
        );
        expect(onDrop).toHaveBeenCalledTimes(1);
        const id = onDrop.mock.calls[0]?.[0];
        expect(typeof id).toBe("string");
        const added =
            id === undefined ? undefined : model.get("node-by", { id });
        expect(added?.type).toBe("tab");
        expect(added?.type === "tab" ? added.data : undefined).toEqual(
            chart.data,
        );
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("builds the tab at each drag start when given a function", () => {
        const model = freshModel();
        let n = 0;
        const tab = vi.fn(
            (): TabInitOf<Types> => ({
                component: "test",
                label: `Chart ${++n}`,
                data: { name: `Chart ${n}` },
            }),
        );
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    tab={tab}
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
            const subject = DragDropManager.getDragState()?.subjectOf(model);
            expect(
                subject?.kind === "new" ? subject.tab.data.name : undefined,
            ).toBe(expected);
            act(() => {
                source.dispatchEvent(dragEvent("dragend"));
            });
        }
        expect(tab).toHaveBeenCalledTimes(2);
    });

    it("cancels the drag when disabled, or when no layout of the model is mounted", () => {
        const model = freshModel();
        const { rerender } = render(
            <Dockable.DragSource
                model={model}
                tab={chart}
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
                    tab={chart}
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
        const model = freshModel();
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    tab={chart}
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
        const model = freshModel();
        const onDragStart = vi.fn(() => {
            expect(DragDropManager.getDragState()?.source).toBe("add");
        });
        render(
            <>
                <Dockable.DragSource
                    model={model}
                    tab={chart}
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
        const model = freshModel();
        const onExternalDrag = vi.fn(
            (event: DragEventLike): ExternalDrag<Types> | undefined =>
                event.dataTransfer?.types.includes("Files")
                    ? {
                          tab: {
                              component: "test",
                              label: "file",
                              data: { name: "file" },
                          },
                      }
                    : undefined,
        );
        render(<Layout model={model} onExternalDrag={onExternalDrag} />);
        const root = screen.getByTestId("root");

        act(() => {
            root.dispatchEvent(
                dragEvent("dragenter", fakeDataTransfer(["text/plain"])),
            );
        });
        expect(onExternalDrag).toHaveBeenCalledTimes(1);
        expect(DragDropManager.getDragState()).toBeUndefined();
        act(() => {
            root.dispatchEvent(dragEvent("dragleave"));
        });

        act(() => {
            root.dispatchEvent(
                dragEvent("dragenter", fakeDataTransfer(["Files"])),
            );
        });
        const state = DragDropManager.getDragState();
        expect(state?.source).toBe("external");
        expect(state?.subjectOf(model)).toEqual({
            kind: "new",
            tab: { component: "test", label: "file", data: { name: "file" } },
        });
        expect(root).toHaveAttribute("data-dragging", "");

        act(() => {
            root.dispatchEvent(dragEvent("dragleave"));
        });
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(root).not.toHaveAttribute("data-dragging");
    });

    it("never asks about a drag that carries Dockable's type", () => {
        const model = freshModel();
        const onExternalDrag = vi.fn(() => undefined);
        render(<Layout model={model} onExternalDrag={onExternalDrag} />);
        act(() => {
            screen
                .getByTestId("root")
                .dispatchEvent(
                    dragEvent("dragenter", fakeDataTransfer([DRAG_TYPE])),
                );
        });
        expect(onExternalDrag).not.toHaveBeenCalled();
    });

    it("uses the latest handler after a re-render", () => {
        const model = freshModel();
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
