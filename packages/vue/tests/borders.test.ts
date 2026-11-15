import {
    type BorderJson,
    type BorderNode,
    createModel,
    type LayoutDefaults,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, type VNode, type VNodeChild } from "vue";
import type { BorderContentState } from "../src";
import {
    Dockable,
    mounts,
    recordCommands,
    render,
    renderNode,
    renderPanel,
    settle,
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
        location: "start",
        size: 180,
        children: [
            {
                id: "files",
                component: "test",
                label: "Files",
                data: { name: "Files" },
            },
            {
                id: "search",
                component: "test",
                label: "Search",
                data: { name: "Search" },
            },
        ],
    },
    {
        location: "bottom",
        selected: 0,
        size: 120,
        children: [
            {
                id: "terminal",
                component: "test",
                label: "Terminal",
                data: { name: "Terminal" },
            },
        ],
    },
    { location: "end", autoHide: true, children: [] },
    { location: "top", show: false, children: [] },
]);

const load = (json: LayoutJson<Types>): Model<Types> =>
    createModel<Types>(structuredClone(json));

type Child = TabsetNode<Types> | RowNode<Types>;

function borderLayout(options: {
    model: Model<Types>;
    tabDirection?: "up" | "down";
    renderContent?: (border: BorderNode<Types>) => VNodeChild;
    children?: () => VNodeChild;
}) {
    const { model, tabDirection, renderContent, children } = options;
    return defineComponent({
        setup: () => () =>
            h(
                Dockable.Root,
                { model, "data-testid": "root" },
                {
                    default: () => [
                        h(Dockable.Borders, null, {
                            bar: ({
                                border,
                            }: {
                                border: BorderNode<Types>;
                            }) => [
                                h(
                                    Dockable.Border,
                                    {
                                        node: border,
                                        tabDirection,
                                        "data-testid": `bar-${border.id}`,
                                    },
                                    {
                                        default: () => [
                                            h(Dockable.TabList, null, {
                                                default: ({
                                                    tab,
                                                }: {
                                                    tab: TabOf<Types>;
                                                }) => [
                                                    h(
                                                        Dockable.Tab,
                                                        { node: tab },
                                                        {
                                                            default: () =>
                                                                tab.label,
                                                        },
                                                    ),
                                                ],
                                            }),
                                        ],
                                    },
                                ),
                            ],
                            ...(renderContent
                                ? {
                                      content: ({
                                          border,
                                      }: {
                                          border: BorderNode<Types>;
                                      }) => [renderContent(border)],
                                  }
                                : {}),
                            default: () => [
                                h(Dockable.Row, null, {
                                    default: ({ node }: { node: Child }) => [
                                        renderNode(node),
                                    ],
                                }),
                            ],
                        }),
                        h(Dockable.Panels, null, {
                            default: ({ tab }: { tab: TabOf<Types> }) => [
                                renderPanel(tab),
                            ],
                        }),
                        children?.(),
                    ],
                },
            ),
    });
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

const testId = (id: string) => {
    const found = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!found) throw new Error(`no element ${id}`);
    return found;
};

async function click(target: HTMLElement) {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
}

