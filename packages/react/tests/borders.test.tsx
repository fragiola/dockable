import {
    type BorderJson,
    type BorderNode,
    createModel,
    type LayoutDefaults,
    type LayoutJson,
    type Model,
} from "@fragiola/dockable";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Dockable } from "../src";
import {
    mounts,
    recordCommands,
    renderNode,
    renderPanel,
    type Types,
    twoTabsets,
} from "./layout";

afterEach(() => {
    mounts.clear();
});

const withBorders = (
    borders: BorderJson<Types>[],
    defaults: LayoutDefaults = {},
): LayoutJson<Types> => ({ ...structuredClone(twoTabsets), defaults, borders });

const ideBorders = withBorders([
    {
        location: "left",
        size: 180,
        children: [
            { id: "files", component: "test", data: { name: "Files" } },
            { id: "search", component: "test", data: { name: "Search" } },
        ],
    },
    {
        location: "bottom",
        selected: 0,
        size: 120,
        children: [
            { id: "terminal", component: "test", data: { name: "Terminal" } },
        ],
    },
    { location: "right", autoHide: true, children: [] },
    { location: "top", show: false, children: [] },
]);

const load = (json: LayoutJson<Types>): Model<Types> =>
    createModel<Types>(structuredClone(json));

function BorderLayout({
    model,
    tabDirection,
    renderContent,
    children,
}: {
    model: Model<Types>;
    tabDirection?: "up" | "down";
    renderContent?: (border: BorderNode<Types>) => React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <Dockable.Root model={model} data-testid="root">
            <Dockable.Borders<Types>
                renderBar={(border) => (
                    <Dockable.Border
                        node={border}
                        tabDirection={tabDirection}
                        data-testid={`bar-${border.id}`}
                    >
                        <Dockable.TabList<Types>>
                            {(tab) => (
                                <Dockable.Tab node={tab}>
                                    {tab.data.name}
                                </Dockable.Tab>
                            )}
                        </Dockable.TabList>
                    </Dockable.Border>
                )}
                renderContent={renderContent}
            >
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
            </Dockable.Borders>
            <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
            {children}
        </Dockable.Root>
    );
}

const path = (value: string) =>
    document.querySelector<HTMLElement>(`[data-layout-path="${value}"]`);

const element = (value: string): HTMLElement => {
    const found = path(value);
    if (!found) {
        throw new Error(`no element at ${value}`);
    }
    return found;
};

