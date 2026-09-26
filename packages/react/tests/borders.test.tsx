import {
    type Action,
    Actions,
    type BorderNode,
    DockLocation,
    type IJsonModel,
    Model,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";
import { mounts, renderNode, renderPanel, twoTabsets } from "./layout";

afterEach(() => {
    mounts.clear();
});

const withBorders = (
    borders: IJsonModel["borders"],
    global: IJsonModel["global"] = {},
): IJsonModel => ({ ...structuredClone(twoTabsets), global, borders });

const ideBorders = withBorders([
    {
        type: "border",
        location: "left",
        size: 180,
        children: [
            { type: "tab", id: "files", name: "Files" },
            { type: "tab", id: "search", name: "Search" },
        ],
    },
    {
        type: "border",
        location: "bottom",
        selected: 0,
        size: 120,
        children: [{ type: "tab", id: "terminal", name: "Terminal" }],
    },
    { type: "border", location: "right", enableAutoHide: true, children: [] },
    { type: "border", location: "top", show: false, children: [] },
]);

function renderBar(border: BorderNode) {
    return (
        <Dockable.Border node={border} data-testid={`bar-${border.getId()}`}>
            <Dockable.TabList>
                {(tab) => (
                    <Dockable.Tab node={tab}>{tab.getName()}</Dockable.Tab>
                )}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

function BorderLayout({
    model,
    onAction,
    renderContent,
    children,
}: {
    model: Model;
    onAction?: (action: Action) => Action | undefined;
    renderContent?: (border: BorderNode) => React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <Dockable.Root model={model} data-testid="root" onAction={onAction}>
            <Dockable.Borders
                renderBar={renderBar}
                renderContent={renderContent}
            >
                <Dockable.Row>{renderNode}</Dockable.Row>
            </Dockable.Borders>
            <Dockable.Panels>{renderPanel}</Dockable.Panels>
            {children}
        </Dockable.Root>
    );
}

const path = (value: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${value}"]`);

describe("Dockable.Borders", () => {
    it("renders the borders that show, around the main area, with their layout paths", () => {
        render(<BorderLayout model={Model.fromJson(ideBorders)} />);
        expect(path("/borders")).toBeInTheDocument();
        expect(path("/main")).toContainElement(path("/row"));
        expect(path("/border/left")).toBeInTheDocument();
        expect(path("/border/bottom")).toBeInTheDocument();
        // an empty auto-hide border, and a border with show: false, are not rendered
        expect(path("/border/right")).toBeNull();
        expect(path("/border/top")).toBeNull();
        expect(path("/border/left/tb0")).toHaveTextContent("Files");
        expect(path("/border/left/tabstrip")).toHaveAttribute(
            "aria-orientation",
            "vertical",
        );
        expect(path("/border/bottom/tabstrip")).toHaveAttribute(
            "aria-orientation",
            "horizontal",
        );
        // the strip comes before the main area for the left border, after it for the bottom one
        const left = path("/border/left") as HTMLElement;
        const main = path("/main") as HTMLElement;
        expect(
            left.compareDocumentPosition(main) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("exposes the border's state as data attributes", () => {
        render(<BorderLayout model={Model.fromJson(ideBorders)} />);
        const left = path("/border/left");
        expect(left).toHaveAttribute("data-location", "left");
        expect(left).toHaveAttribute("data-orientation", "vertical");
        expect(left).toHaveAttribute("data-docked", "");
        expect(left).toHaveAttribute("data-tab-direction", "up");
        expect(left).not.toHaveAttribute("data-open");
        expect(left).not.toHaveAttribute("data-overlay");
        const bottom = path("/border/bottom");
        expect(bottom).toHaveAttribute("data-open", "");
        expect(bottom).toHaveAttribute("data-orientation", "horizontal");
        expect(bottom).not.toHaveAttribute("data-tab-direction");
    });

    it("sizes the open panel's area by the border size, and hides a closed one", () => {
        render(<BorderLayout model={Model.fromJson(ideBorders)} />);
        const bottom = path("/border/bottom/content") as HTMLElement;
        expect(bottom.style.display).toBe("flex");
        expect(path("/border/bottom/area")?.style.height).toBe("120px");
        expect(bottom).toContainElement(path("/border/bottom/s-1"));
        const left = path("/border/left/content") as HTMLElement;
        expect(left.style.display).toBe("none");
        expect(path("/border/left/area")?.style.width).toBe("180px");
        expect(path("/border/left/s-1")).toBeNull(); // no splitter while closed
    });

    it("opens a border's panel on a tab click and closes it on a second click, through onAction", () => {
        const model = Model.fromJson(ideBorders);
        const onAction = vi.fn((action: Action) => action);
        render(<BorderLayout model={model} onAction={onAction} />);
        fireEvent.click(path("/border/left/tb1") as HTMLElement);
        expect(onAction).toHaveBeenLastCalledWith(
            expect.objectContaining({ type: Actions.SELECT_TAB }),
        );
        expect(path("/border/left")).toHaveAttribute("data-open", "");
        expect(path("/border/left/content")?.style.display).toBe("flex");
        expect(screen.getByTestId("content-search")).toBeInTheDocument();

        fireEvent.click(path("/border/left/tb1") as HTMLElement);
        expect(path("/border/left")).not.toHaveAttribute("data-open");
        expect(path("/border/left/content")?.style.display).toBe("none");
        // a tab of a tabset does not toggle
        fireEvent.click(path("/ts0/tb0") as HTMLElement);
        expect(path("/ts0/tb0")).toHaveAttribute("aria-selected", "true");
    });

    it("resizes a border with its splitter's keyboard, in px", () => {
        const model = Model.fromJson(ideBorders);
        render(<BorderLayout model={model} />);
        const splitter = path("/border/bottom/s-1") as HTMLElement;
        expect(splitter).toHaveAttribute("role", "separator");
        expect(splitter).toHaveAttribute("aria-valuenow", "120");
        expect(splitter).toHaveAttribute("aria-valuetext", "120px");
        act(() => {
            fireEvent.keyDown(splitter, { key: "ArrowUp" }); // a bottom border grows upwards
        });
        const bottom = model
            .getBorderSet()
            .getBorderMap()
            .get(DockLocation.BOTTOM);
        expect(bottom?.getSize()).toBe(130);
        expect(path("/border/bottom/area")?.style.height).toBe("130px");
    });

    it("places an overlay border's panel over the layout's edge, marked as part of the overlay", () => {
        const model = Model.fromJson(ideBorders);
        render(<BorderLayout model={model} />);
        act(() => {
            model.doAction(Actions.setBorderType("border_left", "overlay"));
            model.doAction(Actions.selectTab("files"));
        });
        const content = path("/border/left/content") as HTMLElement;
        expect(path("/border/left")).toHaveAttribute("data-overlay", "");
        expect(content.style.position).toBe("absolute");
        expect(content.style.left).toBe("0px");
        expect(content).toHaveAttribute("data-dockable-overlay", "");
        // a split border is in the flow
        expect(path("/border/bottom/content")?.style.position).toBe("");
    });

    it("accepts a renderContent that customises the panel area and its splitter", () => {
        render(
            <BorderLayout
                model={Model.fromJson(ideBorders)}
                renderContent={(border) => (
                    <Dockable.BorderContent
                        node={border}
                        className="panel-area"
                        splitter={border.getLocation() !== DockLocation.BOTTOM}
                    />
                )}
            />,
        );
        expect(path("/border/bottom/content")).toHaveClass("panel-area");
        expect(path("/border/bottom/s-1")).toBeNull();
    });

    it("renders nothing but the main area when the model has no borders", () => {
        render(<BorderLayout model={Model.fromJson(twoTabsets)} />);
        expect(path("/borders")).not.toHaveAttribute("data-borders");
        expect(
            document.querySelector('[data-layout-path^="/border/"]'),
        ).toBeNull();
        expect(path("/main")).toContainElement(path("/row"));
    });

    it("renders no text of its own", () => {
        const model = Model.fromJson(
            withBorders([
                {
                    type: "border",
                    location: "left",
                    selected: 0,
                    children: [{ type: "tab", id: "files", name: "Files" }],
                },
            ]),
        );
        render(
            <Dockable.Root model={model}>
                <Dockable.Borders
                    renderBar={(border) => <Dockable.Border node={border} />}
                >
                    <Dockable.Row>{() => null}</Dockable.Row>
                </Dockable.Borders>
            </Dockable.Root>,
        );
        expect(path("/borders")?.textContent).toBe("");
    });
});

describe("Dockable.EdgeIndicator", () => {
    it("is hidden, aria-hidden and pointer-events: none outside a drag", () => {
        render(
            <BorderLayout model={Model.fromJson(ideBorders)}>
                <Dockable.EdgeIndicator edge="top" data-testid="edge-top">
                    <span>↑</span>
                </Dockable.EdgeIndicator>
            </BorderLayout>,
        );
        const edge = screen.getByTestId("edge-top");
        expect(edge).toHaveAttribute("data-layout-path", "/edge/top");
        expect(edge).toHaveAttribute("data-edge", "top");
        expect(edge).toHaveAttribute("aria-hidden", "true");
        expect(edge).not.toHaveAttribute("data-visible");
        expect(edge.style.display).toBe("none");
        expect(edge.style.pointerEvents).toBe("none");
    });
});

void React;
