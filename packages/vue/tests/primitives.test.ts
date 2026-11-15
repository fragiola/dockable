import {
    createModel,
    type LayoutEngine,
    MOVEABLE_ATTRIBUTE,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    defineComponent,
    h,
    onMounted,
    onUpdated,
    type VNode,
    type VNodeChild,
} from "vue";
import { type TabState, useDockable } from "../src";
import { useDockableContext } from "../src/context";
import {
    click,
    keyDown,
    mustPath,
    mustTestId,
    path,
    pointerDown,
    typeInto,
} from "./helpers";
import {
    Dockable,
    Layout,
    mounts,
    recordCommands,
    render,
    renderLayout,
    renderNode,
    renderPanel,
    settle,
    type Types,
    twoTabsets,
} from "./layout";

type Child = TabsetNode<Types> | RowNode<Types>;

const fresh = () => createModel<Types>(structuredClone(twoTabsets));

/** a Row slot that renders only tabsets, with bare tabs (no text) */
function bareTabset({ node }: { node: Child }): VNodeChild[] {
    return node.type === "tabset"
        ? [
              h(
                  Dockable.TabSet,
                  { node },
                  {
                      default: () => [
                          h(Dockable.TabList, null, {
                              default: ({ tab }: { tab: TabOf<Types> }) => [
                                  h(Dockable.Tab, { node: tab }),
                              ],
                          }),
                          h(Dockable.TabSetContent),
                      ],
                  },
              ),
          ]
        : [];
}

/** a Row slot rendering tabsets whose tabs get `tabProps` (and the tab's own slots) */
function tabsetsWith(
    tabProps: (tab: TabOf<Types>) => Record<string, unknown>,
    tabSlots: Record<string, unknown> = {},
) {
    return ({ node }: { node: Child }): VNodeChild[] =>
        node.type === "tabset"
            ? [
                  h(
                      Dockable.TabSet,
                      { node },
                      {
                          default: () => [
                              h(Dockable.TabList, null, {
                                  default: ({ tab }: { tab: TabOf<Types> }) => [
                                      h(
                                          Dockable.Tab,
                                          { node: tab, ...tabProps(tab) },
                                          tabSlots,
                                      ),
                                  ],
                              }),
                          ],
                      },
                  ),
              ]
            : [];
}

const nodeSlot = ({ node }: { node: Child }) => [renderNode(node)];
const panelSlot = ({ tab }: { tab: TabOf<Types> }) => [renderPanel(tab)];

/** mounts `render()` as an app */
function app(renderApp: () => VNodeChild) {
    return render(defineComponent({ setup: () => () => renderApp() }));
}

beforeEach(() => {
    mounts.clear();
    vi.restoreAllMocks();
});

