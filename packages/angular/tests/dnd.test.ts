import { Component, input } from "@angular/core";
import {
    createModel,
    DRAG_TYPE,
    DragDropManager,
    type Model,
    type TabInitOf,
} from "@fragiola/dockable";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DOCKABLE } from "../src/public-api";
import { byTestId, dragEvent, fakeDataTransfer, path } from "./drag";
import { render, renderLayout, settle, type Types, twoTabsets } from "./layout";

const model = () => createModel<Types>(structuredClone(twoTabsets));

afterEach(() => {
    if (DragDropManager.getDragState()) {
        DragDropManager.endDrag();
    }
});

describe("[dockableTab] dragging", () => {
    it("is draggable only when the tab enables drag", async () => {
        const json = structuredClone(twoTabsets);
        const first = json.root.children?.[0];
        if (first?.type !== "tabset") throw new Error("no tabset");
        first.children = (first.children ?? []).map((tab, index) =>
            index === 1 ? { ...tab, draggable: false } : tab,
        );
        await renderLayout(createModel<Types>(json));
        expect(path("/ts0/tb0")).toHaveAttribute("draggable", "true");
        expect(path("/ts0/tb1")).toHaveAttribute("draggable", "false");
        const event = dragEvent("dragstart");
        path("/ts0/tb1").dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    it("starts a drag on dragstart, marking the tab and the root as dragging", async () => {
        await renderLayout(model());
        const transfer = fakeDataTransfer();
        path("/ts0/tb0").dispatchEvent(
            dragEvent("dragstart", 50, 50, transfer),
        );
        await settle();
        expect(transfer.setData).toHaveBeenCalledWith(
            DRAG_TYPE,
            expect.any(String),
        );
        expect(path("/ts0/tb0")).toHaveAttribute("data-dragging", "");
        expect(path("/layout")).toHaveAttribute("data-dragging", "");
        path("/ts0/tb0").dispatchEvent(dragEvent("dragend"));
        await settle();
        expect(path("/ts0/tb0")).not.toHaveAttribute("data-dragging");
        expect(path("/layout")).not.toHaveAttribute("data-dragging");
    });

    it("moves the tab where it is dropped, through tab.move", async () => {
        const m = model();
        await renderLayout(m);
        path("/ts1/tb0").dispatchEvent(dragEvent("dragstart"));
        await settle();
        const root = path("/layout");
        root.dispatchEvent(dragEvent("dragenter"));
        root.dispatchEvent(dragEvent("dragover"));
        await settle();
        // the drop indicator follows the computed drop rect during the drag
        const indicator = byTestId("root-indicator");
        expect(indicator).toHaveAttribute("data-visible", "");
        expect(indicator.style.display).not.toBe("none");
        expect(indicator.style.pointerEvents).toBe("none");
        root.dispatchEvent(dragEvent("drop"));
        await settle();
        expect(m.get("node-parent-by", { nodeId: "t2" })?.id).toBe("ts0");
        expect(indicator).not.toHaveAttribute("data-visible");
        expect(indicator.style.display).toBe("none");
    });
});

describe("[dockableDragSource] and [dockableDropZone]", () => {
    @Component({
        imports: [DOCKABLE],
        template: `
            <div
                [dockableDragSource]="model()"
                [tab]="tab"
                [disabled]="disabled()"
                (dropped)="dropped($event.tabId)"
                data-testid="source"
            >New</div>
            <div
                [dockableDropZone]="model()"
                (dropped)="zoned($event.drag)"
                data-testid="zone"
            ></div>
            <div [dockableRoot]="model()" data-testid="root">
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
        `,
    })
    class Sources {
        readonly model = input.required<Model<Types>>();
        readonly disabled = input(false);
        readonly dropped = vi.fn();
        readonly zoned = vi.fn();
        readonly tab: TabInitOf<Types> = {
            component: "test",
            label: "New",
            data: { name: "New" },
        };
    }

    it("adds its tab where it is dropped, and reports the new tab's id", async () => {
        const m = model();
        const fixture = await render(Sources, { model: m });
        const source = byTestId("source");
        expect(source).toHaveAttribute("draggable", "true");
        source.dispatchEvent(dragEvent("dragstart"));
        await settle(fixture);
        expect(source).toHaveAttribute("data-dragging", "");
        const root = byTestId("root");
        root.dispatchEvent(dragEvent("dragenter"));
        root.dispatchEvent(dragEvent("dragover"));
        root.dispatchEvent(dragEvent("drop"));
        await settle(fixture);
        const id = fixture.componentInstance.dropped.mock.calls[0]?.[0];
        expect(id).toBeTypeOf("string");
        expect(m.get("node-by", { id })).toMatchObject({ label: "New" });
    });

    it("cancels the drag when disabled", async () => {
        await render(Sources, { model: model(), disabled: true });
        const source = byTestId("source");
        expect(source).toHaveAttribute("draggable", "false");
        expect(source).toHaveAttribute("aria-disabled", "true");
        expect(source).toHaveAttribute("data-disabled", "");
        const event = dragEvent("dragstart");
        source.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    });

    it("hands a drag of its model to the zone's (dropped), without moving it", async () => {
        const m = model();
        const fixture = await render(Sources, { model: m });
        path("/ts0/tb0").dispatchEvent(dragEvent("dragstart"));
        await settle(fixture);
        const zone = byTestId("zone");
        expect(zone).toHaveAttribute("data-drop-active", "");
        zone.dispatchEvent(dragEvent("dragenter"));
        zone.dispatchEvent(dragEvent("dragover"));
        await settle(fixture);
        expect(zone).toHaveAttribute("data-drop-over", "");
        zone.dispatchEvent(dragEvent("drop"));
        await settle(fixture);
        expect(fixture.componentInstance.zoned).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "tab" }),
        );
        expect(m.get("node-parent-by", { nodeId: "t0" })?.id).toBe("ts0");
    });
});
