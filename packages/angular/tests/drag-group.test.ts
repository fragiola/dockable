import { Component, input } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
    createModel,
    DragDropManager,
    type LayoutJson,
    type Model,
    type Transfer,
    veto,
} from "@fragiola/dockable";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOCKABLE, injectDragGroup } from "../src/public-api";
import { byTestId, dragEvent } from "./drag";
import {
    Layout,
    mounts,
    recordCommands,
    render,
    settle,
    type Types,
} from "./layout";

// jsdom measures every element as 100x100 at (0, 0) (tests/setup.ts): a drop at (50, 50) lands in
// the first tabset of the layout it is dispatched on.

const layoutJson = (prefix: string): LayoutJson<Types> => ({
    version: 1,
    root: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [0, 1].map((i) => ({
                    id: `${prefix}${i}`,
                    component: "test" as const,
                    label: `${prefix}${i}`,
                    data: { name: `${prefix}${i}` },
                })),
            },
        ],
    },
});

const modelOf = (prefix: string) =>
    createModel<Types>(structuredClone(layoutJson(prefix)));

afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
    mounts.clear();
});

/** the tab button named `name` inside the root `root` */
function tabNamed(root: string, name: string): HTMLElement {
    const tab = [
        ...byTestId(root).querySelectorAll<HTMLElement>('[role="tab"]'),
    ].find((element) => element.textContent?.trim() === name);
    if (!tab) throw new Error(`no tab ${name} in ${root}`);
    return tab;
}

/** drags the tab named `tabName` of the root `fromRoot` onto the root `targetRoot` */
async function dragTo(fromRoot: string, tabName: string, targetRoot: string) {
    tabNamed(fromRoot, tabName).dispatchEvent(dragEvent("dragstart"));
    await settle();
    const root = byTestId(targetRoot);
    root.dispatchEvent(dragEvent("dragenter"));
    root.dispatchEvent(dragEvent("dragover"));
    root.dispatchEvent(dragEvent("drop"));
    await settle();
}

@Component({
    imports: [DOCKABLE, Layout],
    template: `
        @if (grouped()) {
            <div dockableDragGroup (transfer)="transfers.push($event)">
                <test-layout [model]="a()" testId="root-a" />
                <test-layout [model]="b()" testId="root-b" />
            </div>
        } @else {
            <test-layout [model]="a()" testId="root-a" />
            <test-layout [model]="b()" testId="root-b" />
        }
    `,
})
class TwoLayouts {
    readonly a = input.required<Model<Types>>();
    readonly b = input.required<Model<Types>>();
    readonly grouped = input(true);
    readonly transfers: Transfer[] = [];
}

describe("[dockableDragGroup]", () => {
    it("moves a tab to another layout and keeps its content, with its state", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        const commandsA = recordCommands(a);
        const commandsB = recordCommands(b);
        const fixture = await render(TwoLayouts, { a, b });
        byTestId("inc-a0").click();
        await settle(fixture);
        (byTestId("input-a0") as HTMLInputElement).value = "kept";
        const content = byTestId("content-a0");
        expect(byTestId("root-a")).toContainElement(content);

        await dragTo("root-a", "a0", "root-b");

        expect(a.get("node-by", { id: "a0" })).toBeUndefined();
        expect(b.get("node-by", { id: "a0" })).toBeDefined();
        const moved = byTestId("content-a0");
        expect(moved).toBe(content);
        expect(byTestId("root-b")).toContainElement(moved);
        expect(byTestId("inc-a0")).toHaveTextContent("count 1");
        expect(byTestId("input-a0")).toHaveValue("kept");
        expect(mounts.get("a0")).toBe(1);
        // the content still reacts in its new layout
        byTestId("inc-a0").click();
        await settle(fixture);
        expect(byTestId("inc-a0")).toHaveTextContent("count 2");
        // a transfer is a tab.add in the target and a tab.close in the source
        expect(commandsB.map((c) => c.command)).toContain("tab.add");
        expect(commandsA).toContainEqual(
            expect.objectContaining({
                command: "tab.close",
                payload: { tabId: "a0" },
            }),
        );
        expect(fixture.componentInstance.transfers).toContainEqual(
            expect.objectContaining({ tabId: "a0", previousId: "a0" }),
        );
        // the moved panel is the target layout's: registered, positioned and visible there
        const panel = moved.closest('[role="tabpanel"]');
        expect(byTestId("root-b")).toContainElement(panel as HTMLElement);
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(
            document.querySelectorAll('[data-testid="content-a0"]'),
        ).toHaveLength(1);
    });

    it("refuses the drag between layouts that are not in one group", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        await render(TwoLayouts, { a, b, grouped: false });
        await dragTo("root-a", "a0", "root-b");
        expect(a.get("node-by", { id: "a0" })).toBeDefined();
        expect(b.get("node-by", { id: "a0" })).toBeUndefined();
    });

    it("lets the target model's middleware veto the transfer", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        b.use((ctx, next) => (ctx.command === "tab.add" ? veto("no") : next()));
        await render(TwoLayouts, { a, b });
        await dragTo("root-a", "a0", "root-b");
        expect(a.get("node-by", { id: "a0" })).toBeDefined();
        expect(b.get("node-by", { id: "a0" })).toBeUndefined();
        expect(byTestId("root-a")).toContainElement(byTestId("content-a0"));
    });

    it("removes a closed tab's content", async () => {
        const a = modelOf("a");
        const b = modelOf("b");
        await render(TwoLayouts, { a, b });
        a.run("tab.close", { tabId: "a0" });
        await settle();
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(document.querySelector('[data-testid="content-a0"]')).toBeNull();
    });
});

describe("injectDragGroup", () => {
    it("throws outside [dockableDragGroup]", () => {
        expect(() =>
            TestBed.runInInjectionContext(() => injectDragGroup()),
        ).toThrow(/dockableDragGroup/);
    });

    it("gives the group to code inside it", async () => {
        const onGroup = vi.fn();
        @Component({ selector: "test-grab", template: "" })
        class Grab {
            constructor() {
                onGroup(injectDragGroup());
            }
        }
        @Component({
            imports: [DOCKABLE, Grab],
            template: `<div dockableDragGroup #group="dockableDragGroup"><test-grab /></div>`,
        })
        class Host {}
        await render(Host);
        expect(onGroup).toHaveBeenCalledTimes(1);
        expect(onGroup.mock.calls[0]?.[0]).toHaveProperty("transfer");
    });
});
