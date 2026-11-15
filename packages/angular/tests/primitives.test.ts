import { Component, input, type OnInit, signal } from "@angular/core";
import { createModel, MAIN_LAYOUT, type Model } from "@fragiola/dockable";
import { afterEach, describe, expect, it } from "vitest";
import { DOCKABLE, injectDockable } from "../src/public-api";
import { keyDown, mustPath, mustTestId, path, pointerDown } from "./helpers";
import {
    mounts,
    recordCommands,
    render,
    renderLayout,
    setInput,
    settle,
    type Types,
    twoTabsets,
} from "./layout";

const model = () => createModel<Types>(structuredClone(twoTabsets));

afterEach(() => mounts.clear());

/** every element that renders a primitive */
const primitives = () => [
    ...document.querySelectorAll<HTMLElement>("[data-layout-path]"),
];

describe("composition and ARIA", () => {
    it("renders the tree with roles and ARIA attributes", async () => {
        await renderLayout(model());
        const tablist = mustPath("/ts0/tabstrip");
        expect(tablist).toHaveAttribute("role", "tablist");
        expect(tablist).toHaveAttribute("aria-orientation", "horizontal");
        const tab = mustPath("/ts0/tb0");
        expect(tab).toHaveAttribute("role", "tab");
        expect(tab).toHaveAttribute("aria-selected", "true");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("aria-selected", "false");
        expect(tab).toHaveAttribute("tabindex", "0");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("tabindex", "-1");
        const panel = mustPath("/ts0/t0");
        expect(panel).toHaveAttribute("role", "tabpanel");
        expect(tab.getAttribute("aria-controls")).toBe(panel.id);
        expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
        const splitter = mustPath("/s0");
        expect(splitter).toHaveAttribute("role", "separator");
        expect(splitter).toHaveAttribute("aria-orientation", "vertical");
        expect(splitter).toHaveAttribute("tabindex", "0");
    });

    it("emits data-layout-path on every primitive", async () => {
        await renderLayout(model());
        for (const p of [
            "/layout",
            "/row",
            "/ts0",
            "/ts0/tabstrip",
            "/ts0/tb0",
            "/ts0/tb1",
            "/ts0/content",
            "/ts0/t0",
            "/s0",
            "/ts1",
            "/ts1/tb0",
            "/ts1/t0",
        ]) {
            expect(path(p), p).toBeTruthy();
        }
    });

    it("moves every path with the layout when a tabset is inserted before them", async () => {
        const m = model();
        await renderLayout(m);
        // a new tabset at the layout's start edge: the first tabset becomes the second
        m.run("tab.add", {
            component: "test",
            label: "Four",
            data: { name: "Four" },
            to: MAIN_LAYOUT,
            location: "start",
        });
        await settle();
        const strip = (p: string) =>
            [...mustPath(p).querySelectorAll('[role="tab"]')].map((tab) =>
                tab.textContent?.trim(),
            );
        expect(strip("/ts0/tabstrip")).toEqual(["Four"]);
        expect(strip("/ts1/tabstrip")).toEqual(["One", "Two"]);
        expect(strip("/ts2/tabstrip")).toEqual(["Three"]);
        expect(mustPath("/ts1").contains(mustPath("/ts1/content"))).toBe(true);
        expect(mustPath("/ts2").contains(mustPath("/ts2/content"))).toBe(true);
    });

    it('exposes state through data-* only, present or absent, never "false"', async () => {
        await renderLayout(model());
        for (const element of primitives()) {
            for (const attribute of element.getAttributeNames()) {
                if (attribute.startsWith("data-")) {
                    expect(
                        element.getAttribute(attribute),
                        `${element.dataset.layoutPath} ${attribute}`,
                    ).not.toBe("false");
                }
            }
        }
        expect(mustPath("/ts0/tb0")).toHaveAttribute("data-selected", "");
        expect(mustPath("/ts0/tb1")).not.toHaveAttribute("data-selected");
        expect(mustPath("/row")).toHaveAttribute("data-root", "");
        expect(mustPath("/row")).toHaveAttribute(
            "data-orientation",
            "horizontal",
        );
        expect(mustPath("/ts0/t0")).toHaveAttribute("data-visible", "");
    });

    it("marks an empty tabset", async () => {
        const m = model();
        await renderLayout(m);
        expect(mustPath("/ts1")).not.toHaveAttribute("data-empty");
        m.run("tab.move", { tabId: "t2", to: "ts0", index: -1 });
        await settle();
        // the emptied tabset is tidied away; an empty tabset left in place carries data-empty
        for (const tabset of document.querySelectorAll("[data-empty]")) {
            expect(tabset.getAttribute("data-empty")).toBe("");
        }
    });

    it("renders no text and no name of its own", async () => {
        @Component({
            imports: [DOCKABLE],
            template: `
                <div [dockableRoot]="model()">
                    <div dockableRow>
                        <ng-template dockableRowChild let-node>
                            @if (node.type === "tabset") {
                                <div [dockableTabSet]="node">
                                    <div dockableTabList>
                                        <ng-template dockableTabListItem let-tab>
                                            <div [dockableTab]="tab"></div>
                                        </ng-template>
                                    </div>
                                    <div dockableTabSetContent></div>
                                    <button dockablePopoutTrigger></button>
                                    <button dockableTabOverflowTrigger></button>
                                </div>
                            }
                        </ng-template>
                    </div>
                    <ng-template dockablePanels let-tab><div [dockablePanel]="tab"></div></ng-template>
                    <div dockableDropIndicator></div>
                    <div dockableEdgeIndicator="top"></div>
                </div>
            `,
        })
        class Bare {
            readonly model = input.required<Model<Types>>();
        }
        await render(Bare, { model: model() });
        const root = mustPath("/layout");
        expect(root.textContent?.trim()).toBe("");
        for (const element of root.querySelectorAll("*")) {
            expect(element.hasAttribute("aria-label")).toBe(false);
            expect(element.hasAttribute("title")).toBe(false);
        }
    });

    it("names a row's splitter through aria-label in the splitter template", async () => {
        @Component({
            imports: [DOCKABLE],
            template: `
                <div [dockableRoot]="model()">
                    <div dockableRow>
                        <ng-template dockableRowChild let-node>
                            @if (node.type === "tabset") {
                                <div [dockableTabSet]="node"><div dockableTabSetContent></div></div>
                            }
                        </ng-template>
                        <ng-template dockableRowSplitter let-node="node" let-index="index">
                            <div [dockableSplitter]="node" [index]="index" aria-label="Resize" data-testid="named"></div>
                        </ng-template>
                    </div>
                </div>
            `,
        })
        class Named {
            readonly model = input.required<Model<Types>>();
        }
        await render(Named, { model: model() });
        const splitter = mustTestId("named");
        expect(splitter).toHaveAttribute("aria-label", "Resize");
        expect(splitter).toHaveAttribute("data-layout-path", "/s0");
        expect(splitter).toHaveAttribute("role", "separator");
        // between the two tabsets
        expect(splitter.previousElementSibling).toBe(mustPath("/ts0"));
        expect(splitter.nextElementSibling).toBe(mustPath("/ts1"));
    });
});

