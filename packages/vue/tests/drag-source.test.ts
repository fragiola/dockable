import {
    createModel,
    DRAG_TYPE,
    DragDropManager,
    type DragEventLike,
    type ExternalDrag,
    type NewTabDropped,
    type TabInitOf,
} from "@fragiola/dockable";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Component, defineComponent, h, nextTick, shallowRef } from "vue";
import { byTestId, dragEvent, fakeDataTransfer } from "./drag";
import {
    Dockable,
    Layout,
    recordCommands,
    render,
    renderLayout,
    type Types,
    twoTabsets,
} from "./layout";

function freshModel() {
    return createModel<Types>(structuredClone(twoTabsets));
}

const drag = (type: string, dataTransfer = fakeDataTransfer([])) =>
    dragEvent(type, 10, 10, dataTransfer);

afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
});

const chart: TabInitOf<Types> = {
    component: "test",
    label: "Revenue",
    data: { name: "Revenue" },
};

/** a drag source (with `props` and `slots`) beside the fixture layout */
function withLayout(
    model: ReturnType<typeof freshModel>,
    props: Record<string, unknown>,
    slots?: Record<string, unknown>,
) {
    return render(
        defineComponent({
            setup: () => () => [
                h(Dockable.DragSource as Component, { model, ...props }, slots),
                h(Layout, { model }),
            ],
        }),
    );
}

