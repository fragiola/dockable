// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { type Component, defineComponent, h, nextTick } from "vue";
import { Badge } from "#/components/atoms/badge";
import { Clickable } from "#/components/atoms/clickable";
import { Input } from "#/components/atoms/fields";
import { field } from "#/components/families/field";
import { menu } from "#/components/families/menu";
import { popup } from "#/components/families/popup";
import { track } from "#/components/families/track";
import { AlertDialog } from "#/components/ui/alert-dialog";
import { Chart } from "#/components/ui/chart";
import { ContextMenu } from "#/components/ui/context-menu";
import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { Progress } from "#/components/ui/progress";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { Table } from "#/components/ui/table";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/cn";

// The Vue kit renders what the React kit does: the same roles, accessible names and family classes
// (the shared e2e specs reach the examples through roles and names). Popups open in the document
// their trigger is in: a popout window's document adopts the nodes the main one created, so the
// "popout" here is a second document the component is mounted into.

beforeAll(() => {
    // what jsdom lacks and the primitives measure with
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    globalThis.PointerEvent ??= MouseEvent as typeof PointerEvent;
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
});

const mounted: { unmount(): void }[] = [];
afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount();
    document.body.innerHTML = "";
});

/** Mounts `render` into `document` (the page's, or a popout's) and returns the host's document. */
async function render(render: () => ReturnType<typeof h>, doc = document) {
    const host = doc.createElement("div");
    doc.body.append(host);
    const wrapper = mount(defineComponent({ render }), { attachTo: host });
    mounted.push(wrapper);
    // the trigger registers itself, then the popup renders into its document
    for (let i = 0; i < 4; i++) await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
    return doc;
}

const popout = () => document.implementation.createHTMLDocument("popout");

const classes = (element: Element | null) =>
    element?.getAttribute("class")?.split(/\s+/) ?? [];

/** Every class of a family string is on the element. */
function expectFamily(element: Element | null, family: string) {
    expect(element).not.toBeNull();
    const have = classes(element);
    for (const name of family.split(/\s+/).filter(Boolean)) {
        expect(have, name).toContain(name);
    }
}

function select(props: Record<string, unknown> = {}) {
    return h(
        Select.Root,
        {
            items: { a: "Apples", b: "Bananas" },
            modelValue: "a",
            ...props,
        },
        {
            default: () => [
                h(
                    Select.Trigger,
                    { "aria-label": "Fruit" },
                    { default: () => h(Select.Value) },
                ),
                h(Select.Content, null, {
                    default: () => [
                        h(Select.Item, { value: "a" }, () => "Apples"),
                        h(Select.Item, { value: "b" }, () => "Bananas"),
                    ],
                }),
            ],
        },
    );
}

describe("Select", () => {
    it("is a named combobox wearing field.row, showing the chosen label", async () => {
        const doc = await render(() => select());
        const trigger = doc.querySelector('[role="combobox"]');
        expect(trigger?.getAttribute("aria-label")).toBe("Fruit");
        // the React kit's trigger: field.row with its own layout merged over it
        expectFamily(
            trigger,
            cn(field.row(), "flex-row items-center justify-between px-3 py-2"),
        );
        expect(trigger?.textContent).toContain("Apples");
    });

    it("opens its options in the trigger's document", async () => {
        const doc = await render(() => select({ defaultOpen: true }), popout());
        const list = doc.querySelector('[role="listbox"]');
        expectFamily(list, popup.content());
        expect(list?.hasAttribute("data-open")).toBe(true);
        const options = [...doc.querySelectorAll('[role="option"]')];
        expect(options.map((option) => option.textContent)).toEqual([
            "Apples",
            "Bananas",
        ]);
        expectFamily(options[0] ?? null, menu.selectableItem());
        expect(options[0]?.hasAttribute("data-selected")).toBe(true);
        expect(document.querySelector('[role="listbox"]')).toBeNull();
    });
});