describe("the consumer's element", () => {
    @Component({
        imports: [DOCKABLE],
        template: `
            <section [dockableRoot]="model()" class="mine" data-extra="yes" style="color: red; position: static">
                <div dockableRow>
                    <ng-template dockableRowChild let-node>
                        @if (node.type === "tabset") {
                            <article
                                [dockableTabSet]="node"
                                style="display: block; opacity: 0.5"
                                (pointerdown)="pressed.set(pressed() + 1)"
                            >
                                <div dockableTabList>
                                    <ng-template dockableTabListItem let-tab>
                                        <button [dockableTab]="tab" (click)="clicks.push(tab.id)">{{ tab.label }}</button>
                                    </ng-template>
                                </div>
                                <div dockableTabSetContent></div>
                            </article>
                        }
                    </ng-template>
                </div>
                <ng-template dockablePanels let-tab>
                    <div [dockablePanel]="tab" style="left: 999px; color: blue"></div>
                </ng-template>
            </section>
        `,
    })
    class Custom {
        readonly model = input.required<Model<Types>>();
        readonly pressed = signal(0);
        readonly clicks: string[] = [];
    }

    it("is the consumer's own: its tag, class and attributes are kept", async () => {
        await render(Custom, { model: model() });
        const root = mustPath("/layout");
        expect(root.tagName).toBe("SECTION");
        expect(root).toHaveClass("mine");
        expect(root).toHaveAttribute("data-extra", "yes");
        expect(mustPath("/ts0").tagName).toBe("ARTICLE");
        expect(mustPath("/ts0/tb0").tagName).toBe("BUTTON");
    });

    it("keeps structural style keys over the consumer's, and the consumer's other keys", async () => {
        await render(Custom, { model: model() });
        const root = mustPath("/layout");
        expect(root.style.position).toBe("relative");
        expect(root.style.color).toBe("red");
        const tabset = mustPath("/ts0");
        expect(tabset.style.display).toBe("flex");
        expect(tabset.style.opacity).toBe("0.5");
        const panel = mustPath("/ts0/t0");
        // the engine owns a panel's geometry
        expect(panel.style.left).toBe("0px");
        expect(panel.style.position).toBe("absolute");
        expect(panel.style.color).toBe("blue");
    });

    it("runs the consumer's listeners with the part's own", async () => {
        const m = model();
        const fixture = await render(Custom, { model: m });
        mustPath("/ts0/tb1").click();
        await settle(fixture);
        expect(fixture.componentInstance.clicks).toEqual(["t1"]);
        expect(m.is("tab-selected", { tabId: "t1" })).toBe(true);
        pointerDown(mustPath("/ts1"));
        await settle(fixture);
        expect(m.is("tabset-active", { tabsetId: "ts1" })).toBe(true);
        pointerDown(mustPath("/ts0"));
        // the consumer's listener ran for both presses
        expect(fixture.componentInstance.pressed()).toBe(2);
        expect(m.is("tabset-active", { tabsetId: "ts0" })).toBe(true);
    });

    it("applies only structural inline styles", async () => {
        await renderLayout(model());
        const STRUCTURAL = new Set([
            "position",
            "inset",
            "left",
            "top",
            "right",
            "bottom",
            "width",
            "height",
            "display",
            "flex-direction",
            "flex-basis",
            "flex-grow",
            "flex-shrink",
            "min-width",
            "min-height",
            "max-width",
            "max-height",
            "overflow",
            "pointer-events",
            "transform",
        ]);
        for (const element of primitives()) {
            for (let i = 0; i < element.style.length; i++) {
                const name = element.style.item(i);
                expect(
                    STRUCTURAL.has(name) ||
                        name.startsWith("inset") ||
                        name.startsWith("overflow"),
                    `${element.dataset.layoutPath}: ${name}`,
                ).toBe(true);
            }
        }
    });
});