describe("composition and ARIA", () => {
    it("renders the tree with roles and ARIA attributes", async () => {
        await renderLayout(fresh());

        const tablists = document.querySelectorAll('[role="tablist"]');
        expect(tablists).toHaveLength(2);
        expect(tablists[0]).toHaveAttribute("aria-orientation", "horizontal");

        const tab0 = mustPath("/ts0/tb0");
        expect(tab0).toHaveAttribute("role", "tab");
        expect(tab0).toHaveAttribute("aria-selected", "true");
        expect(tab0).toHaveAttribute("tabindex", "0");
        expect(tab0).toHaveAttribute("aria-keyshortcuts", "Control+Delete");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "false");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("tabindex", "-1");

        const panel = mustPath("/ts0/t0");
        expect(panel).toHaveAttribute("role", "tabpanel");
        // the DOM ids are scoped per root: the tab and its panel name each other
        expect(tab0.id).not.toBe("");
        expect(panel.id).not.toBe("");
        expect(tab0).toHaveAttribute("aria-controls", panel.id);
        expect(panel).toHaveAttribute("aria-labelledby", tab0.id);
        expect(mustPath("/ts0/tb1").id).not.toBe(tab0.id);

        const splitter = mustPath("/s0");
        expect(splitter).toHaveAttribute("role", "separator");
        expect(splitter).toHaveAttribute("aria-orientation", "vertical");
        expect(splitter).toHaveAttribute("tabindex", "0");
        expect(splitter).toHaveAttribute("aria-valuemin", "0");
        expect(splitter).toHaveAttribute("aria-valuemax", "100");
    });

    it("emits data-layout-path on every primitive", async () => {
        await renderLayout(fresh());
        for (const p of [
            "/layout",
            "/row",
            "/ts0",
            "/ts0/tabstrip",
            "/ts0/content",
            "/ts0/tb0",
            "/ts0/t0",
            "/s0",
            "/ts1",
        ]) {
            expect(path(p), p).not.toBeNull();
        }
    });

    it('exposes state through data-* only, present or absent, never "false"', async () => {
        const model = fresh();
        await renderLayout(model);
        expect(mustPath("/ts0/tb0")).toHaveAttribute("data-selected", "");
        expect(mustPath("/ts0/tb1")).not.toHaveAttribute("data-selected");
        expect(mustPath("/row")).toHaveAttribute(
            "data-orientation",
            "horizontal",
        );
        expect(mustPath("/s0")).toHaveAttribute("data-orientation", "vertical");
        expect(mustPath("/ts0/t0")).toHaveAttribute("data-visible", "");
        expect(mustPath("/ts0")).not.toHaveAttribute("data-active");

        model.run("tabset.activate", { tabsetId: "ts0" });
        await settle();
        expect(mustPath("/ts0")).toHaveAttribute("data-active", "");
        expect(mustPath("/ts1")).not.toHaveAttribute("data-active");

        model.run("tabset.maximize", { tabsetId: "ts1", value: true });
        await settle();
        expect(mustPath("/ts1")).toHaveAttribute("data-maximized", "");
        expect(mustPath("/layout")).toHaveAttribute("data-maximized", "");
        expect(mustPath("/ts0/t0")).not.toHaveAttribute("data-visible");

        for (const element of document.querySelectorAll("*")) {
            for (const attribute of element.attributes) {
                if (attribute.name.startsWith("data-")) {
                    expect(
                        attribute.value,
                        `${attribute.name} on ${element.getAttribute("data-layout-path")}`,
                    ).not.toBe("false");
                }
            }
        }
    });

    it("marks an empty tabset", async () => {
        const model = createModel<Types>({
            version: 1,
            defaults: { tabset: { deleteWhenEmpty: false } },
            root: {
                type: "row",
                children: [{ type: "tabset", id: "empty", children: [] }],
            },
        });
        await renderLayout(model);
        expect(mustPath("/ts0")).toHaveAttribute("data-empty", "");
        expect(mustPath("/ts0/content")).toHaveAttribute("data-empty", "");
    });

    it("renders no text and no name of its own", async () => {
        const model = fresh();
        await app(() =>
            h(
                Dockable.Root,
                { model, "data-testid": "root" },
                {
                    default: () => [
                        h(Dockable.Row, null, { default: bareTabset }),
                        h(Dockable.Panels, null, {
                            default: ({ tab }: { tab: TabOf<Types> }) => [
                                h(Dockable.Panel, { node: tab }),
                            ],
                        }),
                    ],
                },
            ),
        );
        expect(mustTestId("root").textContent).toBe("");
        expect(mustPath("/s0")).not.toHaveAttribute("aria-label");
        for (const element of document.querySelectorAll("[data-layout-path]")) {
            expect(element).not.toHaveAttribute("aria-label");
        }
    });

    it("names a row's splitter through aria-label in the #splitter slot", async () => {
        await app(() =>
            h(
                Dockable.Root,
                { model: fresh() },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: nodeSlot,
                            splitter: ({
                                props,
                            }: {
                                props: { node: RowNode<Types>; index: number };
                            }) => [
                                h(Dockable.Splitter, {
                                    ...props,
                                    "aria-label": "Resize",
                                }),
                            ],
                        }),
                    ],
                },
            ),
        );
        expect(mustPath("/s0")).toHaveAttribute("aria-label", "Resize");
    });
});