function dropdown(props: Record<string, unknown> = {}) {
    return h(DropdownMenu.Root, props, {
        default: () => [
            h(DropdownMenu.Trigger, { "aria-label": "Add a tab" }, () => "+"),
            h(DropdownMenu.Content, null, {
                default: () => [
                    h(DropdownMenu.Label, null, () => "Palette"),
                    h(DropdownMenu.Item, null, () => "Blue"),
                    h(DropdownMenu.Separator),
                    h(DropdownMenu.Item, { disabled: true }, () => "Rose"),
                ],
            }),
        ],
    });
}

describe("DropdownMenu", () => {
    it("has a named trigger that says it opens a menu", async () => {
        const doc = await render(() => dropdown());
        const trigger = doc.querySelector('[aria-label="Add a tab"]');
        expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
    });

    it("opens a menu of items in the trigger's document", async () => {
        const doc = await render(
            () => dropdown({ defaultOpen: true }),
            popout(),
        );
        const list = doc.querySelector('[role="menu"]');
        expectFamily(list, popup.content());
        const items = [...doc.querySelectorAll('[role="menuitem"]')];
        expect(items.map((item) => item.textContent)).toEqual(["Blue", "Rose"]);
        expectFamily(items[0] ?? null, menu.item());
        expect(items[1]?.hasAttribute("data-disabled")).toBe(true);
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });
});

describe("ContextMenu", () => {
    it("opens on a right click, in the trigger's document", async () => {
        const doc = await render(
            () =>
                h(ContextMenu.Root, null, {
                    default: () => [
                        h(
                            ContextMenu.Trigger,
                            { "data-testid": "area" },
                            () => "Tab",
                        ),
                        h(ContextMenu.Content, null, {
                            default: () => [
                                h(ContextMenu.Item, null, () => "Close"),
                                h(ContextMenu.Separator),
                                h(ContextMenu.Item, null, () => "Rename"),
                            ],
                        }),
                    ],
                }),
            popout(),
        );
        const area = doc.querySelector('[data-testid="area"]');
        expectFamily(area, "select-none");
        area?.dispatchEvent(
            new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: 10,
                clientY: 10,
            }),
        );
        for (let i = 0; i < 4; i++) await nextTick();
        const items = [...doc.querySelectorAll('[role="menuitem"]')];
        expect(items.map((item) => item.textContent)).toEqual([
            "Close",
            "Rename",
        ]);
        expect(document.querySelector('[role="menu"]')).toBeNull();
    });
});

describe("Tooltip", () => {
    it("shows its content as a tooltip in the trigger's document", async () => {
        const doc = await render(
            () =>
                h(
                    Tooltip.Root,
                    { defaultOpen: true },
                    {
                        default: () => [
                            h(
                                Tooltip.Trigger,
                                { "aria-label": "Locked region" },
                                () => "🔒",
                            ),
                            h(Tooltip.Content, null, () => "Locked by policy"),
                        ],
                    },
                ),
            popout(),
        );
        const tooltip = doc.querySelector('[role="tooltip"]');
        expect(tooltip?.textContent).toBe("Locked by policy");
        expectFamily(tooltip?.parentElement ?? null, popup.tooltip());
        expect(
            doc.querySelector('[aria-label="Locked region"]'),
        ).not.toBeNull();
        expect(document.querySelector('[role="tooltip"]')).toBeNull();
    });
});

describe("Switch", () => {
    it("is a named switch whose checked state is data-checked, as Base UI's", async () => {
        const doc = await render(() =>
            h(
                Switch.Root,
                { "aria-label": "Veto", defaultValue: true },
                { default: () => h(Switch.Thumb) },
            ),
        );
        const control = doc.querySelector('[role="switch"]') as HTMLElement;
        expect(control.getAttribute("aria-label")).toBe("Veto");
        expect(control.getAttribute("aria-checked")).toBe("true");
        expect(control.hasAttribute("data-checked")).toBe(true);
        control.click();
        await nextTick();
        expect(control.getAttribute("aria-checked")).toBe("false");
        expect(control.hasAttribute("data-checked")).toBe(false);
        expect(
            doc
                .querySelector('[data-slot="switch-thumb"]')
                ?.hasAttribute("data-checked"),
        ).toBe(false);
    });
});

