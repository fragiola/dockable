import { Component, input } from "@angular/core";
import {
    type BorderJson,
    createModel,
    type LayoutJson,
    type Model,
} from "@fragiola/dockable";
import { afterEach, describe, expect, it } from "vitest";
import { DOCKABLE } from "../src/public-api";
import { keyDown, mustPath, mustTestId, path } from "./helpers";
import {
    Counter,
    mounts,
    recordCommands,
    render,
    settle,
    type Types,
    twoTabsets,
} from "./layout";

afterEach(() => {
    mounts.clear();
});

const withBorders = (borders: BorderJson<Types>[]): LayoutJson<Types> => ({
    ...structuredClone(twoTabsets),
    borders,
});

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

const load = () => createModel<Types>(structuredClone(ideBorders));

@Component({
    imports: [DOCKABLE, Counter],
    template: `
        <div [dockableRoot]="model()" data-testid="root">
            <div dockableBorders>
                <ng-template [dockableBordersBar]="model()" let-border>
                    <div [dockableBorder]="border" [tabDirection]="tabDirection()" [attr.data-testid]="'bar-' + border.id">
                        <div dockableTabList>
                            <ng-template dockableTabListItem let-tab>
                                <div [dockableTab]="tab">{{ tab.label }}</div>
                            </ng-template>
                        </div>
                    </div>
                </ng-template>
                @if (customContent()) {
                    <ng-template dockableBordersContent let-border>
                        <div [dockableBorderContent]="border" class="panel-area" [splitter]="border.location !== 'bottom'">
                            <ng-template dockableBorderSplitter let-node>
                                <div [dockableSplitter]="node" aria-label="Resize the border"></div>
                            </ng-template>
                        </div>
                    </ng-template>
                }
                <div dockableRow>
                    <ng-template dockableRowChild let-node>
                        @if (node.type === "tabset") {
                            <div [dockableTabSet]="node">
                                <div dockableTabList>
                                    <ng-template dockableTabListItem let-tab>
                                        <div [dockableTab]="tab">{{ tab.label }}</div>
                                    </ng-template>
                                </div>
                                <div dockableTabSetContent></div>
                            </div>
                        }
                    </ng-template>
                </div>
            </div>
            <ng-template dockablePanels let-tab>
                <div [dockablePanel]="tab"><test-counter [id]="tab.id" /></div>
            </ng-template>
            <div dockableEdgeIndicator="top" data-testid="edge-top"></div>
        </div>
    `,
})
class BorderLayout {
    readonly model = input.required<Model<Types>>();
    readonly tabDirection = input<"up" | "down" | undefined>(undefined);
    readonly customContent = input(false);
}

const renderBorders = (inputs: Record<string, unknown> = {}) =>
    render(BorderLayout, { model: load(), ...inputs });

async function click(target: HTMLElement) {
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
}