describe("as, render slot and attributes", () => {
    it("replaces the element with `as`, keeping the primitive's props", async () => {
        await app(() =>
            h(
                Dockable.Root,
                { model: fresh(), as: "section" },
                {
                    default: () => [
                        h(Dockable.Row, { as: "main" }, { default: nodeSlot }),
                    ],
                },
            ),
        );
        const root = mustPath("/layout");
        expect(root.tagName).toBe("SECTION");
        expect(root.style.position).toBe("relative");
        expect(mustPath("/row").tagName).toBe("MAIN");
    });

    it("renders a component given as `as` with the primitive's props", async () => {
        const Section = defineComponent({
            name: "TestSection",
            setup:
                (_props, { slots }) =>
                () =>
                    h("section", slots.default?.()),
        });
        await app(() =>
            h(
                Dockable.Root,
                { model: fresh(), as: Section },
                {
                    default: () => [
                        h(Dockable.Row, null, { default: nodeSlot }),
                    ],
                },
            ),
        );
        const root = mustPath("/layout");
        expect(root.tagName).toBe("SECTION");
        expect(root.style.position).toBe("relative");
        expect(mustPath("/ts0/tb0")).toBeInTheDocument();
    });

    it("calls the render slot with the props, the state and the children", async () => {
        const renderTab = vi.fn(
            ({
                props,
                state,
                children,
            }: {
                props: Record<string, unknown>;
                state: TabState;
                children: () => VNodeChild;
            }): VNode[] => [
                h(
                    "button",
                    {
                        type: "button",
                        ...props,
                        "data-was-selected": String(state.selected),
                    },
                    [h(children)],
                ),
            ],
        );
        await app(() =>
            h(
                Dockable.Root,
                { model: fresh() },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: tabsetsWith(() => ({}), {
                                render: renderTab,
                                default: () => "label",
                            }),
                        }),
                    ],
                },
            ),
        );
        expect(renderTab).toHaveBeenCalled();
        const tab0 = mustPath("/ts0/tb0");
        expect(tab0.tagName).toBe("BUTTON");
        expect(tab0).toHaveAttribute("role", "tab");
        expect(tab0).toHaveAttribute("data-was-selected", "true");
        expect(tab0.textContent).toBe("label");
        expect(mustPath("/ts0/tb1")).toHaveAttribute(
            "data-was-selected",
            "false",
        );
    });

    it("registers the element bound from the render slot with the engine", async () => {
        await app(() =>
            h(
                Dockable.Root,
                { model: fresh() },
                {
                    render: ({
                        props,
                        children,
                    }: {
                        props: Record<string, unknown>;
                        children: () => VNodeChild;
                    }) => [h("main", props, [h(children)])],
                    default: () => [
                        h(Dockable.Row, null, { default: nodeSlot }),
                        h(Dockable.Panels, null, { default: panelSlot }),
                    ],
                },
            ),
        );
        expect(mustPath("/layout").tagName).toBe("MAIN");
        // the panels render once the root is attached: the render slot's element is the root
        expect(mustPath("/layout")).toContainElement(mustPath("/ts0/t0"));
    });

    it("forwards arbitrary attributes", async () => {
        await renderLayout(fresh(), { "aria-label": "workspace", id: "dock" });
        const root = mustPath("/layout");
        expect(root).toHaveAttribute("aria-label", "workspace");
        expect(root).toHaveAttribute("id", "dock");
        expect(root).toHaveAttribute("data-testid", "root");
    });

    it("merges class and style as fallthrough attributes (state through data-* in CSS)", async () => {
        await app(() =>
            h(
                Dockable.Root,
                { model: fresh() },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: tabsetsWith(() => ({
                                class: ["tab", { on: true }],
                                style: "opacity: 0.5",
                            })),
                        }),
                    ],
                },
            ),
        );
        expect(mustPath("/ts0/tb0")).toHaveClass("tab", "on");
        expect(mustPath("/ts0/tb1").style.opacity).toBe("0.5");
    });

    it("composes consumer listeners after the internal ones", async () => {
        const calls: string[] = [];
        const model = fresh();
        model.use((ctx, next) => {
            if (!ctx.dryRun) {
                calls.push(`command:${ctx.command}`);
            }
            return next();
        });
        await app(() =>
            h(
                Dockable.Root,
                { model },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: tabsetsWith((tab) => ({
                                onClick: () => calls.push(`click:${tab.id}`),
                            })),
                        }),
                    ],
                },
            ),
        );
        click(mustPath("/ts0/tb1"));
        expect(calls).toEqual(["command:tab.select", "click:t1"]);
    });

    it("keeps structural style keys over the consumer's", async () => {
        await app(() =>
            h(
                Dockable.Root,
                { model: fresh(), style: { position: "static", color: "red" } },
                {
                    default: () => [
                        h(
                            Dockable.Row,
                            {
                                style: {
                                    display: "block",
                                    "flex-direction": "column",
                                    margin: "4px",
                                },
                            },
                            { default: nodeSlot },
                        ),
                        h(Dockable.Panels, null, {
                            default: ({ tab }: { tab: TabOf<Types> }) => [
                                h(Dockable.Panel, {
                                    node: tab,
                                    style: "position: static; display: flex; left: 999px; padding: 2px",
                                }),
                            ],
                        }),
                    ],
                },
            ),
        );
        const root = mustPath("/layout");
        expect(root.style.position).toBe("relative");
        expect(root.style.color).toBe("red");
        const row = mustPath("/row");
        expect(row.style.display).toBe("flex");
        expect(row.style.flexDirection).toBe("row");
        expect(row.style.margin).toBe("4px");
        const panel = mustPath("/ts0/t0");
        expect(panel.style.position).toBe("absolute");
        expect(panel.style.left).toBe("0px");
        expect(panel.style.display).toBe("");
        expect(panel.style.padding).toBe("2px");
    });

    it("drops the engine's style keys from a Panel's render slot element too", async () => {
        await app(() =>
            h(
                Dockable.Root,
                { model: fresh() },
                {
                    default: () => [
                        h(Dockable.Row, null, { default: nodeSlot }),
                        h(Dockable.Panels, null, {
                            default: ({ tab }: { tab: TabOf<Types> }) => [
                                h(
                                    Dockable.Panel,
                                    {
                                        node: tab,
                                        style: {
                                            position: "static",
                                            right: "7px",
                                            bottom: "3px",
                                            padding: "2px",
                                        },
                                    },
                                    {
                                        render: ({
                                            props,
                                        }: {
                                            props: Record<string, unknown>;
                                        }) => [h("section", props)],
                                    },
                                ),
                            ],
                        }),
                    ],
                },
            ),
        );
        const panel = mustPath("/ts0/t0");
        expect(panel.tagName).toBe("SECTION");
        expect(panel.style.position).toBe("absolute");
        expect(panel.style.right).toBe("");
        expect(panel.style.bottom).toBe("");
        expect(panel.style.padding).toBe("2px");
    });

    it("applies only structural inline styles", async () => {
        const STRUCTURAL = new Set([
            "position",
            "left",
            "top",
            "right",
            "bottom",
            "inset",
            "width",
            "height",
            "display",
            "flex-direction",
            "flex-basis",
            "flex-grow",
            "min-width",
            "min-height",
            "max-width",
            "max-height",
            "overflow",
            "transform",
        ]);
        await renderLayout(fresh());
        for (const element of document.querySelectorAll<HTMLElement>(
            "[data-layout-path], [data-dockable-moveable]",
        )) {
            for (let i = 0; i < element.style.length; i++) {
                const key = element.style.item(i);
                expect(
                    STRUCTURAL.has(key),
                    `${element.dataset.layoutPath}: ${key}`,
                ).toBe(true);
            }
        }
    });
});