describe("interaction", () => {
    it("selects a tab on click with tab.select", async () => {
        const m = model();
        const commands = recordCommands(m);
        await renderLayout(m);
        mustPath("/ts0/tb1").click();
        await settle();
        expect(commands.map((c) => c.command)).toContain("tab.select");
        expect(mustPath("/ts0/tb1")).toHaveAttribute("data-selected", "");
        expect(mustPath("/ts0/tb0")).not.toHaveAttribute("data-selected");
    });

    it("moves focus with the arrow keys, Home and End, and selects with Enter", async () => {
        const m = model();
        await renderLayout(m);
        const first = mustPath("/ts0/tb0");
        first.focus();
        keyDown(first, { key: "ArrowRight" });
        expect(document.activeElement).toBe(mustPath("/ts0/tb1"));
        keyDown(mustPath("/ts0/tb1"), { key: "Home" });
        expect(document.activeElement).toBe(first);
        keyDown(first, { key: "End" });
        expect(document.activeElement).toBe(mustPath("/ts0/tb1"));
        keyDown(mustPath("/ts0/tb1"), { key: "Enter" });
        await settle();
        expect(m.is("tab-selected", { tabId: "t1" })).toBe(true);
    });

    it("runs row.resize from the splitter keyboard", async () => {
        const m = model();
        const commands = recordCommands(m);
        await renderLayout(m);
        keyDown(mustPath("/s0"), { key: "ArrowRight" });
        await settle();
        expect(commands.map((c) => c.command)).toContain("row.resize");
    });

    it("renders a keyboard resize before the key's handlers return", async () => {
        const m = model();
        await renderLayout(m);
        const before = mustPath("/ts0").style.flexGrow;
        keyDown(mustPath("/s0"), { key: "ArrowLeft" });
        // no settle: a screen reader (or a test) reads the new value right after the key
        expect(mustPath("/ts0").style.flexGrow).not.toBe(before);
    });
});