describe("Dockable.Borders", () => {
    it("renders the borders that show, around the main area, with their layout paths", () => {
        render(<BorderLayout model={load(ideBorders)} />);
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
        const left = element("/border/left");
        const main = element("/main");
        expect(
            left.compareDocumentPosition(main) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("exposes the border's state as data attributes", () => {
        render(<BorderLayout model={load(ideBorders)} />);
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

    it("takes a left border's tab direction from its tabDirection prop", () => {
        render(<BorderLayout model={load(ideBorders)} tabDirection="down" />);
        expect(path("/border/left")).toHaveAttribute(
            "data-tab-direction",
            "down",
        );
        // only a left border has a tab direction
        expect(path("/border/bottom")).not.toHaveAttribute(
            "data-tab-direction",
        );
    });

    it("sizes the open panel's area by the border size, and hides a closed one", () => {
        render(<BorderLayout model={load(ideBorders)} />);
        const bottom = element("/border/bottom/content");
        expect(bottom.style.display).toBe("flex");
        expect(path("/border/bottom/area")?.style.height).toBe("120px");
        expect(bottom).toContainElement(path("/border/bottom/s-1"));
        const left = element("/border/left/content");
        expect(left.style.display).toBe("none");
        expect(path("/border/left/area")?.style.width).toBe("180px");
        expect(path("/border/left/s-1")).toBeNull(); // no splitter while closed
    });

    it("opens a border's panel on a tab click and closes it on a second click, through commands", () => {
        const model = load(ideBorders);
        const commands = recordCommands(model);
        render(<BorderLayout model={model} />);
        fireEvent.click(element("/border/left/tb1"));
        expect(commands.at(-1)).toEqual({
            command: "tab.select",
            payload: { tabId: "search" },
            transient: false,
        });
        expect(path("/border/left")).toHaveAttribute("data-open", "");
        expect(path("/border/left/content")?.style.display).toBe("flex");
        expect(screen.getByTestId("content-search")).toBeInTheDocument();

        fireEvent.click(element("/border/left/tb1"));
        expect(commands.at(-1)).toEqual({
            command: "border.configure",
            payload: { borderId: "border_left", open: false },
            transient: false,
        });
        expect(path("/border/left")).not.toHaveAttribute("data-open");
        expect(path("/border/left/content")?.style.display).toBe("none");
        // a tab of a tabset does not toggle
        fireEvent.click(element("/ts0/tb0"));
        expect(path("/ts0/tb0")).toHaveAttribute("aria-selected", "true");
    });

    it("resizes a border with its splitter's keyboard, in px", () => {
        const model = load(ideBorders);
        const commands = recordCommands(model);
        render(<BorderLayout model={model} />);
        const splitter = element("/border/bottom/s-1");
        expect(splitter).toHaveAttribute("role", "separator");
        expect(splitter).toHaveAttribute("aria-valuenow", "120");
        expect(splitter).toHaveAttribute("aria-valuetext", "120px");
        act(() => {
            fireEvent.keyDown(splitter, { key: "ArrowUp" }); // a bottom border grows upwards
        });
        expect(commands.at(-1)).toMatchObject({
            command: "border.resize",
            payload: { borderId: "border_bottom", size: 130 },
        });
        const bottom = model.state.borders.find(
            (border) => border.location === "bottom",
        );
        expect(
            bottom &&
                model.get("border-settings-by", { borderId: bottom.id })?.size,
        ).toBe(130);
        expect(path("/border/bottom/area")?.style.height).toBe("130px");
    });

    it("places an overlay border's panel over the layout's edge, marked as part of the overlay", () => {
        const model = load(ideBorders);
        render(<BorderLayout model={model} />);
        act(() => {
            model.run("border.configure", {
                borderId: "border_left",
                mode: "overlay",
            });
            model.run("tab.select", { tabId: "files" });
        });
        const content = element("/border/left/content");
        expect(path("/border/left")).toHaveAttribute("data-overlay", "");
        expect(content.style.position).toBe("absolute");
        expect(content.style.left).toBe("0px");
        expect(content).toHaveAttribute("data-dockable-overlay", "");
        // presses go through its empty area to the tab panel, but not through its splitter
        expect(content.style.pointerEvents).toBe("none");
        expect(path("/border/left/s-1")?.style.pointerEvents).toBe("auto");
        // a split border is in the flow
        expect(path("/border/bottom/content")?.style.position).toBe("");
    });

    it("accepts a renderContent that customises the panel area and its splitter", () => {
        render(
            <BorderLayout
                model={load(ideBorders)}
                renderContent={(border) => (
                    <Dockable.BorderContent
                        node={border}
                        className="panel-area"
                        splitter={border.location !== "bottom"}
                    />
                )}
            />,
        );
        expect(path("/border/bottom/content")).toHaveClass("panel-area");
        expect(path("/border/bottom/s-1")).toBeNull();
    });

    it("leaves a border's splitter unnamed, and names it through aria-label in renderSplitter", () => {
        const { unmount } = render(<BorderLayout model={load(ideBorders)} />);
        expect(element("/border/bottom/s-1")).not.toHaveAttribute("aria-label");
        unmount();

        render(
            <BorderLayout
                model={load(ideBorders)}
                renderContent={(border) => (
                    <Dockable.BorderContent
                        node={border}
                        renderSplitter={(node) => (
                            <Dockable.Splitter
                                node={node}
                                aria-label="Resize"
                            />
                        )}
                    />
                )}
            />,
        );
        expect(element("/border/bottom/s-1")).toHaveAttribute(
            "aria-label",
            "Resize",
        );
    });

    it("renders nothing but the main area when the model has no borders", () => {
        render(<BorderLayout model={load(twoTabsets)} />);
        expect(path("/borders")).not.toHaveAttribute("data-borders");
        expect(
            document.querySelector('[data-layout-path^="/border/"]'),
        ).toBeNull();
        expect(path("/main")).toContainElement(path("/row"));
    });

    it("renders no text of its own", () => {
        const model = load(
            withBorders([
                {
                    location: "left",
                    selected: 0,
                    children: [
                        {
                            id: "files",
                            component: "test",
                            data: { name: "Files" },
                        },
                    ],
                },
            ]),
        );
        render(
            <Dockable.Root model={model}>
                <Dockable.Borders<Types>
                    renderBar={(border) => <Dockable.Border node={border} />}
                >
                    <Dockable.Row<Types>>{() => null}</Dockable.Row>
                </Dockable.Borders>
            </Dockable.Root>,
        );
        expect(path("/borders")?.textContent).toBe("");
    });
});

describe("Dockable.EdgeIndicator", () => {
    it("is hidden, aria-hidden and pointer-events: none outside a drag", () => {
        render(
            <BorderLayout model={load(ideBorders)}>
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