describe("Dockable.DragSource", () => {
    it("starts an add drag of its tab, marking itself and the root as dragging", async () => {
        const model = freshModel();
        await withLayout(
            model,
            { tab: chart, "data-testid": "source" },
            { default: () => "Revenue chart" },
        );
        const before = model.state;
        const source = byTestId("source");
        expect(source).toHaveAttribute("draggable", "true");
        const dataTransfer = fakeDataTransfer([]);
        source.dispatchEvent(drag("dragstart", dataTransfer));
        await nextTick();
        const state = DragDropManager.getDragState();
        expect(state?.source).toBe("add");
        expect(state?.subjectOf(model)).toEqual({ kind: "new", tab: chart });
        expect(state?.mainEngine.adapter.model).toBe(model);
        expect(dataTransfer.types).toContain(DRAG_TYPE);
        expect(dataTransfer.effectAllowed).toBe("copy");
        expect(dataTransfer.setDragImage).toHaveBeenCalledWith(source, 10, 10);
        expect(source).toHaveAttribute("data-dragging", "");
        expect(byTestId("root")).toHaveAttribute("data-dragging", "");

        source.dispatchEvent(drag("dragend", dataTransfer));
        await nextTick();
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(source).not.toHaveAttribute("data-dragging");
        expect(byTestId("root")).not.toHaveAttribute("data-dragging");
        // the model was not touched by a drag that was never dropped
        expect(model.state).toBe(before);
    });

    it("adds its tab where it is dropped, and reports the new tab's id", async () => {
        const model = freshModel();
        const commands = recordCommands(model);
        const onDrop = vi.fn<NewTabDropped>();
        await withLayout(model, {
            tab: chart,
            onDrop,
            "data-testid": "source",
        });
        const root = byTestId("root");
        const dataTransfer = fakeDataTransfer([]);
        byTestId("source").dispatchEvent(drag("dragstart", dataTransfer));
        await nextTick();
        root.dispatchEvent(drag("dragenter", dataTransfer));
        root.dispatchEvent(drag("dragover", dataTransfer));
        root.dispatchEvent(drag("drop", dataTransfer));
        await nextTick();
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

    it("builds the tab at each drag start when given a function", async () => {
        const model = freshModel();
        let n = 0;
        const tab = vi.fn(
            (): TabInitOf<Types> => ({
                component: "test",
                label: `Chart ${++n}`,
                data: { name: `Chart ${n}` },
            }),
        );
        await withLayout(model, { tab, "data-testid": "source" });
        const source = byTestId("source");
        for (const expected of ["Chart 1", "Chart 2"]) {
            source.dispatchEvent(drag("dragstart"));
            const subject = DragDropManager.getDragState()?.subjectOf(model);
            expect(
                subject?.kind === "new" ? subject.tab.data.name : undefined,
            ).toBe(expected);
            source.dispatchEvent(drag("dragend"));
            await nextTick();
        }
        expect(tab).toHaveBeenCalledTimes(2);
    });

    it("cancels the drag when disabled, or when no layout of the model is mounted", async () => {
        const model = freshModel();
        const withRoot = shallowRef(false);
        await render(
            defineComponent({
                setup: () => () => [
                    h(Dockable.DragSource, {
                        model,
                        tab: chart,
                        disabled: withRoot.value,
                        "data-testid": "source",
                    }),
                    withRoot.value ? h(Layout, { model }) : null,
                ],
            }),
        );
        const unmounted = drag("dragstart");
        byTestId("source").dispatchEvent(unmounted);
        expect(unmounted.defaultPrevented).toBe(true);
        expect(DragDropManager.getDragState()).toBeUndefined();

        withRoot.value = true;
        await nextTick();
        const source = byTestId("source");
        expect(source).toHaveAttribute("draggable", "false");
        expect(source).toHaveAttribute("data-disabled", "");
        expect(source).toHaveAttribute("aria-disabled", "true");
        const disabled = drag("dragstart");
        source.dispatchEvent(disabled);
        expect(disabled.defaultPrevented).toBe(true);
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("renders its slot only, and supports `as` and the slot's state", async () => {
        const model = freshModel();
        await withLayout(
            model,
            { tab: chart, as: "li", "data-testid": "source" },
            {
                render: ({
                    props,
                    state,
                }: {
                    props: Record<string, unknown>;
                    state: { dragging: boolean };
                }) => [
                    h("li", {
                        ...props,
                        class: state.dragging ? "is-dragging" : "idle",
                    }),
                ],
            },
        );
        const source = byTestId("source");
        expect(source.tagName).toBe("LI");
        expect(source).toHaveClass("idle");
        expect(source.textContent).toBe("");
        source.dispatchEvent(drag("dragstart"));
        await nextTick();
        expect(byTestId("source")).toHaveClass("is-dragging");
    });

    it("composes the consumer's drag listeners after its own", async () => {
        const model = freshModel();
        const onDragstart = vi.fn(() => {
            expect(DragDropManager.getDragState()?.source).toBe("add");
        });
        await withLayout(model, {
            tab: chart,
            onDragstart,
            "data-testid": "source",
        });
        byTestId("source").dispatchEvent(drag("dragstart"));
        expect(onDragstart).toHaveBeenCalledTimes(1);
    });
});

describe("Dockable.Root onExternalDrag", () => {
    it("asks on a foreign dragenter and turns an accepted drag into an external drag", async () => {
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
        await renderLayout(model, { onExternalDrag });
        const root = byTestId("root");

        root.dispatchEvent(drag("dragenter", fakeDataTransfer(["text/plain"])));
        expect(onExternalDrag).toHaveBeenCalledTimes(1);
        expect(DragDropManager.getDragState()).toBeUndefined();
        root.dispatchEvent(drag("dragleave"));

        root.dispatchEvent(drag("dragenter", fakeDataTransfer(["Files"])));
        await nextTick();
        const state = DragDropManager.getDragState();
        expect(state?.source).toBe("external");
        expect(state?.subjectOf(model)).toEqual({
            kind: "new",
            tab: { component: "test", label: "file", data: { name: "file" } },
        });
        expect(root).toHaveAttribute("data-dragging", "");

        root.dispatchEvent(drag("dragleave"));
        await nextTick();
        expect(DragDropManager.getDragState()).toBeUndefined();
        expect(root).not.toHaveAttribute("data-dragging");
    });

    it("never asks about a drag that carries Dockable's type", async () => {
        const model = freshModel();
        const onExternalDrag = vi.fn(() => undefined);
        await renderLayout(model, { onExternalDrag });
        byTestId("root").dispatchEvent(
            drag("dragenter", fakeDataTransfer([DRAG_TYPE])),
        );
        expect(onExternalDrag).not.toHaveBeenCalled();
    });

    it("uses the latest handler after a re-render", async () => {
        const model = freshModel();
        const first = vi.fn(() => undefined);
        const second = vi.fn(() => undefined);
        const handler = shallowRef<() => undefined>(first);
        await render(
            defineComponent({
                setup: () => () =>
                    h(Layout, { model, onExternalDrag: handler.value }),
            }),
        );
        handler.value = second;
        await nextTick();
        byTestId("root").dispatchEvent(drag("dragenter"));
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });
});