describe("Progress", () => {
    it("is a named progressbar whose indicator fills to the value", async () => {
        const doc = await render(() =>
            h(
                Progress.Root,
                { modelValue: 40, "aria-label": "api CPU" },
                {
                    default: () =>
                        h(Progress.Track, null, {
                            default: () => h(Progress.Indicator),
                        }),
                },
            ),
        );
        const bar = doc.querySelector('[role="progressbar"]');
        expect(bar?.getAttribute("aria-label")).toBe("api CPU");
        expect(bar?.getAttribute("aria-valuenow")).toBe("40");
        expectFamily(
            doc.querySelector('[data-slot="progress-track"]'),
            track.rail(),
        );
        const indicator = doc.querySelector(
            '[data-slot="progress-indicator"]',
        ) as HTMLElement;
        expectFamily(indicator, track.fill());
        expect(indicator.style.width).toBe("40%");
    });
});

describe("AlertDialog", () => {
    it("is an alertdialog named by its title and described by its description", async () => {
        const doc = await render(() =>
            h(
                AlertDialog.Root,
                { defaultOpen: true },
                {
                    default: () =>
                        h(AlertDialog.Portal, null, {
                            default: () => [
                                h(AlertDialog.Backdrop),
                                h(AlertDialog.Content, null, {
                                    default: () => [
                                        h(AlertDialog.Header, null, {
                                            default: () => [
                                                h(
                                                    AlertDialog.Title,
                                                    null,
                                                    () => "Save changes?",
                                                ),
                                                h(
                                                    AlertDialog.Description,
                                                    null,
                                                    () =>
                                                        "Your changes will be lost.",
                                                ),
                                            ],
                                        }),
                                        h(AlertDialog.Footer, null, {
                                            default: () =>
                                                h(
                                                    Clickable.Button,
                                                    { size: "sm" },
                                                    () => "Save",
                                                ),
                                        }),
                                    ],
                                }),
                            ],
                        }),
                },
            ),
        );
        const dialog = doc.querySelector('[role="alertdialog"]');
        const title = doc.getElementById(
            dialog?.getAttribute("aria-labelledby") ?? "",
        );
        expect(title?.textContent).toBe("Save changes?");
        expect(title?.tagName).toBe("H2");
        const description = doc.getElementById(
            dialog?.getAttribute("aria-describedby") ?? "",
        );
        expect(description?.textContent).toBe("Your changes will be lost.");
        expect(doc.querySelector("button")?.textContent).toBe("Save");
    });
});

describe("the native parts", () => {
    it("Table renders a table of header cells and cells", async () => {
        const doc = await render(() =>
            h(Table.Root, null, {
                default: () => [
                    h(Table.Header, null, {
                        default: () =>
                            h(Table.Row, null, {
                                default: () =>
                                    h(Table.Head, null, () => "Order"),
                            }),
                    }),
                    h(Table.Body, null, {
                        default: () =>
                            h(Table.Row, null, {
                                default: () =>
                                    h(Table.Cell, null, () => "#1042"),
                            }),
                    }),
                ],
            }),
        );
        expect(doc.querySelector("table th")?.textContent).toBe("Order");
        expect(doc.querySelector("table td")?.textContent).toBe("#1042");
    });

    it("Badge, Clickable.Button and Input.Template.Simple", async () => {
        const doc = await render(() =>
            h("div", [
                h(
                    Badge,
                    { variant: "solid", "aria-label": "3 incidents" },
                    () => "3",
                ),
                h(Clickable.Button, { variant: "ghost" }, () => "Don't save"),
                h(Input.Template.Simple, { label: "Email", type: "email" }),
            ]),
        );
        expect(
            doc.querySelector('[aria-label="3 incidents"]')?.textContent,
        ).toBe("3");
        const button = doc.querySelector("button");
        expect(button?.getAttribute("type")).toBe("button");
        expect(button?.textContent).toBe("Don't save");
        const input = doc.querySelector("input") as HTMLInputElement;
        expect(input.labels?.[0]?.textContent).toBe("Email");
        expectFamily(input, field.control());
    });

    it("Chart renders its scope element (ECharts draws once the tokens are read)", async () => {
        const doc = await render(() =>
            h(Chart as Component, { option: { series: [] }, class: "h-24" }),
        );
        const chart = doc.querySelector('[data-slot="chart"]');
        expectFamily(chart, "w-full h-24");
    });
});