describe("panels and content", () => {
    it("never re-creates content when its tab moves to another tabset", async () => {
        const m = model();
        await renderLayout(m);
        mustTestId("inc-t2").click();
        await settle();
        (mustTestId("input-t2") as HTMLInputElement).value = "kept";
        const content = mustTestId("content-t2");
        m.run("tab.move", { tabId: "t2", to: "ts0", index: -1 });
        await settle();
        expect(mustTestId("content-t2")).toBe(content);
        expect(mustTestId("inc-t2")).toHaveTextContent("count 1");
        expect(mustTestId("input-t2")).toHaveValue("kept");
        expect(mounts.get("t2")).toBe(1);
        // the moved tab's button and panel carry their new paths
        expect(mustPath("/ts0/tb2")).toHaveTextContent("Three");
        expect(content.closest("[role=tabpanel]")).toHaveAttribute(
            "data-layout-path",
            "/ts0/t2",
        );
    });

    it("keeps content state through selection changes and layout.load", async () => {
        const m = model();
        await renderLayout(m);
        mustTestId("inc-t0").click();
        await settle();
        mustPath("/ts0/tb1").click();
        await settle();
        mustPath("/ts0/tb0").click();
        await settle();
        expect(mustTestId("inc-t0")).toHaveTextContent("count 1");
        const saved = m.get("layout-json");
        m.run("tab.move", { tabId: "t0", to: "ts1", index: -1 });
        await settle();
        m.run("layout.load", { layout: saved });
        await settle();
        expect(mustTestId("inc-t0")).toHaveTextContent("count 1");
        expect(mounts.get("t0")).toBe(1);
    });

    it("renders only selected (or already rendered) tabs with render on demand", async () => {
        await renderLayout(model());
        expect(path("/ts0/t0")).toBeTruthy();
        expect(path("/ts0/t1")).toBeNull();
        mustPath("/ts0/tb1").click();
        await settle();
        expect(path("/ts0/t1")).toBeTruthy();
        mustPath("/ts0/tb0").click();
        await settle();
        // kept alive, hidden by the engine
        expect(path("/ts0/t1")).toBeTruthy();
        expect(mustPath("/ts0/t1")).not.toHaveAttribute("data-visible");
    });

    it("puts the panels after the root's other children, wherever their template is", async () => {
        @Component({
            imports: [DOCKABLE],
            template: `
                <div [dockableRoot]="model()">
                    <ng-template dockablePanels let-tab><div [dockablePanel]="tab"></div></ng-template>
                    <div dockableRow>
                        <ng-template dockableRowChild let-node>
                            @if (node.type === "tabset") {
                                <div [dockableTabSet]="node"><div dockableTabSetContent></div></div>
                            }
                        </ng-template>
                    </div>
                </div>
            `,
        })
        class PanelsFirst {
            readonly model = input.required<Model<Types>>();
        }
        await render(PanelsFirst, { model: model() });
        const children = [...mustPath("/layout").children];
        expect(children.indexOf(mustPath("/row"))).toBeLessThan(
            children.indexOf(mustPath("/ts0/t0")),
        );
    });

    it("registers each tab panel with the engine once", async () => {
        @Component({
            imports: [DOCKABLE],
            template: `
                <div [dockableRoot]="model()">
                    <div dockableRow>
                        <ng-template dockableRowChild let-node>
                            @if (node.type === "tabset") {
                                <div [dockableTabSet]="node"><div dockableTabSetContent></div></div>
                            }
                        </ng-template>
                    </div>
                    <ng-template dockablePanels [renderOnDemand]="false" let-tab>
                        <div [dockablePanel]="tab"></div>
                    </ng-template>
                </div>
            `,
        })
        class All {
            readonly model = input.required<Model<Types>>();
        }
        await render(All, { model: model() });
        expect(document.querySelectorAll('[role="tabpanel"]').length).toBe(3);
        expect(path("/ts0/t1")).toBeTruthy();
    });
});

