import {
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabJson,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { describe, expect, it, vi } from "vitest";
import {
    defineComponent,
    h,
    type PropType,
    type VNode,
    type VNodeChild,
} from "vue";
import { type TabOverflowTriggerState, useTabOverflow } from "../src";
import { Dockable, recordCommands, render, settle, type Types } from "./layout";

// jsdom measures a tab list as 100px and a tab as 30px (tests/setup.ts): 3 of 4 tabs fit
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: ["a", "b", "c", "d"].map(
                    (id): TabJson<Types> => ({
                        id,
                        component: "test",
                        label: id.toUpperCase(),
                        data: { name: id.toUpperCase() },
                    }),
                ),
            },
        ],
    },
};

const load = (): Model<Types> => createModel<Types>(structuredClone(json));

const Menu = defineComponent({
    name: "OverflowMenu",
    props: {
        tabset: { type: Object as PropType<TabsetNode<Types>>, required: true },
    },
    setup(props) {
        const { hiddenTabs } = useTabOverflow(() => props.tabset);
        return () =>
            h(
                "ul",
                { "data-testid": "menu" },
                hiddenTabs.value.map((tab) =>
                    h("li", { key: tab.id }, tab.label),
                ),
            );
    },
});

type Child = TabsetNode<Types> | RowNode<Types>;

function overflowLayout(
    model: Model<Types>,
    trigger?: (tabset: TabsetNode<Types>) => VNodeChild,
) {
    return defineComponent({
        setup: () => () =>
            h(
                Dockable.Root,
                { model },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: ({ node: tabset }: { node: Child }) =>
                                tabset.type === "tabset"
                                    ? [
                                          h(
                                              Dockable.TabSet,
                                              { node: tabset },
                                              {
                                                  default: () => [
                                                      h(
                                                          Dockable.TabList,
                                                          null,
                                                          {
                                                              default: ({
                                                                  tab,
                                                              }: {
                                                                  tab: TabOf<Types>;
                                                              }) => [
                                                                  h(
                                                                      Dockable.Tab,
                                                                      {
                                                                          node: tab,
                                                                      },
                                                                      {
                                                                          default:
                                                                              () =>
                                                                                  tab.label,
                                                                      },
                                                                  ),
                                                              ],
                                                          },
                                                      ),
                                                      trigger
                                                          ? trigger(tabset)
                                                          : h(
                                                                Dockable.TabOverflowTrigger,
                                                                {
                                                                    "data-testid":
                                                                        "trigger",
                                                                },
                                                                {
                                                                    default:
                                                                        () => [
                                                                            h(
                                                                                "span",
                                                                                "more",
                                                                            ),
                                                                        ],
                                                                },
                                                            ),
                                                      h(Menu, { tabset }),
                                                      h(Dockable.TabSetContent),
                                                  ],
                                              },
                                          ),
                                      ]
                                    : [],
                        }),
                    ],
                },
            ),
    });
}

