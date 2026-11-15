import {
    createModel,
    DragDropManager,
    type DropZoneOptions,
    type LayoutJson,
    type Model,
    veto,
} from "@fragiola/dockable";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Component, defineComponent, h, nextTick } from "vue";
import { byTestId, dragEvent, path } from "./drag";
import {
    Dockable,
    Layout,
    render,
    renderLayout,
    type Types,
    twoTabsets,
} from "./layout";

// jsdom measures every element as 100x100 at (0, 0) (tests/setup.ts), so a drag over (50, 50)
// always has a target: the hit test's first tabset.

function freshModel(json: LayoutJson<Types> = twoTabsets) {
    return createModel<Types>(structuredClone(json));
}

/** Starts dragging the tab whose button is at `tabPath` (`/ts1/tb0` is t2, `/ts0/tb1` is t1). */
async function startDrag(tabPath: string) {
    path(tabPath).dispatchEvent(dragEvent("dragstart", 0, 0));
    await nextTick();
}

async function over(element: HTMLElement) {
    element.dispatchEvent(dragEvent("dragenter"));
    element.dispatchEvent(dragEvent("dragover"));
    await nextTick();
}

async function endDrag() {
    DragDropManager.endDrag();
    await nextTick();
}

afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
});

const tabsets = () =>
    Array.from(
        document.querySelectorAll<HTMLElement>('[data-layout-path^="/ts"]'),
    ).filter((el) =>
        /^\/ts\d$/.test(el.getAttribute("data-layout-path") ?? ""),
    );

const withIndicator = (model: Model<Types>) =>
    renderLayout(model, {}, () => [h(Dockable.DropIndicator)]);

describe("drop target attributes", () => {
    it("mark exactly one tabset during a drag, and none after it", async () => {
        const model = freshModel();
        await renderLayout(model);
        await startDrag("/ts1/tb0");
        await over(path("/layout"));
        const targets = tabsets().filter((el) =>
            el.hasAttribute("data-drop-target"),
        );
        expect(targets).toHaveLength(1);
        expect(targets[0]?.getAttribute("data-drop-location")).toMatch(
            /^(center|top|bottom|start|end)$/,
        );
        path("/layout").dispatchEvent(dragEvent("drop"));
        await nextTick();
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

    /** a middleware that refuses every move */
    const refuseMoves = (model: Model<Types>) =>
        model.use((ctx, next) =>
            ctx.command === "tab.move" ? veto("no moves") : next(),
        );

    it("are shown on the root, the indicator and the refusing tabset", async () => {
        const model = freshModel();
        refuseMoves(model);
        await withIndicator(model);
        await startDrag("/ts1/tb0");
        await over(path("/layout"));
        expect(refusedAttributes()).toEqual({
            root: true,
            indicator: true,
            indicatorHidden: true,
            refusedTabsets: 1,
            targets: 0,
        });
        await endDrag();
        expect(path("/layout")).not.toHaveAttribute("data-drop-refused");
    });

    it("look the same whether a middleware or the layout's own rules refuse", async () => {
        const viaMiddleware = freshModel();
        refuseMoves(viaMiddleware);
        const first = await withIndicator(viaMiddleware);
        await startDrag("/ts1/tb0");
        await over(path("/layout"));
        const withMiddleware = refusedAttributes();
        expect(withMiddleware.root).toBe(true);
        await endDrag();
        first.unmount();

        // no tabset takes a drop into it or beside it
        const viaRules = freshModel({
            ...twoTabsets,
            defaults: { tabset: { droppable: false, splittable: false } },
        });
        await withIndicator(viaRules);
        await startDrag("/ts1/tb0");
        await over(path("/layout"));
        expect(refusedAttributes()).toEqual(withMiddleware);
    });

    it("stop once the refusing middleware is removed", async () => {
        const model = freshModel();
        const remove = refuseMoves(model);
        await withIndicator(model);
        await startDrag("/ts1/tb0");
        await over(path("/layout"));
        expect(path("/layout")).toHaveAttribute("data-drop-refused", "");
        await endDrag();

        remove();
        await startDrag("/ts1/tb0");
        await over(path("/layout"));
        expect(refusedAttributes()).toEqual({
            root: false,
            indicator: false,
            indicatorHidden: false,
            refusedTabsets: 0,
            targets: 1,
        });
    });
});

/** a drop zone (with `props` and `slots`) beside the fixture layout */
function withZone(
    model: Model<Types>,
    props: Record<string, unknown>,
    slots?: Record<string, unknown>,
) {
    return render(
        defineComponent({
            setup: () => () => [
                h(Dockable.DropZone as Component, { model, ...props }, slots),
                h(Layout, { model }),
            ],
        }),
    );
}

describe("Dockable.DropZone", () => {
    it("takes a drag of its model and hands over what is dragged without moving it", async () => {
        const model = freshModel();
        const onDrop = vi.fn<DropZoneOptions<Types>["onDrop"]>();
        await withZone(
            model,
            { onDrop, "data-testid": "trash" },
            { default: () => "Trash" },
        );
        const before = model.state;
        const zone = byTestId("trash");
        expect(zone).not.toHaveAttribute("data-drop-active");

        await startDrag("/ts0/tb1");
        expect(zone).toHaveAttribute("data-drop-active", "");
        expect(zone).not.toHaveAttribute("data-drop-over");
        await over(zone);
        expect(zone).toHaveAttribute("data-drop-over", "");

        zone.dispatchEvent(dragEvent("drop"));
        await nextTick();
        expect(onDrop).toHaveBeenCalledTimes(1);
        const dropped = onDrop.mock.calls[0]?.[0];
        expect(dropped?.kind === "tab" ? dropped.tab.id : undefined).toBe("t1");
        expect(model.state).toBe(before);
        expect(zone).not.toHaveAttribute("data-drop-over");
        expect(zone).not.toHaveAttribute("data-drop-active");
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("is inactive for drags it does not accept", async () => {
        const model = freshModel();
        const onDrop = vi.fn<DropZoneOptions<Types>["onDrop"]>();
        await withZone(model, {
            accepts: (drag: Parameters<DropZoneOptions<Types>["onDrop"]>[0]) =>
                drag.kind !== "tab" || drag.tab.id !== "t1",
            onDrop,
            "data-testid": "zone",
        });
        const zone = byTestId("zone");
        await startDrag("/ts0/tb1");
        expect(zone).not.toHaveAttribute("data-drop-active");
        await over(zone);
        zone.dispatchEvent(dragEvent("drop"));
        await nextTick();
        expect(zone).not.toHaveAttribute("data-drop-over");
        expect(onDrop).not.toHaveBeenCalled();
    });

    it("supports `as`, the render slot's state, and renders only its slot", async () => {
        const model = freshModel();
        await withZone(model, {
            onDrop: () => {},
            as: "section",
            "data-testid": "zone",
        });
        const zone = byTestId("zone");
        expect(zone.tagName).toBe("SECTION");
        expect(zone.textContent).toBe("");
    });

    it("gives the render slot its state", async () => {
        const model = freshModel();
        await withZone(
            model,
            { onDrop: () => {}, "data-testid": "zone" },
            {
                render: ({
                    props,
                    state,
                }: {
                    props: Record<string, unknown>;
                    state: { active: boolean };
                }) => [
                    h("section", {
                        ...props,
                        class: state.active ? "armed" : "idle",
                    }),
                ],
            },
        );
        expect(byTestId("zone")).toHaveClass("idle");
        await startDrag("/ts0/tb0");
        expect(byTestId("zone")).toHaveClass("armed");
    });
});