describe("template ref stability", () => {
    it("attaches the root once, whatever re-renders", async () => {
        const model = fresh();
        const attach = vi.fn();
        const Probe = defineComponent({
            name: "TestProbe",
            setup() {
                const { engine } = useDockable();
                const original = engine.adapter.attachRoot.bind(engine);
                engine.adapter.attachRoot = (element: HTMLElement) => {
                    attach();
                    original(element);
                };
                return () => null;
            },
        });
        await renderLayout(model, {}, () => [h(Probe)]);
        model.run("tab.select", { tabId: "t1" });
        await settle();
        model.run("tab.select", { tabId: "t0" });
        await settle();
        // the probe's setup patches attachRoot before the root's element mounts: that first
        // attach is the only one
        expect(attach).toHaveBeenCalledTimes(1);
    });
});

describe("interaction", () => {
    it("selects a tab on click with tab.select", async () => {
        const model = fresh();
        const commands = recordCommands(model);
        await renderLayout(model);
        click(mustPath("/ts0/tb1"));
        await settle();
        expect(commands).toEqual([
            {
                command: "tab.select",
                payload: { tabId: "t1" },
                transient: false,
            },
        ]);
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "true");
    });

    it("moves focus with the arrow keys, Home and End, and selects with Enter", async () => {
        const model = fresh();
        const commands = recordCommands(model);
        await renderLayout(model);
        const tab0 = mustPath("/ts0/tb0");
        const tab1 = mustPath("/ts0/tb1");
        tab0.focus();

        keyDown(tab0, { key: "ArrowRight" });
        expect(document.activeElement).toBe(tab1);
        expect(commands).toEqual([]); // manual activation

        keyDown(tab1, { key: "Home" });
        expect(document.activeElement).toBe(tab0);
        keyDown(tab0, { key: "End" });
        expect(document.activeElement).toBe(tab1);
        keyDown(tab1, { key: "ArrowLeft" });
        expect(document.activeElement).toBe(tab0);

        keyDown(tab1, { key: "Enter" });
        await settle();
        expect(commands).toEqual([
            {
                command: "tab.select",
                payload: { tabId: "t1" },
                transient: false,
            },
        ]);
        expect(tab1).toHaveAttribute("aria-selected", "true");
    });

    it("reverses the horizontal arrow keys in RTL, where the strip runs from the right", async () => {
        document.documentElement.dir = "rtl";
        try {
            await renderLayout(fresh());
            const tab0 = mustPath("/ts0/tb0");
            const tab1 = mustPath("/ts0/tb1");
            tab0.focus();
            keyDown(tab0, { key: "ArrowLeft" });
            expect(document.activeElement).toBe(tab1);
            keyDown(tab1, { key: "ArrowRight" });
            expect(document.activeElement).toBe(tab0);
        } finally {
            document.documentElement.removeAttribute("dir");
        }
    });

    it("closes a tab with the closeTab key", async () => {
        const model = fresh();
        await renderLayout(model);
        keyDown(mustPath("/ts0/tb1"), { key: "Delete", ctrlKey: true });
        expect(model.get("node-by", { id: "t1" })).toBeUndefined();
    });

    it("moves focus to the previous tab when the last tab is closed", async () => {
        const model = fresh();
        await renderLayout(model);
        const last = mustPath("/ts0/tb1");
        last.focus();
        keyDown(last, { key: "Delete", ctrlKey: true });
        await settle();
        expect(model.get("node-by", { id: "t1" })).toBeUndefined();
        expect(document.activeElement).toBe(mustPath("/ts0/tb0"));
    });

    it("makes a tabset active on pointer down", async () => {
        const model = fresh();
        await renderLayout(model);
        pointerDown(mustPath("/ts1"));
        expect(model.get("active-tabset")?.id).toBe("ts1");
    });

    it("runs row.resize from the splitter keyboard", async () => {
        const model = fresh();
        const commands = recordCommands(model);
        await renderLayout(model);
        keyDown(mustPath("/s0"), { key: "ArrowRight" });
        const resize = commands.find((c) => c.command === "row.resize");
        expect(resize).toMatchObject({
            payload: { rowId: "row" },
            transient: false,
        });
    });

    it("announces the splitter's new value after one arrow key", async () => {
        // a 200px row whose tabsets share it by their flex-grow, as a browser lays them out
        const grow = (p: string) => Number(path(p)?.style.flexGrow ?? 1) || 1;
        vi.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect",
        ).mockImplementation(function (this: HTMLElement) {
            const first = (200 * grow("/ts0")) / (grow("/ts0") + grow("/ts1"));
            const p = this.getAttribute("data-layout-path");
            const [x, width] =
                p === "/ts0"
                    ? [0, first]
                    : p === "/ts1"
                      ? [first, 200 - first]
                      : p === "/s0"
                        ? [first, 0]
                        : [0, 200];
            return DOMRect.fromRect({ x, y: 0, width, height: 100 });
        });
        await renderLayout(fresh());
        const splitter = mustPath("/s0");
        expect(splitter).toHaveAttribute("aria-valuenow", "50");
        keyDown(splitter, { key: "ArrowRight" });
        await settle();
        expect(splitter).toHaveAttribute("aria-valuenow", "55");
        expect(splitter).toHaveAttribute("aria-valuetext", "55%");
    });

    it("ignores a keydown that carries no key (caplin/FlexLayout#529)", async () => {
        const errors: unknown[] = [];
        const onError = (event: ErrorEvent) => {
            errors.push(event.error);
            event.preventDefault();
        };
        window.addEventListener("error", onError);
        try {
            const model = fresh();
            const commands = recordCommands(model);
            await renderLayout(model, {
                keyMap: { focusNextTabset: "Ctrl+ArrowRight" },
            });
            for (const target of [
                document.body,
                mustPath("/ts0/tb0"),
                mustTestId("input-t0"),
            ]) {
                target.dispatchEvent(new Event("keydown", { bubbles: true }));
            }
            expect(errors).toEqual([]);
            expect(commands).toEqual([]);
        } finally {
            window.removeEventListener("error", onError);
        }
    });
});