describe("rows", () => {
    const nested = () =>
        createModel<Types>({
            version: 1,
            root: {
                type: "row",
                id: "row",
                children: [
                    {
                        type: "tabset",
                        id: "ts0",
                        children: [
                            {
                                id: "t0",
                                component: "test",
                                label: "One",
                                data: { name: "One" },
                            },
                        ],
                    },
                    {
                        type: "row",
                        id: "r1",
                        children: [
                            {
                                type: "tabset",
                                id: "ts1",
                                children: [
                                    {
                                        id: "t1",
                                        component: "test",
                                        label: "Two",
                                        data: { name: "Two" },
                                    },
                                ],
                            },
                            {
                                type: "tabset",
                                id: "ts2",
                                children: [
                                    {
                                        id: "t2",
                                        component: "test",
                                        label: "Three",
                                        data: { name: "Three" },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        });

    it("renders nested rows through the child template, with their paths and splitters", async () => {
        await renderLayout(nested());
        expect(mustPath("/r1")).toHaveAttribute("data-orientation", "vertical");
        expect(mustPath("/r1")).not.toHaveAttribute("data-root");
        expect(mustPath("/r1/ts0")).toBeTruthy();
        expect(mustPath("/r1/ts1")).toBeTruthy();
        expect(mustPath("/r1/s0")).toHaveAttribute(
            "aria-orientation",
            "horizontal",
        );
        expect(mustPath("/s0")).toBeTruthy();
    });

    it("renders a nested row with its parent's templates when it has none", async () => {
        @Component({
            imports: [DOCKABLE],
            template: `
                <div [dockableRoot]="model()">
                    <div dockableRow>
                        <ng-template [dockableRowChild]="model()" let-node>
                            @if (node.type === "row") {
                                <div [dockableRow]="node"></div>
                            } @else {
                                <div [dockableTabSet]="node"><div dockableTabSetContent></div></div>
                            }
                        </ng-template>
                        <ng-template dockableRowSplitter let-node="node" let-index="index">
                            <div [dockableSplitter]="node" [index]="index" aria-label="Resize"></div>
                        </ng-template>
                    </div>
                </div>
            `,
        })
        class Recursive {
            readonly model = input.required<Model<Types>>();
        }
        const m = nested();
        await render(Recursive, { model: m });
        const row = mustPath("/r1");
        expect(mustPath("/r1/ts0").parentElement).toBe(row);
        expect(mustPath("/r1/s0").parentElement).toBe(row);
        expect(mustPath("/r1/s0")).toHaveAttribute("aria-label", "Resize");
        expect(
            [...row.children].map((child) =>
                child.getAttribute("data-layout-path"),
            ),
        ).toEqual(["/r1/ts0", "/r1/s0", "/r1/ts1"]);
        // a reorder inside the nested row keeps its children inside it, in order
        m.run("tabset.move", { tabsetId: "ts2", to: "ts1", location: "top" });
        await settle();
        expect(
            [...mustPath("/r1").children].map((child) =>
                child.getAttribute("data-layout-path"),
            ),
        ).toEqual(["/r1/ts0", "/r1/s0", "/r1/ts1"]);
        expect(mustPath("/r1/ts0")).toHaveAttribute(
            "data-layout-path",
            "/r1/ts0",
        );
        expect(document.querySelectorAll('[role="separator"]')).toHaveLength(2);
    });

    it('renders no splitter with [splitter]="false"', async () => {
        @Component({
            imports: [DOCKABLE],
            template: `
                <div [dockableRoot]="model()">
                    <div dockableRow [splitter]="false">
                        <ng-template dockableRowChild let-node>
                            @if (node.type === "tabset") {
                                <div [dockableTabSet]="node"><div dockableTabSetContent></div></div>
                            }
                        </ng-template>
                    </div>
                </div>
            `,
        })
        class NoSplitter {
            readonly model = input.required<Model<Types>>();
        }
        await render(NoSplitter, { model: model() });
        expect(document.querySelector('[role="separator"]')).toBeNull();
        expect(mustPath("/ts1")).toBeTruthy();
    });

    it("keeps the children's order in the DOM as they move", async () => {
        const m = model();
        await renderLayout(m);
        m.run("tabset.move", { tabsetId: "ts1", to: "ts0", location: "start" });
        await settle();
        const order = [...mustPath("/row").children]
            .map((child) => child.getAttribute("data-layout-path"))
            .filter(Boolean);
        expect(order).toEqual(["/ts0", "/s0", "/ts1"]);
        expect(mustPath("/ts0/tb0")).toHaveTextContent("Three");
    });
});

describe("the root", () => {
    it("renders the layout again, with a new engine, for another model", async () => {
        const first = model();
        const fixture = await renderLayout(first);
        const second = createModel<Types>({
            version: 1,
            root: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "only",
                        children: [
                            {
                                id: "x",
                                component: "test",
                                label: "X",
                                data: { name: "X" },
                            },
                        ],
                    },
                ],
            },
        });
        await setInput(fixture, "model", second);
        expect(mustPath("/ts0/tb0")).toHaveTextContent("X");
        expect(path("/ts1")).toBeNull();
        expect(mustTestId("content-x")).toBeTruthy();
        expect(document.querySelector('[data-testid="content-t0"]')).toBeNull();
    });

    it("gives injectDockable the model, the engine and the layout id", async () => {
        const seen: { model?: unknown; layoutId?: string; engine?: unknown } =
            {};
        @Component({
            selector: "test-probe",
            template: "",
        })
        class Probe implements OnInit {
            // injected in the constructor, read once the root has its inputs
            readonly dockable = injectDockable<Types>();

            ngOnInit() {
                seen.model = this.dockable.model();
                seen.engine = this.dockable.engine();
                seen.layoutId = this.dockable.layoutId();
            }
        }
        @Component({
            imports: [DOCKABLE, Probe],
            template: `<div [dockableRoot]="model()"><test-probe /></div>`,
        })
        class Host {
            readonly model = input.required<Model<Types>>();
        }
        const m = model();
        await render(Host, { model: m });
        expect(seen.model).toBe(m);
        expect(seen.layoutId).toBe("main");
        expect(seen.engine).toBeDefined();
    });
});