/** A tabset with a bare tab list and a trigger, for the variants below. */
function bareLayout(model: Model<Types>, overflow?: boolean, label?: string) {
    return defineComponent({
        setup: () => () =>
            h(
                Dockable.Root,
                { model },
                {
                    default: () => [
                        h(Dockable.Row, null, {
                            default: ({ node: tabset }: { node: Child }) =>
                                tabset.type === "tabset"
                                    ? [
                                          h(
                                              Dockable.TabSet,
                                              { node: tabset },
                                              {
                                                  default: () => [
                                                      h(
                                                          Dockable.TabList,
                                                          { overflow },
                                                          {
                                                              default: ({
                                                                  tab,
                                                              }: {
                                                                  tab: TabOf<Types>;
                                                              }) => [
                                                                  h(
                                                                      Dockable.Tab,
                                                                      {
                                                                          node: tab,
                                                                      },
                                                                  ),
                                                              ],
                                                          },
                                                      ),
                                                      h(
                                                          Dockable.TabOverflowTrigger,
                                                          {
                                                              "data-testid":
                                                                  "trigger",
                                                              "aria-label":
                                                                  label,
                                                          },
                                                      ),
                                                  ],
                                              },
                                          ),
                                      ]
                                    : [],
                        }),
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

const byTestId = (id: string) =>
    document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const testId = (id: string) => {
    const found = byTestId(id);
    if (!found) throw new Error(`no element ${id}`);
    return found;
};

describe("tab overflow", () => {
    it("hides the tabs that do not fit, and shows the trigger with the hidden ones", async () => {
        await render(overflowLayout(load()));
        expect(path("/ts0/tabstrip")).toHaveAttribute("data-overflowing", "");
        const hiddenTab = element("/ts0/tb3");
        expect(hiddenTab).toHaveAttribute("data-overflow-hidden", "");
        expect(hiddenTab.style.display).toBe("none");
        const visibleTab = element("/ts0/tb0");
        expect(visibleTab).not.toHaveAttribute("data-overflow-hidden");
        expect(visibleTab.style.display).toBe("");
        const trigger = testId("trigger");
        expect(trigger).toHaveAttribute(
            "data-layout-path",
            "/ts0/button/overflow",
        );
        expect(trigger).toHaveAttribute("data-count", "1");
        expect(trigger).toHaveAttribute("type", "button");
        expect(testId("menu")).toHaveTextContent("D");
    });

    it("brings a tab selected from the menu into the strip, hiding another in its place", async () => {
        const model = load();
        await render(overflowLayout(model));
        model.run("tab.select", { tabId: "d" });
        await settle();
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
        expect(path("/ts0/tb2")).toHaveAttribute("data-overflow-hidden", "");
        expect(testId("menu")).toHaveTextContent("C");
    });

    it("selects a hidden tab reached with the arrow keys, which brings it into the strip", async () => {
        const model = load();
        const commands = recordCommands(model);
        await render(overflowLayout(model));
        const tab2 = element("/ts0/tb2");
        tab2.focus();
        tab2.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        );
        await settle();
        expect(commands.at(-1)).toEqual({
            command: "tab.select",
            payload: { tabId: "d" },
            transient: false,
        });
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
    });

    it("switches tabs at the overflow boundary without an update loop (caplin/FlexLayout#498)", async () => {
        const warn = vi.spyOn(console, "warn");
        const error = vi.spyOn(console, "error");
        const model = load();
        await render(overflowLayout(model));
        // every switch moves a tab across the boundary (3 of 4 fit), back and forth
        for (const id of ["d", "a", "c", "d", "b", "d", "a"]) {
            model.run("tab.select", { tabId: id });
            await settle();
            expect(path(`/ts0/tb${"abcd".indexOf(id)}`)).not.toHaveAttribute(
                "data-overflow-hidden",
            );
        }
        // Vue warns on a recursive update ("Maximum recursive updates exceeded")
        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        warn.mockRestore();
        error.mockRestore();
    });

    it("renders no trigger, and no data-overflowing, when every tab fits", async () => {
        const model = load();
        await render(overflowLayout(model));
        model.run("tab.close", { tabId: "d" });
        await settle();
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-overflowing");
        expect(byTestId("trigger")).toBeNull();
        expect(path("/ts0/tb2")).not.toHaveAttribute("data-overflow-hidden");
    });
});

describe("TabList :overflow=false", () => {
    it("keeps every tab, for a strip that wraps or scrolls", async () => {
        await render(bareLayout(load(), false));
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-overflowing");
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
        expect(byTestId("trigger")).toBeNull();
    });
});

describe("Dockable.TabOverflowTrigger follows the primitive contract", () => {
    it("takes the render slot, fallthrough attributes, listeners, class and style", async () => {
        const onClick = vi.fn();
        let seen: TabOverflowTriggerState | undefined;
        await render(
            overflowLayout(load(), () =>
                h(
                    Dockable.TabOverflowTrigger,
                    {
                        "data-testid": "trigger",
                        "aria-haspopup": "menu",
                        onClick,
                        class: "more more-1",
                        style: { opacity: 1, display: "block" },
                    },
                    {
                        render: ({
                            props,
                            state,
                        }: {
                            props: Record<string, unknown>;
                            state: TabOverflowTriggerState;
                            children: VNode;
                        }) => {
                            seen = state;
                            return [h("span", props)];
                        },
                    },
                ),
            ),
        );
        const trigger = testId("trigger");
        expect(trigger.tagName).toBe("SPAN");
        expect(trigger).toHaveClass("more", "more-1");
        expect(trigger).toHaveAttribute("aria-haspopup", "menu");
        expect(trigger.style.opacity).toBe("1");
        expect(seen?.hiddenTabs.map((tab) => tab.id)).toEqual(["d"]);
        trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(onClick).toHaveBeenCalled();
    });

    it("renders as another tag with as, and renders no text of its own", async () => {
        await render(
            overflowLayout(load(), () =>
                h(Dockable.TabOverflowTrigger, {
                    "data-testid": "trigger",
                    as: "a",
                    href: "#more",
                }),
            ),
        );
        const trigger = testId("trigger");
        expect(trigger.tagName).toBe("A");
        expect(trigger).toHaveAttribute("href", "#more");
        expect(trigger).toHaveAttribute("data-count", "1");
        expect(trigger.textContent).toBe("");
    });

    it("has no name of its own, and takes the consumer's aria-label", async () => {
        const first = await render(bareLayout(load()));
        expect(testId("trigger")).not.toHaveAttribute("aria-label");
        first.unmount();

        await render(bareLayout(load(), undefined, "More tabs"));
        expect(testId("trigger")).toHaveAccessibleName("More tabs");
    });
});