describe("panels and content", () => {
    it("keeps the moveable element and the content state across re-renders and selection changes", async () => {
        const model = fresh();
        await renderLayout(model);
        const moveable = mustPath("/ts0/t0").querySelector(
            `[${MOVEABLE_ATTRIBUTE}]`,
        );
        expect(moveable).not.toBeNull();
        click(mustTestId("inc-t0"));
        typeInto(mustTestId("input-t0"), "kept");
        await settle();

        model.run("tab.select", { tabId: "t1" });
        await settle();
        model.run("tab.select", { tabId: "t0" });
        await settle();

        expect(
            mustPath("/ts0/t0").querySelector(`[${MOVEABLE_ATTRIBUTE}]`),
        ).toBe(moveable);
        expect(mustTestId("inc-t0")).toHaveTextContent("count 1");
        expect(mustTestId("input-t0")).toHaveValue("kept");
        expect(mounts.get("t0")).toBe(1);
    });

    it("never remounts or reorders content when a tab moves to another tabset", async () => {
        const model = fresh();
        await renderLayout(model);
        click(mustTestId("inc-t2"));
        await settle();
        const content = mustTestId("content-t2");

        model.run("tab.move", {
            tabId: "t2",
            to: "ts0",
            location: "center",
            index: 0,
        });
        await settle();

        expect(mustTestId("content-t2")).toBe(content);
        expect(mustTestId("inc-t2")).toHaveTextContent("count 1");
        expect(mounts.get("t2")).toBe(1);
        // t2 is now the first tab of ts0 (its panel path follows)
        expect(mustPath("/ts0/t0")).toContainElement(content);
    });

    it("keeps content state through layout.load of saved layouts (undo and redo)", async () => {
        const model = fresh();
        await renderLayout(model);
        click(mustTestId("inc-t2"));
        typeInto(mustTestId("input-t2"), "typed");
        await settle();
        const content = mustTestId("content-t2");
        const saved = model.get("layout-json");

        model.run("tab.move", {
            tabId: "t2",
            to: "ts0",
            location: "center",
            index: -1,
        });
        await settle();
        const moved = model.get("layout-json");
        model.run("layout.load", { layout: saved }); // "undo"
        await settle();
        expect(mustPath("/ts1/t0")).toContainElement(content);
        expect(mustTestId("content-t2")).toBe(content);
        model.run("layout.load", { layout: moved }); // "redo"
        await settle();
        expect(mustPath("/ts0/t2")).toContainElement(content);

        expect(mustTestId("content-t2")).toBe(content);
        expect(mustTestId("inc-t2")).toHaveTextContent("count 1");
        expect(mustTestId("input-t2")).toHaveValue("typed");
        expect(mounts.get("t2")).toBe(1);
    });

    it("moves a panel between two layers in one document without remounting the content", async () => {
        const model = createModel<Types>({
            ...structuredClone(twoTabsets),
            defaults: { tab: { poppable: true } },
        });
        const layerHost = document.body.appendChild(
            document.createElement("div"),
        );
        // the popout's native window: an iframe's, so nothing opens
        const frame = document.body.appendChild(
            document.createElement("iframe"),
        );
        const popoutWindow = frame.contentWindow;
        if (!popoutWindow) throw new Error("no window");

        // stands in for the popout's layer: the window layout's engine attached to a second panel
        // layer, in the same document
        const SecondLayer = defineComponent({
            name: "SecondLayer",
            setup() {
                const { setLayer, engine, revision } =
                    useDockableContext("test");
                const attached = new Set<LayoutEngine>();
                const attach = () => {
                    for (const window of model.state.windows) {
                        const sub = engine.adapter
                            .getPopoutManager()
                            .getLayoutEngine(window.id);
                        if (!sub || attached.has(sub)) {
                            continue;
                        }
                        attached.add(sub);
                        sub.adapter.attachRoot(layerHost);
                        setLayer(window.id, layerHost);
                    }
                };
                onMounted(attach);
                onUpdated(attach);
                return () => {
                    revision.value;
                    return null;
                };
            },
        });

        await render(
            defineComponent({
                setup: () => () =>
                    h(
                        Layout,
                        {
                            model,
                            supportsPopout: true,
                            openWindow: () => popoutWindow,
                        },
                        { default: () => [h(SecondLayer)] },
                    ),
            }),
        );
        click(mustTestId("inc-t2"));
        await settle();
        const content = mustTestId("content-t2");
        const moveable = content.closest(`[${MOVEABLE_ATTRIBUTE}]`);

        const result = model.run("tab.popout", { tabId: "t2" });
        expect(result.ok).toBe(true);
        await settle();

        expect(layerHost).toContainElement(content);
        expect(content.closest(`[${MOVEABLE_ATTRIBUTE}]`)).toBe(moveable);
        expect(mustTestId("inc-t2")).toHaveTextContent("count 1");
        expect(mounts.get("t2")).toBe(1);
        layerHost.remove();
        frame.remove();
    });

    it("renders only selected (or already rendered) tabs with render on demand", async () => {
        await renderLayout(fresh());
        expect(document.querySelector('[data-testid="content-t1"]')).toBeNull();
        click(mustPath("/ts0/tb1"));
        await settle();
        expect(mustTestId("content-t1")).toBeInTheDocument();
        click(mustPath("/ts0/tb0"));
        await settle();
        expect(mustTestId("content-t1")).toBeInTheDocument(); // kept alive
    });

    it("registers each element once: no warnings, no duplicate registrations", async () => {
        const warn = vi.spyOn(console, "warn");
        const error = vi.spyOn(console, "error");
        const model = fresh();
        let engine: LayoutEngine | undefined;
        const Probe = defineComponent({
            name: "TestProbe",
            setup() {
                engine = useDockable().engine;
                return () => null;
            },
        });
        await renderLayout(model, {}, () => [h(Probe)]);
        model.run("tab.select", { tabId: "t1" });
        await settle();
        model.run("tab.select", { tabId: "t0" });
        await settle();
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        const registrations = engine?.adapter.getRegistrations();
        // row + 2 x (tabset, tabstrip, tabsetcontent) + 3 tab buttons
        expect(registrations?.measurables.size).toBe(10);
        expect(registrations?.tabPanels.size).toBe(3);
        expect(registrations?.splitters.size).toBe(1);
        expect(
            document.querySelectorAll(`[${MOVEABLE_ATTRIBUTE}]`),
        ).toHaveLength(3);
    });

    it("keeps the model's listeners at one set, whatever props change (caplin/FlexLayout#504)", async () => {
        const model = fresh();
        let listeners = 0;
        let calls = 0;
        const subscribe = model.subscribe;
        model.subscribe = (listener) => {
            listeners++;
            const unsubscribe = subscribe((event) => {
                calls++;
                listener(event);
            });
            return () => {
                listeners--;
                unsubscribe();
            };
        };
        const wrapper = await render(Layout, { model });
        const mounted = listeners;
        expect(mounted).toBeGreaterThan(0);
        // the root's props reach the fixture as attributes, which it passes on
        const layout = wrapper as unknown as {
            setProps(props: Record<string, unknown>): Promise<void>;
        };
        for (const [i, props] of [
            { keyMap: { closeTab: "Ctrl+W" } },
            { realtimeResize: false, tabDragSpeed: 0.1 },
            { onExternalDrag: () => undefined, popoutURL: "popout.html" },
            { keyMap: { closeTab: "Ctrl+W" }, onExternalDrag: () => undefined },
        ].entries()) {
            await layout.setProps(props);
            await settle();
            expect(listeners, `after re-render ${i}`).toBe(mounted);
        }
        model.run("tab.select", { tabId: "t1" });
        await settle();
        expect(calls).toBe(mounted);
        wrapper.unmount();
        expect(listeners).toBe(0);
    });
});

