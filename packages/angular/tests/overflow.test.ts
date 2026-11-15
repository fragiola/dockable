import { Component, input } from "@angular/core";
import {
    createModel,
    type LayoutJson,
    type Model,
    type TabJson,
} from "@fragiola/dockable";
import { describe, expect, it, vi } from "vitest";
import { DOCKABLE, injectTabOverflow } from "../src/public-api";
import { mustPath, mustTestId, path } from "./helpers";
import { recordCommands, render, settle, type Types } from "./layout";

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

/** a menu of the enclosing tabset's hidden tabs */
@Component({
    selector: "test-menu",
    template: `<ul data-testid="menu">
        @for (tab of overflow.hiddenTabs(); track tab.id) {
            <li>{{ tab.label }}</li>
        }
    </ul>`,
})
class Menu {
    readonly overflow = injectTabOverflow<Types>();
}

@Component({
    imports: [DOCKABLE, Menu],
    template: `
        <div [dockableRoot]="model()">
            <div dockableRow>
                <ng-template dockableRowChild let-node>
                    @if (node.type === "tabset") {
                        <div [dockableTabSet]="node">
                            <div dockableTabList [overflow]="overflow()">
                                <ng-template dockableTabListItem let-tab>
                                    <div [dockableTab]="tab">{{ tab.label }}</div>
                                </ng-template>
                            </div>
                            <button
                                dockableTabOverflowTrigger
                                #trigger="dockableTabOverflowTrigger"
                                data-testid="trigger"
                                aria-label="More tabs"
                            >{{ trigger.state().hiddenTabs.length }}</button>
                            <test-menu />
                            <div dockableTabSetContent></div>
                        </div>
                    }
                </ng-template>
            </div>
        </div>
    `,
})
class OverflowLayout {
    readonly model = input.required<Model<Types>>();
    readonly overflow = input(true);
}

describe("tab overflow", () => {
    it("hides the tabs that do not fit, and shows the trigger with the hidden ones", async () => {
        await render(OverflowLayout, { model: load() });
        expect(path("/ts0/tabstrip")).toHaveAttribute("data-overflowing", "");
        const hiddenTab = mustPath("/ts0/tb3");
        expect(hiddenTab).toHaveAttribute("data-overflow-hidden", "");
        expect(hiddenTab.style.display).toBe("none");
        expect(mustPath("/ts0/tb0")).not.toHaveAttribute(
            "data-overflow-hidden",
        );
        expect(mustPath("/ts0/tb0").style.display).toBe("");
        const trigger = mustTestId("trigger");
        expect(trigger).toHaveAttribute(
            "data-layout-path",
            "/ts0/button/overflow",
        );
        expect(trigger).toHaveAttribute("data-count", "1");
        expect(trigger).toHaveAttribute("type", "button");
        expect(trigger).toHaveAttribute("aria-label", "More tabs");
        expect(trigger.style.display).toBe("");
        expect(trigger).toHaveTextContent("1");
        expect(mustTestId("menu")).toHaveTextContent("D");
    });

    it("brings a tab selected from the menu into the strip, hiding another in its place", async () => {
        const model = load();
        await render(OverflowLayout, { model });
        model.run("tab.select", { tabId: "d" });
        await settle();
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
        expect(path("/ts0/tb2")).toHaveAttribute("data-overflow-hidden", "");
        expect(mustTestId("menu")).toHaveTextContent("C");
    });

    it("selects a hidden tab reached with the arrow keys, which brings it into the strip", async () => {
        const model = load();
        const commands = recordCommands(model);
        await render(OverflowLayout, { model });
        const tab2 = mustPath("/ts0/tb2");
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
        const error = vi.spyOn(console, "error");
        const model = load();
        await render(OverflowLayout, { model });
        for (const id of ["d", "a", "c", "d", "b", "d", "a"]) {
            model.run("tab.select", { tabId: id });
            await settle();
            expect(path(`/ts0/tb${"abcd".indexOf(id)}`)).not.toHaveAttribute(
                "data-overflow-hidden",
            );
        }
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it("hides the trigger, and drops data-overflowing, when every tab fits", async () => {
        const model = load();
        await render(OverflowLayout, { model });
        model.run("tab.close", { tabId: "d" });
        await settle();
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-overflowing");
        expect(mustTestId("trigger").style.display).toBe("none");
        expect(mustTestId("trigger")).not.toHaveAttribute("data-count");
        expect(path("/ts0/tb2")).not.toHaveAttribute("data-overflow-hidden");
    });

    it('keeps every tab with [overflow]="false", for a strip that wraps or scrolls', async () => {
        await render(OverflowLayout, { model: load(), overflow: false });
        expect(path("/ts0/tabstrip")).not.toHaveAttribute("data-overflowing");
        expect(path("/ts0/tb3")).not.toHaveAttribute("data-overflow-hidden");
        expect(mustTestId("trigger").style.display).toBe("none");
    });
});
