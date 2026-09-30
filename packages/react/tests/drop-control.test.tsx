import {
    createModel,
    DRAG_TYPE,
    DragDropManager,
    type DropZoneOptions,
    type LayoutJson,
    type Model,
    veto,
} from "@fragiola/dockable";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";
import { Layout, type Types, twoTabsets } from "./layout";

// jsdom measures every element as 100x100 at (0, 0) (tests/setup.ts), so a drag over (50, 50)
// always has a target: the hit test's first tabset.

function freshModel(json: LayoutJson<Types> = twoTabsets) {
    return createModel<Types>(structuredClone(json));
}

/** A fake DataTransfer carrying Dockable's type: the layouts claim only drags that carry it. */
function fakeDataTransfer(types: string[] = [DRAG_TYPE]) {
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
function dragEvent(type: string, x = 50, y = 50) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, "dataTransfer", {
        value: fakeDataTransfer(),
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

/** Starts dragging the tab whose button is at `tabPath` (`/ts1/tb0` is t2, `/ts0/tb1` is t1). */
function startDrag(tabPath: string) {
    act(() => {
        path(tabPath).dispatchEvent(dragEvent("dragstart", 0, 0));
    });
}

function over(element: HTMLElement) {
    act(() => {
        element.dispatchEvent(dragEvent("dragenter"));
        element.dispatchEvent(dragEvent("dragover"));
    });
}

function endDrag() {
    act(() => {
        DragDropManager.endDrag();
    });
}

afterEach(() => {
    if (DragDropManager.getDragState()) {
        endDrag();
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
        const model = freshModel();
        render(<Layout model={model} />);
        startDrag("/ts1/tb0");
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

    /** a middleware that refuses every move */
    const refuseMoves = (model: Model<Types>) =>
        model.use((ctx, next) =>
            ctx.command === "tab.move" ? veto("no moves") : next(),
        );

    it("are shown on the root, the indicator and the refusing tabset", () => {
        const model = freshModel();
        refuseMoves(model);
        render(
            <Layout model={model}>
                <Dockable.DropIndicator />
            </Layout>,
        );
        startDrag("/ts1/tb0");
        over(path("/layout"));
        expect(refusedAttributes()).toEqual({
            root: true,
            indicator: true,
            indicatorHidden: true,
            refusedTabsets: 1,
            targets: 0,
        });
        endDrag();
        expect(path("/layout")).not.toHaveAttribute("data-drop-refused");
    });

    it("look the same whether a middleware or the layout's own rules refuse", () => {
        const viaMiddleware = freshModel();
        refuseMoves(viaMiddleware);
        const first = render(
            <Layout model={viaMiddleware}>
                <Dockable.DropIndicator />
            </Layout>,
        );
        startDrag("/ts1/tb0");
        over(path("/layout"));
        const withMiddleware = refusedAttributes();
        expect(withMiddleware.root).toBe(true);
        endDrag();
        first.unmount();

        // no tabset takes a drop into it or beside it
        const viaRules = freshModel({
            ...twoTabsets,
            defaults: { tabset: { enableDrop: false, enableDivide: false } },
        });
        render(
            <Layout model={viaRules}>
                <Dockable.DropIndicator />
            </Layout>,
        );
        startDrag("/ts1/tb0");
        over(path("/layout"));
        expect(refusedAttributes()).toEqual(withMiddleware);
    });

    it("stop once the refusing middleware is removed", () => {
        const model = freshModel();
        const remove = refuseMoves(model);
        render(
            <Layout model={model}>
                <Dockable.DropIndicator />
            </Layout>,
        );
        startDrag("/ts1/tb0");
        over(path("/layout"));
        expect(path("/layout")).toHaveAttribute("data-drop-refused", "");
        endDrag();

        remove();
        startDrag("/ts1/tb0");
        over(path("/layout"));
        expect(refusedAttributes()).toEqual({
            root: false,
            indicator: false,
            indicatorHidden: false,
            refusedTabsets: 0,
            targets: 1,
        });
    });
});

describe("Dockable.DropZone", () => {
    it("takes a drag of its model and hands over what is dragged without moving it", () => {
        const model = freshModel();
        const onDrop = vi.fn<DropZoneOptions<Types>["onDrop"]>();
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
        const before = model.state;
        const zone = screen.getByTestId("trash");
        expect(zone).not.toHaveAttribute("data-drop-active");

        startDrag("/ts0/tb1");
        expect(zone).toHaveAttribute("data-drop-active", "");
        expect(zone).not.toHaveAttribute("data-drop-over");
        over(zone);
        expect(zone).toHaveAttribute("data-drop-over", "");

        act(() => {
            zone.dispatchEvent(dragEvent("drop"));
        });
        expect(onDrop).toHaveBeenCalledTimes(1);
        const dropped = onDrop.mock.calls[0]?.[0];
        expect(dropped?.kind === "tab" ? dropped.tab.id : undefined).toBe("t1");
        expect(model.state).toBe(before);
        expect(zone).not.toHaveAttribute("data-drop-over");
        expect(zone).not.toHaveAttribute("data-drop-active");
        expect(DragDropManager.getDragState()).toBeUndefined();
    });

    it("is inactive for drags it does not accept", () => {
        const model = freshModel();
        const onDrop = vi.fn<DropZoneOptions<Types>["onDrop"]>();
        render(
            <>
                <Dockable.DropZone
                    model={model}
                    accepts={(drag) =>
                        drag.kind !== "tab" || drag.tab.id !== "t1"
                    }
                    onDrop={onDrop}
                    data-testid="zone"
                />
                <Layout model={model} />
            </>,
        );
        const zone = screen.getByTestId("zone");
        startDrag("/ts0/tb1");
        expect(zone).not.toHaveAttribute("data-drop-active");
        over(zone);
        act(() => {
            zone.dispatchEvent(dragEvent("drop"));
        });
        expect(zone).not.toHaveAttribute("data-drop-over");
        expect(onDrop).not.toHaveBeenCalled();
    });

    it("supports render, state functions, and renders only its children", () => {
        const model = freshModel();
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
        startDrag("/ts0/tb0");
        expect(zone).toHaveClass("armed");
    });
});