describe("[dockableBorders]", () => {
    it("renders the borders that show, around the main area, with their layout paths", async () => {
        await renderBorders();
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
        const start = mustPath("/border/start");
        const main = mustPath("/main");
        expect(
            start.compareDocumentPosition(main) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        // the bottom strip comes after the main area, the start strip's parent is the middle row
        expect(start.parentElement).toBe(mustPath("/borders/middle"));
        expect(mustPath("/border/bottom").parentElement).toBe(
            mustPath("/borders"),
        );
    });

    it("exposes the border's state as data attributes", async () => {
        await renderBorders();
        const start = mustPath("/border/start");
        expect(start).toHaveAttribute("data-location", "start");
        expect(start).toHaveAttribute("data-orientation", "vertical");
        expect(start).toHaveAttribute("data-docked", "");
        expect(start).toHaveAttribute("data-tab-direction", "up");
        expect(start).not.toHaveAttribute("data-open");
        expect(start).not.toHaveAttribute("data-overlay");
        const bottom = mustPath("/border/bottom");
        expect(bottom).toHaveAttribute("data-open", "");
        expect(bottom).not.toHaveAttribute("data-tab-direction");
    });

    it("takes the start border's tab direction from its tabDirection input", async () => {
        await renderBorders({ tabDirection: "down" });
        expect(path("/border/start")).toHaveAttribute(
            "data-tab-direction",
            "down",
        );
    });

    it("sizes the open panel's area by the border size, and hides a closed one", async () => {
        await renderBorders();
        const bottom = mustPath("/border/bottom/content");
        expect(bottom.style.display).toBe("flex");
        expect(path("/border/bottom/area")?.style.height).toBe("120px");
        expect(bottom).toContainElement(path("/border/bottom/s-1"));
        const start = mustPath("/border/start/content");
        expect(start.style.display).toBe("none");
        expect(path("/border/start/area")?.style.width).toBe("180px");
        expect(path("/border/start/s-1")).toBeNull(); // no splitter while closed
        expect(mustTestId("content-terminal")).toBeInTheDocument();
    });

    it("opens a border's panel on a tab click and closes it on a second click, through commands", async () => {
        const fixture = await renderBorders();
        const model = fixture.componentInstance.model();
        const commands = recordCommands(model);
        await click(mustPath("/border/start/tb1"));
        expect(commands.at(-1)).toEqual({
            command: "tab.select",
            payload: { tabId: "search" },
            transient: false,
        });
        expect(path("/border/start")).toHaveAttribute("data-open", "");
        expect(path("/border/start/content")?.style.display).toBe("flex");
        expect(mustTestId("content-search")).toBeInTheDocument();
        // the splitter sits on the layout's side: after the area of a start border
        expect(mustPath("/border/start/area").nextElementSibling).toBe(
            mustPath("/border/start/s-1"),
        );

        await click(mustPath("/border/start/tb1"));
        expect(commands.at(-1)).toEqual({
            command: "border.configure",
            payload: { borderId: "border_start", open: false },
            transient: false,
        });
        expect(path("/border/start")).not.toHaveAttribute("data-open");
    });

    it("keeps the focus on a border's tab and splitter used with the keyboard", async () => {
        await renderBorders();
        const tab = mustPath("/border/start/tb1");
        tab.focus();
        keyDown(tab, { key: "Enter" });
        await settle();
        expect(path("/border/start")).toHaveAttribute("data-open", "");
        expect(document.activeElement).toBe(tab);
        // every key resizes and renders again: the splitter is never moved, so it keeps the focus
        const splitter = mustPath("/border/start/s-1");
        splitter.focus();
        for (let i = 0; i < 3; i++) {
            keyDown(splitter, { key: "ArrowRight" });
            await settle();
        }
        expect(mustPath("/border/start/s-1")).toBe(splitter);
        expect(document.activeElement).toBe(splitter);
    });

    it("resizes a border with its splitter's keyboard, in px", async () => {
        const fixture = await renderBorders();
        const model = fixture.componentInstance.model();
        const splitter = mustPath("/border/bottom/s-1");
        expect(splitter).toHaveAttribute("aria-valuenow", "120");
        expect(splitter).toHaveAttribute("aria-valuetext", "120px");
        // the splitter of a bottom border is before its area
        expect(splitter.nextElementSibling).toBe(
            mustPath("/border/bottom/area"),
        );
        keyDown(splitter, { key: "ArrowUp" }); // a bottom border grows upwards
        await settle();
        expect(
            model.get("border-settings-by", { borderId: "border_bottom" })
                ?.size,
        ).toBe(130);
        expect(path("/border/bottom/area")?.style.height).toBe("130px");
    });

    it("places an overlay border's panel over the layout's edge, marked as part of the overlay", async () => {
        const fixture = await renderBorders();
        const model = fixture.componentInstance.model();
        model.run("border.configure", {
            borderId: "border_start",
            mode: "overlay",
        });
        model.run("tab.select", { tabId: "files" });
        await settle();
        const content = mustPath("/border/start/content");
        expect(path("/border/start")).toHaveAttribute("data-overlay", "");
        expect(content.style.position).toBe("absolute");
        expect(content.style.left).toBe("0px");
        expect(content).toHaveAttribute("data-dockable-overlay", "");
        expect(content.style.pointerEvents).toBe("none");
        expect(path("/border/start/s-1")?.style.pointerEvents).toBe("auto");
        expect(path("/border/bottom/content")?.style.position).toBe("");
    });

    it("takes a content template that customises the panel area and its splitter", async () => {
        await renderBorders({ customContent: true });
        const bottom = mustPath("/border/bottom/content");
        expect(bottom).toHaveClass("panel-area");
        expect(path("/border/bottom/s-1")).toBeNull(); // [splitter]="false"
        await click(mustPath("/border/start/tb0"));
        const splitter = mustPath("/border/start/s-1");
        expect(splitter).toHaveAttribute("aria-label", "Resize the border");
    });

    it("keeps a border tab's content when it moves into a tabset", async () => {
        const fixture = await renderBorders();
        const model = fixture.componentInstance.model();
        mustTestId("inc-terminal").click();
        await settle();
        const content = mustTestId("content-terminal");
        model.run("tab.move", { tabId: "terminal", to: "ts0", index: -1 });
        await settle();
        expect(mustTestId("content-terminal")).toBe(content);
        expect(mustTestId("inc-terminal")).toHaveTextContent("count 1");
        expect(mounts.get("terminal")).toBe(1);
        expect(content.closest("[role=tabpanel]")).toHaveAttribute(
            "data-layout-path",
            "/ts0/t2",
        );
    });
});

describe("[dockableEdgeIndicator]", () => {
    it("is hidden, aria-hidden and pointer-events: none outside a drag", async () => {
        await renderBorders();
        const edge = mustTestId("edge-top");
        expect(edge).toHaveAttribute("aria-hidden", "true");
        expect(edge).toHaveAttribute("data-layout-path", "/edge/top");
        expect(edge).toHaveAttribute("data-edge", "top");
        expect(edge).not.toHaveAttribute("data-visible");
        expect(edge.style.display).toBe("none");
        expect(edge.style.pointerEvents).toBe("none");
    });
});