describe("composables", () => {
    it("useDockable runs commands through the model's middleware", async () => {
        const model = fresh();
        const commands = recordCommands(model);
        const SelectButton = defineComponent({
            name: "SelectButton",
            setup() {
                const { model } = useDockable<Types>();
                return () =>
                    h(
                        "button",
                        {
                            type: "button",
                            "data-testid": "select",
                            onClick: () =>
                                model.run("tab.select", { tabId: "t1" }),
                        },
                        "select",
                    );
            },
        });
        await renderLayout(model, {}, () => [h(SelectButton)]);
        click(mustTestId("select"));
        await settle();
        expect(commands).toEqual([
            {
                command: "tab.select",
                payload: { tabId: "t1" },
                transient: false,
            },
        ]);
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "true");
    });

    it('Row takes a #splitter slot and :splitter="false"', async () => {
        const model = fresh();
        const first = await app(() =>
            h(
                Dockable.Root,
                { model },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: nodeSlot,
                            splitter: ({
                                props,
                            }: {
                                props: { index: number };
                            }) => [
                                h("hr", {
                                    "data-testid": `custom-${props.index}`,
                                }),
                            ],
                        }),
                    ],
                },
            ),
        );
        expect(mustTestId("custom-1")).toBeInTheDocument();
        first.unmount();
        await app(() =>
            h(
                Dockable.Root,
                { model },
                {
                    default: () => [
                        h(
                            Dockable.Row,
                            { splitter: false },
                            { default: nodeSlot },
                        ),
                        h(Dockable.Panels, null, { default: panelSlot }),
                    ],
                },
            ),
        );
        expect(document.querySelector('[role="separator"]')).toBeNull();
    });

    it("renders nested rows through the default slot", async () => {
        const model = createModel<Types>({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "test",
                                label: "A",
                                data: { name: "A" },
                            },
                        ],
                    },
                    {
                        type: "row",
                        children: [
                            {
                                type: "tabset",
                                children: [
                                    {
                                        component: "test",
                                        label: "B",
                                        data: { name: "B" },
                                    },
                                ],
                            },
                            {
                                type: "tabset",
                                children: [
                                    {
                                        component: "test",
                                        label: "C",
                                        data: { name: "C" },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });
        await renderLayout(model);
        expect(mustPath("/r1")).toHaveAttribute("data-orientation", "vertical");
        expect(mustPath("/r1/ts1/tb0")).toHaveTextContent("C");
        expect(mustPath("/r1/s0")).toHaveAttribute(
            "aria-orientation",
            "horizontal",
        );
        expect(model.get("root-row")?.children).toHaveLength(2);
    });

    it("remounts the layout, with a new engine, for another model", async () => {
        const engines: LayoutEngine[] = [];
        const Probe = defineComponent({
            name: "TestProbe",
            setup() {
                engines.push(useDockable().engine);
                return () => null;
            },
        });
        const wrapper = mount(Layout, {
            props: { model: fresh() },
            slots: { default: () => [h(Probe)] },
            attachTo: document.body.appendChild(document.createElement("div")),
        });
        await settle();
        await wrapper.setProps({ model: fresh() });
        await settle();
        expect(engines).toHaveLength(2);
        expect(engines[0]).not.toBe(engines[1]);
        expect(mustPath("/ts0/tb0")).toHaveAttribute("aria-selected", "true");
    });
});