describe("Dockable.Borders", () => {
    it("renders the borders that show, around the main area, with their layout paths", async () => {
        await render(borderLayout({ model: load(ideBorders) }));
        expect(path("/borders")).toBeInTheDocument();
        expect(path("/main")).toContainElement(path("/row"));
        expect(path("/border/start")).toBeInTheDocument();
        expect(path("/border/bottom")).toBeInTheDocument();
        // an empty auto-hide border, and a border with show: false, are not rendered
        expect(path("/border/end")).toBeNull();
        expect(path("/border/top")).toBeNull();
        expect(path("/border/start/tb0")).toHaveTextContent("Files");
        expect(path("/border/start/tabstrip")).toHaveAttribute(
            "aria-orientation",
            "vertical",
        );
        expect(path("/border/bottom/tabstrip")).toHaveAttribute(
            "aria-orientation",
            "horizontal",
        );
        const start = element("/border/start");
        const main = element("/main");
        expect(
            start.compareDocumentPosition(main) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it("exposes the border's state as data attributes", async () => {
        await render(borderLayout({ model: load(ideBorders) }));
        const start = path("/border/start");
        expect(start).toHaveAttribute("data-location", "start");
        expect(start).toHaveAttribute("data-orientation", "vertical");
        expect(start).toHaveAttribute("data-docked", "");
        expect(start).toHaveAttribute("data-tab-direction", "up");
        expect(start).not.toHaveAttribute("data-open");
        expect(start).not.toHaveAttribute("data-overlay");
        const bottom = path("/border/bottom");
        expect(bottom).toHaveAttribute("data-open", "");
        expect(bottom).toHaveAttribute("data-orientation", "horizontal");
        expect(bottom).not.toHaveAttribute("data-tab-direction");
    });

    it("takes the start border's tab direction from its tabDirection prop", async () => {
        await render(
            borderLayout({ model: load(ideBorders), tabDirection: "down" }),
        );
        expect(path("/border/start")).toHaveAttribute(
            "data-tab-direction",
            "down",
        );
        expect(path("/border/bottom")).not.toHaveAttribute(
            "data-tab-direction",
        );
    });

    it("gives the tab direction to the strip's state only, not to its content's", async () => {
        const states = new Map<string, BorderContentState>();
        await render(
            borderLayout({
                model: load(ideBorders),
                tabDirection: "down",
                renderContent: (border) =>
                    h(
                        Dockable.BorderContent,
                        { node: border },
                        {
                            render: ({
                                props,
                                state,
                                children,
                            }: {
                                props: Record<string, unknown>;
                                state: BorderContentState;
                                children: VNode;
                            }) => {
                                states.set(state.location, state);
                                return [h("div", props, [children])];
                            },
                        },
                    ),
            }),
        );
        expect(states.get("start")).toMatchObject({ location: "start" });
        expect(states.get("start")).not.toHaveProperty("tabDirection");
        // the render slot keeps the area and the splitter
        expect(path("/border/bottom/area")).not.toBeNull();
    });

    it("sizes the open panel's area by the border size, and hides a closed one", async () => {
        await render(borderLayout({ model: load(ideBorders) }));
        const bottom = element("/border/bottom/content");
        expect(bottom.style.display).toBe("flex");
        expect(path("/border/bottom/area")?.style.height).toBe("120px");
        expect(bottom).toContainElement(path("/border/bottom/s-1"));
        const start = element("/border/start/content");
        expect(start.style.display).toBe("none");
        expect(path("/border/start/area")?.style.width).toBe("180px");
        expect(path("/border/start/s-1")).toBeNull(); // no splitter while closed
    });

    it("opens a border's panel on a tab click and closes it on a second click, through commands", async () => {
        const model = load(ideBorders);
        const commands = recordCommands(model);
        await render(borderLayout({ model }));
        await click(element("/border/start/tb1"));
        expect(commands.at(-1)).toEqual({
            command: "tab.select",
            payload: { tabId: "search" },
            transient: false,
        });
        expect(path("/border/start")).toHaveAttribute("data-open", "");
        expect(path("/border/start/content")?.style.display).toBe("flex");
        expect(testId("content-search")).toBeInTheDocument();

        await click(element("/border/start/tb1"));
        expect(commands.at(-1)).toEqual({
            command: "border.configure",
            payload: { borderId: "border_start", open: false },
            transient: false,
        });
        expect(path("/border/start")).not.toHaveAttribute("data-open");
        expect(path("/border/start/content")?.style.display).toBe("none");
        // a tab of a tabset does not toggle
        await click(element("/ts0/tb0"));
        expect(path("/ts0/tb0")).toHaveAttribute("aria-selected", "true");
    });

    it("resizes a border with its splitter's keyboard, in px", async () => {
        const model = load(ideBorders);
        const commands = recordCommands(model);
        await render(borderLayout({ model }));
        const splitter = element("/border/bottom/s-1");
        expect(splitter).toHaveAttribute("role", "separator");
        expect(splitter).toHaveAttribute("aria-valuenow", "120");
        expect(splitter).toHaveAttribute("aria-valuetext", "120px");
        splitter.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
        ); // a bottom border grows upwards
        await settle();
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

    it("places an overlay border's panel over the layout's edge, marked as part of the overlay", async () => {
        const model = load(ideBorders);
        await render(borderLayout({ model }));
        model.run("border.configure", {
            borderId: "border_start",
            mode: "overlay",
        });
        model.run("tab.select", { tabId: "files" });
        await settle();
        const content = element("/border/start/content");
        expect(path("/border/start")).toHaveAttribute("data-overlay", "");
        expect(content.style.position).toBe("absolute");
        expect(content.style.left).toBe("0px");
        expect(content).toHaveAttribute("data-dockable-overlay", "");
        expect(content.style.pointerEvents).toBe("none");
        expect(path("/border/start/s-1")?.style.pointerEvents).toBe("auto");
        // a split border is in the flow
        expect(path("/border/bottom/content")?.style.position).toBe("");
    });

    it("accepts a #content slot that customises the panel area and its splitter", async () => {
        await render(
            borderLayout({
                model: load(ideBorders),
                renderContent: (border) =>
                    h(Dockable.BorderContent, {
                        node: border,
                        class: "panel-area",
                        splitter: border.location !== "bottom",
                    }),
            }),
        );
        expect(path("/border/bottom/content")).toHaveClass("panel-area");
        expect(path("/border/bottom/s-1")).toBeNull();
    });

    it("leaves a border's splitter unnamed, and names it through aria-label in #splitter", async () => {
        const first = await render(borderLayout({ model: load(ideBorders) }));
        expect(element("/border/bottom/s-1")).not.toHaveAttribute("aria-label");
        first.unmount();

        await render(
            borderLayout({
                model: load(ideBorders),
                renderContent: (border) =>
                    h(
                        Dockable.BorderContent,
                        { node: border },
                        {
                            splitter: ({
                                props,
                            }: {
                                props: { node: BorderNode<Types> };
                            }) => [
                                h(Dockable.Splitter, {
                                    ...props,
                                    "aria-label": "Resize",
                                }),
                            ],
                        },
                    ),
            }),
        );
        expect(element("/border/bottom/s-1")).toHaveAttribute(
            "aria-label",
            "Resize",
        );
    });

    it("renders nothing but the main area when the model has no borders", async () => {
        await render(borderLayout({ model: load(twoTabsets) }));
        expect(path("/borders")).not.toHaveAttribute("data-borders");
        expect(
            document.querySelector('[data-layout-path^="/border/"]'),
        ).toBeNull();
        expect(path("/main")).toContainElement(path("/row"));
    });

    it("renders no text of its own", async () => {
        const model = load(
            withBorders([
                {
                    location: "start",
                    selected: 0,
                    children: [
                        {
                            id: "files",
                            component: "test",
                            label: "Files",
                            data: { name: "Files" },
                        },
                    ],
                },
            ]),
        );
        await render(
            defineComponent({
                setup: () => () =>
                    h(
                        Dockable.Root,
                        { model },
                        {
                            default: () => [
                                h(Dockable.Borders, null, {
                                    bar: ({
                                        border,
                                    }: {
                                        border: BorderNode<Types>;
                                    }) => [
                                        h(Dockable.Border, { node: border }),
                                    ],
                                    default: () => [
                                        h(Dockable.Row, null, {
                                            default: () => [],
                                        }),
                                    ],
                                }),
                            ],
                        },
                    ),
            }),
        );
        expect(path("/borders")?.textContent).toBe("");
    });
});

describe("Dockable.EdgeIndicator", () => {
    it("is hidden, aria-hidden and pointer-events: none outside a drag", async () => {
        await render(
            borderLayout({
                model: load(ideBorders),
                children: () =>
                    h(
                        Dockable.EdgeIndicator,
                        { edge: "top", "data-testid": "edge-top" },
                        { default: () => [h("span", "↑")] },
                    ),
            }),
        );
        const edge = testId("edge-top");
        expect(edge).toHaveAttribute("data-layout-path", "/edge/top");
        expect(edge).toHaveAttribute("data-edge", "top");
        expect(edge).toHaveAttribute("aria-hidden", "true");
        expect(edge).not.toHaveAttribute("data-visible");
        expect(edge.style.display).toBe("none");
        expect(edge.style.pointerEvents).toBe("none");
    });
});
